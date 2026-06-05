const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
require('dotenv').config();

const app = express();
app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.use(express.json());

/* ===== PostgreSQL ===== */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      premium BOOLEAN DEFAULT false,
      premium_key VARCHAR(50) DEFAULT NULL,
      is_admin BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      uploads_today INT DEFAULT 0,
      uploads_this_week INT DEFAULT 0,
      last_daily_reset DATE DEFAULT CURRENT_DATE,
      last_weekly_reset DATE DEFAULT CURRENT_DATE
    )
  `);
  // Add missing columns if upgrading
  const cols = ['uploads_today', 'uploads_this_week', 'last_daily_reset', 'last_weekly_reset'];
  for (const c of cols) {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${c} ${c.includes('_reset') ? 'DATE DEFAULT CURRENT_DATE' : 'INT DEFAULT 0'}`);
  }
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false`);
  await pool.query(`UPDATE users SET is_admin = true WHERE username = '1337vaporesso'`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS keys (
      id SERIAL PRIMARY KEY,
      key_value VARCHAR(50) UNIQUE NOT NULL,
      used BOOLEAN DEFAULT false,
      used_by VARCHAR(50) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('DB tables ready');
}

/* ===== Temp dir for uploads ===== */
const TMP = process.env.TEMP_DIR || '/tmp/encodex';
if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true });

/* ===== Multer ===== */
const storage = multer.diskStorage({
  destination: TMP,
  filename: function(req, file, cb) {
    const ext = path.extname(file.originalname) || '.mp4';
    cb(null, uuidv4() + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100 MB hard limit
});

/* ===== Job store (in-memory, ephemeral is fine) ===== */
const jobs = new Map();

function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return Math.ceil(((d - week1) / 86400000 + week1.getDay() + 1) / 7);
}

/* ===== Middleware ===== */
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ ok: false, error: 'No token' });
  try {
    const decoded = jwt.verify(header.replace('Bearer ', ''), process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    res.status(401).json({ ok: false, error: 'Invalid token' });
  }
}

/* ===== Routes: Auth & Admin (existing) ===== */
app.get('/', function(req, res) { res.json({ ok: true, status: 'running' }); });
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password || password.length < 4)
      return res.status(400).json({ ok: false, error: 'Invalid username or password (min 4 chars)' });
    const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username.toLowerCase()]);
    if (existing.rows.length > 0)
      return res.status(409).json({ ok: false, error: 'Username already taken' });
    const hash = await bcrypt.hash(password, 10);
    const user = await pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username, premium',
      [username.toLowerCase(), hash]
    );
    const token = jwt.sign({ id: user.rows[0].id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ ok: true, token, username: user.rows[0].username, premium: false, is_admin: false });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username.toLowerCase()]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ ok: true, token, username: user.username, premium: user.premium, is_admin: user.is_admin });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
app.get('/api/me', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, premium, is_admin FROM users WHERE id = $1', [req.userId]);
    if (!result.rows[0]) return res.status(404).json({ ok: false, error: 'User not found' });
    res.json({ ok: true, username: result.rows[0].username, premium: result.rows[0].premium, is_admin: result.rows[0].is_admin });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
app.post('/api/activate', auth, async (req, res) => {
  try {
    const { key } = req.body;
    if (!key) return res.status(400).json({ ok: false, error: 'Key is required' });
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
    const user = userResult.rows[0];
    if (user.premium) return res.json({ ok: true, username: user.username, premium: true });
    const keyResult = await pool.query('SELECT * FROM keys WHERE key_value = $1 AND used = false', [key.toUpperCase()]);
    if (!keyResult.rows[0]) return res.status(400).json({ ok: false, error: 'Invalid or already used key' });
    await pool.query('UPDATE keys SET used = true, used_by = $1 WHERE key_value = $2', [user.username, key.toUpperCase()]);
    await pool.query('UPDATE users SET premium = true, premium_key = $1 WHERE id = $2', [key.toUpperCase(), req.userId]);
    res.json({ ok: true, username: user.username, premium: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
app.get('/api/keys/generate', auth, async (req, res) => {
  try {
    const userResult = await pool.query('SELECT is_admin FROM users WHERE id = $1', [req.userId]);
    if (!userResult.rows[0] || !userResult.rows[0].is_admin)
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    const count = parseInt(req.query.count) || 1;
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const generated = [];
    for (let n = 0; n < count; n++) {
      let key;
      do {
        const p = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        key = `ENCODEX-${p()}-${p()}-${p()}`;
      } while ((await pool.query('SELECT id FROM keys WHERE key_value = $1', [key])).rows.length > 0);
      await pool.query('INSERT INTO keys (key_value) VALUES ($1)', [key]);
      generated.push(key);
    }
    res.json({ ok: true, keys: generated });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ===== Admin endpoints ===== */
function isAdmin(req, res, next) {
  pool.query('SELECT is_admin FROM users WHERE id = $1', [req.userId]).then(function(r) {
    if (!r.rows[0] || !r.rows[0].is_admin)
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    next();
  }).catch(function(e) { res.status(500).json({ ok: false, error: e.message }); });
}
app.get('/api/admin/users', auth, isAdmin, async function(req, res) {
  try {
    var result = await pool.query('SELECT id, username, premium, premium_key, created_at, uploads_today, uploads_this_week FROM users ORDER BY created_at DESC');
    res.json({ ok: true, users: result.rows });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});
app.post('/api/admin/grant-premium', auth, isAdmin, async function(req, res) {
  try {
    var username = (req.body.username || '').toLowerCase().trim();
    if (!username) return res.status(400).json({ ok: false, error: 'Username required' });
    var result = await pool.query('UPDATE users SET premium = true WHERE username = $1 RETURNING id, username, premium', [username]);
    if (!result.rows[0]) return res.status(404).json({ ok: false, error: 'User not found' });
    res.json({ ok: true, user: result.rows[0] });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});
app.post('/api/admin/grant-admin', auth, isAdmin, async function(req, res) {
  try {
    var username = (req.body.username || '').toLowerCase().trim();
    if (!username) return res.status(400).json({ ok: false, error: 'Username required' });
    var result = await pool.query('UPDATE users SET is_admin = true WHERE username = $1 RETURNING id, username, is_admin', [username]);
    if (!result.rows[0]) return res.status(404).json({ ok: false, error: 'User not found' });
    res.json({ ok: true, user: result.rows[0] });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

/* ===== HQ Upload Process Endpoints ===== */

// Usage check helper
async function checkAndResetUsage(userId) {
  const result = await pool.query('SELECT premium, uploads_today, uploads_this_week, last_daily_reset, last_weekly_reset FROM users WHERE id = $1', [userId]);
  const user = result.rows[0];
  if (!user) return null;

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const currentWeek = getISOWeek(today);
  const lastWeek = user.last_weekly_reset ? getISOWeek(new Date(user.last_weekly_reset)) : 0;

  let uploadsToday = user.uploads_today;
  let uploadsThisWeek = user.uploads_this_week;

  // Reset daily if new day
  if (user.last_daily_reset && user.last_daily_reset.toISOString().split('T')[0] !== todayStr) {
    uploadsToday = 0;
  }

  // Reset weekly if new week
  if (currentWeek !== lastWeek) {
    uploadsThisWeek = 0;
  }

  const limits = user.premium
    ? { daily: 10, weekly: 50, maxSizeMB: 90 }
    : { daily: 999, weekly: 3, maxSizeMB: 30 };

  return { uploadsToday, uploadsThisWeek, limits, premium: user.premium };
}

async function commitUsage(userId, usage) {
  const todayStr = new Date().toISOString().split('T')[0];
  const today = new Date();
  const currentWeek = getISOWeek(today);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - ((today.getDay() + 6) % 7));
  const weekStartStr = weekStart.toISOString().split('T')[0];

  await pool.query(
    'UPDATE users SET uploads_today = $1, uploads_this_week = $2, last_daily_reset = $3, last_weekly_reset = $4 WHERE id = $5',
    [usage.uploadsToday, usage.uploadsThisWeek, todayStr, weekStartStr, userId]
  );
}

app.post('/api/process/upload', auth, async (req, res) => {
  try {
    const usage = await checkAndResetUsage(req.userId);
    if (!usage) return res.status(404).json({ ok: false, error: 'User not found' });

    // Check limits
    if (usage.uploadsThisWeek >= usage.limits.weekly) {
      return res.status(429).json({ ok: false, error: 'Weekly limit reached' });
    }
    if (usage.uploadsToday >= usage.limits.daily) {
      return res.status(429).json({ ok: false, error: 'Daily limit reached' });
    }

    // Handle multipart upload
    upload.single('video')(req, res, async function(err) {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ ok: false, error: 'File too large (max 100 MB)' });
        }
        return res.status(400).json({ ok: false, error: err.message });
      }

      if (!req.file) {
        return res.status(400).json({ ok: false, error: 'No file uploaded' });
      }

      // Check file size against user limit
      const maxBytes = usage.limits.maxSizeMB * 1024 * 1024;
      if (req.file.size > maxBytes) {
        fs.unlink(req.file.path, () => {});
        return res.status(413).json({ ok: false, error: `File too large (max ${usage.limits.maxSizeMB} MB for your plan)` });
      }

      const jobId = uuidv4();
      const outputPath = path.join(TMP, `processed_${jobId}.mp4`);

      const job = {
        id: jobId,
        userId: req.userId,
        inputPath: req.file.path,
        outputPath: outputPath,
        status: 'processing',
        fileSize: req.file.size,
        usage: usage,
        createdAt: Date.now()
      };
      jobs.set(jobId, job);

      // Spawn FFmpeg - copy streams (remux, no re-encode)
      const ff = spawn('ffmpeg', [
        '-i', req.file.path,
        '-c', 'copy',
        '-map', '0',
        '-movflags', '+faststart',
        outputPath
      ]);
      let stderr = '';
      ff.stderr.on('data', d => { stderr += d.toString(); });
      ff.on('close', code => {
        if (code === 0) {
          job.status = 'done';
        } else {
          job.status = 'error';
          job.error = stderr.split('\n').slice(-3).join('\n');
        }
      });

      res.json({ ok: true, jobId: jobId });
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/process/status/:jobId', auth, (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ ok: false, error: 'Job not found' });
  if (job.userId !== req.userId) return res.status(403).json({ ok: false, error: 'Forbidden' });
  res.json({ ok: true, status: job.status });
});

app.get('/api/process/result/:jobId', auth, (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ ok: false, error: 'Job not found' });
  if (job.userId !== req.userId) return res.status(403).json({ ok: false, error: 'Forbidden' });
  if (job.status !== 'done') return res.status(400).json({ ok: false, error: 'Job not ready' });

  res.download(job.outputPath, 'video.mp4', function(err) {
    if (err) {
      console.error('Download error:', err.message);
    }
    // Cleanup temp files after download
    fs.unlink(job.inputPath, () => {});
    fs.unlink(job.outputPath, () => {});
    // Keep job in memory for status reference but mark as delivered
    job.delivered = true;
    // Auto-delete job after 5 min
    setTimeout(() => jobs.delete(job.id), 300000);
  });
});

app.post('/api/process/commit', auth, async (req, res) => {
  try {
    const { jobId } = req.body;
    if (!jobId) return res.status(400).json({ ok: false, error: 'jobId required' });

    const job = jobs.get(jobId);
    if (!job) return res.status(404).json({ ok: false, error: 'Job not found' });
    if (job.userId !== req.userId) return res.status(403).json({ ok: false, error: 'Forbidden' });

    // Increment usage
    job.usage.uploadsToday++;
    job.usage.uploadsThisWeek++;
    await commitUsage(req.userId, job.usage);

    const limits = job.usage.limits;
    res.json({
      ok: true,
      daily_used: job.usage.uploadsToday,
      daily_limit: limits.daily,
      weekly_used: job.usage.uploadsThisWeek,
      weekly_limit: limits.weekly,
      premium: job.usage.premium
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Usage stats endpoint
app.get('/api/process/usage', auth, async (req, res) => {
  try {
    const usage = await checkAndResetUsage(req.userId);
    if (!usage) return res.status(404).json({ ok: false, error: 'User not found' });
    res.json({
      ok: true,
      daily_used: usage.uploadsToday,
      daily_limit: usage.limits.daily,
      weekly_used: usage.uploadsThisWeek,
      weekly_limit: usage.limits.weekly,
      max_file_size_mb: usage.limits.maxSizeMB,
      premium: usage.premium
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Log all registered routes for debugging
app._router.stack.forEach(function(r) {
  if (r.route && r.route.path) {
    console.log('Route:', Object.keys(r.route.methods).join(',').toUpperCase(), r.route.path);
  }
});

/* ===== Start ===== */
const PORT = process.env.PORT || 3000;
if (process.env.DATABASE_URL) {
  init().then(() => {
    app.listen(PORT, '0.0.0.0', () => console.log('Server running on port ' + PORT));
  }).catch(e => {
    console.error('Init error:', e.message);
    process.exit(1);
  });
} else {
  console.warn('DATABASE_URL not set, running in limited mode');
  app.listen(PORT, '0.0.0.0', () => console.log('Server running (no DB) on port ' + PORT));
}
