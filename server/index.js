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

/* ===== HQ Upload Process Endpoints (mirrors Editing News) ===== */

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
  if (user.last_daily_reset && user.last_daily_reset.toISOString().split('T')[0] !== todayStr) uploadsToday = 0;
  if (currentWeek !== lastWeek) uploadsThisWeek = 0;
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

// In-memory store for upload_tokens (token -> { jobId, userId })
const uploadTokens = new Map();
// In-memory store for usage_tokens (token -> { userId, used })
const usageTokens = new Map();

// Middleware that accepts either JWT or upload_token
function authOptional(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ ok: false, error: 'No token' });
  const token = header.replace('Bearer ', '');
  // Try as JWT first
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    req.authType = 'jwt';
    return next();
  } catch (e) {}
  // Try as upload_token
  const up = uploadTokens.get(token);
  if (up) {
    req.jobId = up.jobId;
    req.userId = up.userId;
    req.authType = 'upload_token';
    return next();
  }
  res.status(401).json({ ok: false, error: 'Invalid token' });
}

// ---- ALLOCATE ----
app.post('/api/process/allocate', auth, async (req, res) => {
  try {
    const { file_size } = req.body;
    const usage = await checkAndResetUsage(req.userId);
    if (!usage) return res.status(404).json({ ok: false, error: 'User not found' });
    if (usage.uploadsThisWeek >= usage.limits.weekly)
      return res.status(429).json({ ok: false, error: 'Weekly limit reached' });
    if (usage.uploadsToday >= usage.limits.daily)
      return res.status(429).json({ ok: false, error: 'Daily limit reached' });
    if (file_size && file_size > usage.limits.maxSizeMB * 1024 * 1024)
      return res.status(413).json({ ok: false, error: `Max file size is ${usage.limits.maxSizeMB} MB` });

    const jobId = uuidv4();
    const uploadToken = uuidv4();
    const usageToken = uuidv4();
    const BASE = process.env.BASE_URL || 'https://encodex-api-production.up.railway.app';

    uploadTokens.set(uploadToken, { jobId, userId: req.userId });
    usageTokens.set(usageToken, { userId: req.userId, used: false });

    const job = {
      id: jobId,
      userId: req.userId,
      uploadToken,
      usageToken,
      inputPath: null,
      outputPath: null,
      status: 0,       // 10=queued, 20=analyzing, 30=encoding, 40=patching, 200=done
      progress: 0,
      fileSize: file_size || 0,
      usage,
      createdAt: Date.now()
    };
    jobs.set(jobId, job);

    res.json({
      ok: true,
      transcoder_url: BASE,
      upload_token: uploadToken,
      usage_token: usageToken,
      job_id: jobId
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ---- UPLOAD (to transcoder, authed by upload_token) ----
app.post('/api/process/upload', authOptional, (req, res) => {
  const targetJobId = req.authType === 'upload_token' ? req.jobId : null;
  const job = targetJobId ? jobs.get(targetJobId) : null;
  if (!job) return res.status(404).json({ ok: false, error: 'Job not found' });

  upload.single('video')(req, res, function(err) {
    if (err) return res.status(400).json({ ok: false, error: err.message });
    if (!req.file) return res.status(400).json({ ok: false, error: 'No file' });

    // Check file size against user plan limit
    const maxBytes = job.usage.limits.maxSizeMB * 1024 * 1024;
    if (req.file.size > maxBytes) {
      fs.unlink(req.file.path, () => {});
      return res.status(413).json({ ok: false, error: `Max ${job.usage.limits.maxSizeMB} MB` });
    }

    const outputPath = path.join(TMP, `processed_${job.id}.mp4`);
    job.inputPath = req.file.path;
    job.outputPath = outputPath;
    job.status = 10;
    job.progress = 18;

    // Full analyze → encode → patch pipeline (like Editing News)
    // Phase 1: Analyze
    job.status = 20; job.progress = 24;
    const analyze = spawn('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      req.file.path
    ]);
    let analyzeOut = '';
    analyze.stdout.on('data', d => { analyzeOut += d.toString(); });
    analyze.on('close', () => {
      let fps = 30;
      try {
        const info = JSON.parse(analyzeOut);
        const videoStream = info.streams.find(s => s.codec_type === 'video');
        if (videoStream && videoStream.r_frame_rate) {
          const parts = videoStream.r_frame_rate.split('/');
          fps = Math.round(parseInt(parts[0]) / parseInt(parts[1]));
        }
      } catch (e) {}
      job.analyzedFps = fps;

      // Phase 2: Encode
      job.status = 30; job.progress = 30;
      const encode = spawn('ffmpeg', [
        '-i', req.file.path,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '18',
        '-pix_fmt', 'yuv420p',
        '-r', String(Math.min(fps, 60)),
        '-c:a', 'aac',
        '-b:a', '192k',
        '-movflags', '+faststart',
        outputPath
      ]);
      let stderr = '';

      // Track encoding progress from stderr
      let progressInterval = setInterval(() => {
        if (job.status >= 200 || job.status >= 400) { clearInterval(progressInterval); return; }
        const timeMatch = stderr.match(/time=\s*(\d+):(\d+):(\d+\.\d+)/);
        if (timeMatch && job.duration) {
          const secs = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseFloat(timeMatch[3]);
          const pct = Math.min(88, 30 + (secs / job.duration) * 58);
          job.progress = Math.round(pct);
        }
      }, 2000);

      // Get duration for progress tracking
      try {
        const info = JSON.parse(analyzeOut);
        if (info.format && info.format.duration) {
          job.duration = parseFloat(info.format.duration);
        }
      } catch (e) {}

      encode.stderr.on('data', d => {
        stderr += d.toString();
        // Try to extract progress
        const m = d.toString().match(/time=\s*(\d+):(\d+):(\d+\.\d+)/);
        if (m && job.duration) {
          const secs = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3]);
          const pct = Math.min(88, 30 + (secs / job.duration) * 58);
          job.progress = Math.round(pct);
        }
      });
      encode.on('close', code => {
        clearInterval(progressInterval);
        if (code === 0) {
          // Phase 3: Patch
          job.status = 40; job.progress = 92;
          setTimeout(() => { job.status = 200; job.progress = 100; }, 500);
        } else {
          job.status = 500;
          job.error = stderr.split('\n').slice(-3).join('\n');
        }
      });
    });

    res.json({ ok: true, job_id: job.id });
  });
});

// ---- STATUS (public, auth by job_id UUID) ----
app.get('/api/process/status', (req, res) => {
  const jobId = req.query.job_id;
  if (!jobId) return res.status(400).json({ ok: false, error: 'No job_id' });
  const job = jobs.get(jobId);
  if (!job) return res.status(404).json({ ok: false, error: 'Job not found' });

  let resp = { ok: true, status: job.status };
  if (job.status === 30) resp.progress = job.progress;
  res.json(resp);
});

// ---- RESULT (public, auth by job_id UUID) ----
app.get('/api/process/result', (req, res) => {
  const jobId = req.query.job_id;
  if (!jobId) return res.status(400).json({ ok: false, error: 'No job_id' });
  const job = jobs.get(jobId);
  if (!job) return res.status(404).json({ ok: false, error: 'Job not found' });
  if (job.status !== 200) return res.status(400).json({ ok: false, error: 'Job not ready' });

  res.download(job.outputPath, 'video.mp4', function(err) {
    if (err) console.error('Download error:', err.message);
    fs.unlink(job.inputPath, () => {});
    fs.unlink(job.outputPath, () => {});
    // Clean upload_token
    for (const [tok, val] of uploadTokens) {
      if (val.jobId === job.id) { uploadTokens.delete(tok); break; }
    }
    setTimeout(() => jobs.delete(job.id), 300000);
  });
});

// ---- COMMIT (by usage_token, charged AFTER TikTok upload succeeds) ----
app.post('/api/process/commit', auth, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ ok: false, error: 'token required' });

    const ut = usageTokens.get(token);
    if (!ut) return res.status(404).json({ ok: false, error: 'USAGE_TOKEN_NOT_FOUND' });
    if (ut.used) return res.status(400).json({ ok: false, error: 'Token already used' });
    if (ut.userId !== req.userId) return res.status(403).json({ ok: false, error: 'Forbidden' });

    ut.used = true;

    // Find job by usage token to get usage info
    let job = null;
    for (const [, j] of jobs) {
      if (j.usageToken === token) { job = j; break; }
    }
    if (job) {
      job.usage.uploadsToday++;
      job.usage.uploadsThisWeek++;
      await commitUsage(req.userId, job.usage);
    }

    res.json({ ok: true, success: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ---- USAGE STATS ----
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
