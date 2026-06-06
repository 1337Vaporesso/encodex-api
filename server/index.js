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
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;
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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      user_id INT NOT NULL,
      upload_token TEXT NOT NULL,
      usage_token TEXT NOT NULL,
      input_path TEXT,
      output_path TEXT,
      status INT DEFAULT 0,
      progress REAL DEFAULT 0,
      file_size BIGINT DEFAULT 0,
      duration REAL,
      analyzed_fps INT,
      error TEXT,
      usage_data JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tokens (
      token_value TEXT PRIMARY KEY,
      token_type TEXT NOT NULL,
      job_id TEXT,
      user_id INT NOT NULL,
      used BOOLEAN DEFAULT false,
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

/* ===== Routes: Transform body for TikTok HQ (Editing News style) ===== */
app.post('/api/transform', (req, res) => {
  try {
    const { body: rawBody, url: reqUrl } = req.body;
    if (!rawBody) return res.json({ body: rawBody || '' });

    console.log('[EncodeX] /api/transform:', (reqUrl || '').substr(0, 150));

    let parsed;
    try { parsed = JSON.parse(rawBody); } catch(e) { return res.json({ body: rawBody }); }

    let changed = false;

    function deepPatch(obj, depth) {
      if (!obj || typeof obj !== 'object' || depth > 20) return;
      // Handle arrays
      if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
          if (obj[i] && typeof obj[i] === 'object') deepPatch(obj[i], depth + 1);
        }
        return;
      }
      // Check this level for known quality fields
      if (typeof obj.width === 'number' && typeof obj.height === 'number' && obj.width > 0 && obj.height > 0) {
        const isPortrait = obj.height > obj.width;
        if (isPortrait && obj.width < 1080) { obj.width = 1080; changed = true; }
        else if (!isPortrait && obj.height < 1080) { obj.height = 1080; changed = true; }
        // Also ensure the larger side is at least 1920 for landscape, 1080 for portrait
        if (!isPortrait && obj.width < 1920) { obj.width = 1920; changed = true; }
        if (isPortrait && obj.height < 1920) { obj.height = 1920; changed = true; }
      }
      // Patch fps fields
      for (const fpsKey of ['fps', 'frame_rate', 'video_frame_rate']) {
        if (typeof obj[fpsKey] === 'number' && obj[fpsKey] < 60 && obj[fpsKey] > 0) {
          obj[fpsKey] = 60; changed = true;
        }
      }
      // Patch bitrate fields
      for (const brKey of ['bitrate', 'video_bitrate', 'max_bitrate']) {
        if (typeof obj[brKey] === 'number' && obj[brKey] < 27000000 && obj[brKey] > 0) {
          obj[brKey] = 27000000; changed = true;
        }
      }
      // Add hqProcessed flag at every level (TikTok might check anywhere)
      if (obj.hqProcessed === undefined || obj.hqProcessed === false) {
        obj.hqProcessed = true; changed = true;
      }
      // Recurse
      for (const k in obj) {
        if (obj[k] && typeof obj[k] === 'object') deepPatch(obj[k], depth + 1);
      }
    }

    deepPatch(parsed, 0);

    if (changed) {
      const result = JSON.stringify(parsed);
      console.log('[EncodeX] transform patched, body length:', result.length);
      if (result.length < 50000) console.log('[EncodeX] patched:', result.substr(0, 2000));
      return res.json({ body: result });
    }
    console.log('[EncodeX] transform no changes needed');
    return res.json({ body: rawBody });
  } catch(e) {
    console.error('[EncodeX] transform error:', e.message);
    if (req.body && req.body.body) return res.json({ body: req.body.body });
    return res.json({ body: '' });
  }
});

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

// Middleware that accepts either JWT or upload_token
async function authOptional(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ ok: false, error: 'No token' });
  const token = header.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    req.authType = 'jwt';
    return next();
  } catch (e) {}
  try {
    const up = await pool.query('SELECT * FROM tokens WHERE token_value = $1 AND token_type = $2', [token, 'upload']);
    if (up.rows.length > 0) {
      req.jobId = up.rows[0].job_id;
      req.userId = up.rows[0].user_id;
      req.authType = 'upload_token';
      return next();
    }
  } catch (e) {}
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

    await pool.query(
      'INSERT INTO tokens (token_value, token_type, job_id, user_id) VALUES ($1, $2, $3, $4)',
      [uploadToken, 'upload', jobId, req.userId]
    );
    await pool.query(
      'INSERT INTO tokens (token_value, token_type, job_id, user_id) VALUES ($1, $2, $3, $4)',
      [usageToken, 'usage', jobId, req.userId]
    );
    await pool.query(
      'INSERT INTO jobs (id, user_id, upload_token, usage_token, file_size, usage_data) VALUES ($1, $2, $3, $4, $5, $6)',
      [jobId, req.userId, uploadToken, usageToken, file_size || 0, JSON.stringify(usage)]
    );

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
app.post('/api/process/upload', (req, res) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ ok: false, error: 'No token' });
  const token = header.replace('Bearer ', '');

  pool.query('SELECT * FROM tokens WHERE token_value = $1 AND token_type = $2', [token, 'upload'])
    .then(function(result) {
      if (result.rows.length === 0) return res.status(401).json({ ok: false, error: 'Invalid token' });
      const tokenRow = result.rows[0];
      const targetJobId = tokenRow.job_id;

      return pool.query('SELECT * FROM jobs WHERE id = $1', [targetJobId])
        .then(function(jr) {
          if (jr.rows.length === 0) return res.status(404).json({ ok: false, error: 'Job not found' });
          const jobRow = jr.rows[0];

          upload.single('video')(req, res, function(err) {
            if (err) return res.status(400).json({ ok: false, error: err.message });
            if (!req.file) return res.status(400).json({ ok: false, error: 'No file' });

            const usage = typeof jobRow.usage_data === 'string' ? JSON.parse(jobRow.usage_data) : (jobRow.usage_data || {});
            const limits = (usage.limits || { maxSizeMB: 30 });
            const maxBytes = limits.maxSizeMB * 1024 * 1024;

            if (req.file.size > maxBytes) {
              fs.unlink(req.file.path, () => {});
              return res.status(413).json({ ok: false, error: `Max ${limits.maxSizeMB} MB` });
            }

            const outputPath = path.join(TMP, `processed_${jobRow.id}.mp4`);
            const inputPath = req.file.path;

            pool.query(
              'UPDATE jobs SET input_path = $1, output_path = $2, status = $3, progress = $4 WHERE id = $5',
              [inputPath, outputPath, 10, 18, jobRow.id]
            ).then(function() {
              runFFmpegPipeline(jobRow.id, inputPath, outputPath);
            }).catch(function(e) {
              console.error('DB update error:', e.message);
            });

            res.json({ ok: true, job_id: jobRow.id });
          });
        });
    })
    .catch(function(e) {
      res.status(500).json({ ok: false, error: e.message });
    });
});

async function execFFmpeg(jobId, args, duration) {
  console.log('[EncodeX] FFmpeg:', ffmpegPath, args.join(' '));
  const proc = spawn(ffmpegPath, args);
  let stderr = '';
  let killed = false;
  const timeout = setTimeout(() => { killed = true; proc.kill('SIGKILL'); }, 600000);
  const interval = setInterval(async () => {
    const cur = await pool.query('SELECT status FROM jobs WHERE id = $1', [jobId]);
    if (!cur.rows[0] || cur.rows[0].status >= 200) { clearInterval(interval); return; }
    const m = stderr.match(/time=\s*(\d+):(\d+):(\d+\.\d+)/);
    if (m && duration > 0) {
      const s = parseInt(m[1])*3600 + parseInt(m[2])*60 + parseFloat(m[3]);
      await pool.query('UPDATE jobs SET progress = $1 WHERE id = $2', [Math.round(Math.min(88, 30 + (s/duration)*58)), jobId]);
    }
  }, 2000);
  proc.stderr.on('data', d => {
    stderr += d.toString();
    const m = d.toString().match(/time=\s*(\d+):(\d+):(\d+\.\d+)/);
    if (m && duration > 0) {
      const s = parseInt(m[1])*3600 + parseInt(m[2])*60 + parseFloat(m[3]);
      pool.query('UPDATE jobs SET progress = $1 WHERE id = $2', [Math.round(Math.min(88, 30 + (s/duration)*58)), jobId]);
    }
  });
  return new Promise((resolve, reject) => {
    proc.on('close', (code, signal) => {
      clearTimeout(timeout); clearInterval(interval);
      if (killed) { reject(new Error('ffmpeg timed out')); return; }
      if (code === 0) resolve();
      else {
        let msg = 'ffmpeg exited with code ' + code;
        if (signal) msg += ' signal=' + signal;
        msg += ': ' + stderr.split('\n').slice(-3).join('\n');
        reject(new Error(msg));
      }
    });
    proc.on('error', (err) => { clearTimeout(timeout); clearInterval(interval); reject(err); });
  });
}



async function runFFmpegPipeline(jobId, inputPath, outputPath) {
  try {
    await pool.query('UPDATE jobs SET status = $1, progress = $2 WHERE id = $3', [20, 24, jobId]);

    const analyze = spawn(ffprobePath, [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      inputPath
    ]);
    let analyzeOut = '';
    analyze.stdout.on('data', d => { analyzeOut += d.toString(); });

    await new Promise((resolve, reject) => {
      analyze.on('close', code => code === 0 ? resolve() : reject(new Error('ffprobe failed')));
      analyze.on('error', reject);
    });

    let fps = 30;
    let width = 0;
    let height = 0;
    let codec = '';
    let duration = 0;
    try {
      const info = JSON.parse(analyzeOut);
      const vs = info.streams.find(s => s.codec_type === 'video');
      if (vs) {
        width = vs.width || 0;
        height = vs.height || 0;
        codec = vs.codec_name || '';
        // avg_frame_rate is more reliable than r_frame_rate for VFR
        let rateStr = vs.avg_frame_rate || vs.r_frame_rate || '30/1';
        const parts = rateStr.split('/');
        const num = parseFloat(parts[0]);
        const den = parseFloat(parts[1]) || 1;
        if (num > 0 && den > 0) fps = Math.round(num / den);
        if (fps < 1 || fps > 240) fps = 30;
      }
      if (info.format && info.format.duration) {
        duration = parseFloat(info.format.duration);
      }
    } catch (e) {}

    console.log('[EncodeX] source:', width + 'x' + height, codec, fps + 'fps', duration + 's');

    await pool.query(
      'UPDATE jobs SET status = $1, progress = $2, duration = $3, analyzed_fps = $4 WHERE id = $5',
      [30, 30, duration, fps, jobId]
    );

    // Масштабируем временные метки PTS: fps -> 30fps
    // -itsscale N умножает PTS всех пакетов на N (без ре-энкода, -c copy)
    // TikTok видит 30fps → не запускает frame-drop → не ресайзит до 576p
    let itsscale = 1;
    if (fps >= 60) itsscale = Math.round(fps / 30);
    if (itsscale < 2) itsscale = 1; // не трогаем если уже ≤30fps
    console.log('[EncodeX] itsscale:', width + 'x' + height, fps + 'fps -> ~30fps (itsscale=' + itsscale + ')');
    const remuxArgs = ['-y', '-itsscale', String(itsscale), '-i', inputPath, '-c', 'copy', '-movflags', '+faststart', outputPath];
    await execFFmpeg(jobId, remuxArgs, duration);

    await pool.query('UPDATE jobs SET status = $1, progress = $2 WHERE id = $3', [40, 92, jobId]);
    await new Promise(r => setTimeout(r, 500));
    await pool.query('UPDATE jobs SET status = $1, progress = $2 WHERE id = $3', [200, 100, jobId]);

  } catch (e) {
    console.error('FFmpeg pipeline error:', e.message);
    await pool.query('UPDATE jobs SET status = $1, error = $2 WHERE id = $3', [500, e.message, jobId]);
  }
}

// ---- STATUS (public, auth by job_id UUID) ----
app.get('/api/process/status', async (req, res) => {
  try {
    const jobId = req.query.job_id;
    if (!jobId) return res.status(400).json({ ok: false, error: 'No job_id' });
    const r = await pool.query('SELECT status, progress, error FROM jobs WHERE id = $1', [jobId]);
    if (r.rows.length === 0) return res.status(404).json({ ok: false, error: 'Job not found' });
    const job = r.rows[0];
    let resp = { ok: true, status: job.status };
    if (job.status === 30) resp.progress = job.progress;
    if (job.status >= 400) resp.error = job.error;
    res.json(resp);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ---- RESULT (public, auth by job_id UUID) ----
app.get('/api/process/result', async (req, res) => {
  try {
    const jobId = req.query.job_id;
    if (!jobId) return res.status(400).json({ ok: false, error: 'No job_id' });
    const r = await pool.query('SELECT * FROM jobs WHERE id = $1', [jobId]);
    if (r.rows.length === 0) return res.status(404).json({ ok: false, error: 'Job not found' });
    const job = r.rows[0];
    if (job.status !== 200) return res.status(400).json({ ok: false, error: 'Job not ready' });
    if (!job.output_path) return res.status(400).json({ ok: false, error: 'No output file' });

    res.download(job.output_path, 'video.mp4', async function(err) {
      if (err) console.error('Download error:', err.message);
      // Clean up files
      if (job.input_path) fs.unlink(job.input_path, () => {});
      if (job.output_path) fs.unlink(job.output_path, () => {});
      // Clean up tokens
      await pool.query('DELETE FROM tokens WHERE job_id = $1', [jobId]);
      // Clean up job after 5 min
      setTimeout(async () => {
        await pool.query('DELETE FROM jobs WHERE id = $1', [jobId]);
      }, 300000);
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ---- COMMIT (by usage_token, charged AFTER TikTok upload succeeds) ----
app.post('/api/process/commit', auth, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ ok: false, error: 'token required' });

    const ut = await pool.query(
      'SELECT * FROM tokens WHERE token_value = $1 AND token_type = $2',
      [token, 'usage']
    );
    if (ut.rows.length === 0) return res.status(404).json({ ok: false, error: 'USAGE_TOKEN_NOT_FOUND' });
    const usageTokenRow = ut.rows[0];
    if (usageTokenRow.used) return res.status(400).json({ ok: false, error: 'Token already used' });
    if (usageTokenRow.user_id !== req.userId) return res.status(403).json({ ok: false, error: 'Forbidden' });

    await pool.query('UPDATE tokens SET used = true WHERE token_value = $1', [token]);

    // Find job by usage token and update usage counters
    const jobR = await pool.query('SELECT * FROM jobs WHERE usage_token = $1', [token]);
    if (jobR.rows.length > 0) {
      const job = jobR.rows[0];
      const usage = typeof job.usage_data === 'string' ? JSON.parse(job.usage_data) : (job.usage_data || {});
      usage.uploadsToday = (usage.uploadsToday || 0) + 1;
      usage.uploadsThisWeek = (usage.uploadsThisWeek || 0) + 1;
      await commitUsage(req.userId, usage);
      await pool.query('UPDATE jobs SET usage_data = $1 WHERE id = $2', [JSON.stringify(usage), job.id]);
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

/* ===== Check FFmpeg capabilities ===== */
function checkFFmpeg() {
  const check = spawn(ffmpegPath, ['-encoders']);
  let out = '';
  check.stdout.on('data', d => { out += d.toString(); });
  check.on('close', code => {
    if (code === 0) {
      const has264 = out.includes('libx264') || out.includes('h264');
      console.log('[FFmpeg] encoders found, libx264:', has264);
    } else {
      console.warn('[FFmpeg] -encoders failed with code', code);
    }
  });
  check.on('error', err => console.error('[FFmpeg] -encoders error:', err.message));
}
checkFFmpeg();

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
