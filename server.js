// ============================================
// STARS — Node.js / Express Backend
// ============================================

const express    = require('express');
const mysql      = require('mysql2/promise');
const crypto     = require('crypto');
const jwt        = require('jsonwebtoken');
const cors       = require('cors');
const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'stars.ccs.notify@gmail.com',
    pass: 'uorlbhpzopunzhed'
  }
});

// ✅ MD5 helper
function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

const app  = express();
const PORT = process.env.PORT || 8081;
const JWT_SECRET = 'stars_secret_key_change_in_production';

// ---- MIDDLEWARE ----
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static('.'));
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});
app.use('/uploads', express.static('uploads'));

// ---- FILE UPLOAD ----
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Invalid file type.'));
  }
});

// ---- DATABASE ----
const db = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'stars_db',
  port:     process.env.DB_PORT     || 3306,
  waitForConnections: true,
  connectionLimit: 10
});

// ---- AUTH MIDDLEWARE ----
function authMiddleware(req, res, next) {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ message: 'Unauthorized' });
  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

// ============================================
// ROUTES
// ============================================

// ✅ POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ success: false, message: 'Email and password are required.' });

  try {
    const [rows] = await db.query('SELECT * FROM students WHERE email = ?', [email]);
    if (rows.length === 0)
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    const student = rows[0];

    if (password !== student.password)
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    // ✅ Generate login verification token
    const loginToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await db.query(
      'UPDATE students SET login_token=?, token_expires=? WHERE student_id=?',
      [loginToken, expires, student.student_id]
    );

    // ✅ Send verification email
    const verifyUrl = `https://stars-student.onrender.com/api/auth/verify-login?token=${loginToken}`;
    transporter.sendMail({
      from: 'STARS CCS <stars.ccs.notify@gmail.com>',
      to: student.email,
      subject: 'STARS — Confirm Your Login',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 32px; border-radius: 12px; border: 1px solid #eee;">
          <h2 style="color: #f26522;">★ STARS Login Verification</h2>
          <p>Hello, <strong>${student.full_name}</strong>!</p>
          <p>Someone is trying to log in to your STARS account.</p>
          <p>If this is you, click the button below to continue:</p>
          <a href="${verifyUrl}" style="
            display: inline-block;
            background: #f26522;
            color: white;
            padding: 12px 28px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: bold;
            font-size: 16px;
            margin: 16px 0;
          ">✅ Yes, This Is Me</a>
          <p style="color: #666;">If you did <strong>NOT</strong> try to log in, ignore this email and contact your CCS admin immediately.</p>
          <p style="color: #aaa; font-size: 12px;">⏱ This link expires in 10 minutes.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;"/>
          <p style="color: #aaa; font-size: 12px;">— STARS CCS System | College of Computer Studies</p>
        </div>
      `
    }).catch(err => console.error('Email error:', err));

    res.json({ success: true, requiresVerification: true, message: 'Check your email and click "Yes, This Is Me" to continue!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ✅ GET /api/auth/verify-login
app.get('/api/auth/verify-login', async (req, res) => {
  const { token } = req.query;
  try {
    const [rows] = await db.query(
      'SELECT * FROM students WHERE login_token=? AND token_expires > NOW()',
      [token]
    );
    if (rows.length === 0)
      return res.send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding: 60px;">
            <h2 style="color: #ef4444;">❌ Invalid or Expired Link</h2>
            <p>Please try logging in again.</p>
            <a href="https://stars-student.onrender.com" style="color: #f26522;">Go to Login</a>
          </body>
        </html>
      `);

    const student = rows[0];

    // ✅ Clear token after use
    await db.query(
      'UPDATE students SET login_token=NULL, token_expires=NULL WHERE student_id=?',
      [student.student_id]
    );

    const jwtToken = jwt.sign(
      { id: student.id, student_id: student.student_id },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    // ✅ Redirect to dashboard with token
    res.send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 60px;">
          <h2 style="color: #f26522;">✅ Verified! Redirecting...</h2>
          <p>Please wait...</p>
          <script>
            localStorage.setItem('stars_token', '${jwtToken}');
            localStorage.setItem('stars_user', JSON.stringify({
              full_name:  '${student.full_name.replace(/'/g, "\\'")}',
              student_id: '${student.student_id}',
              email:      '${student.email}',
              program:    '${student.program || ''}',
              block:      '${student.block || ''}',
              year_level: '${student.year_level || ''}'
            }));
            window.location.href = 'https://stars-student.onrender.com/dashboard.html';
          </script>
        </body>
      </html>
    `);
  } catch (err) {
    console.error(err);
    res.send(`<h2>❌ Server error. Please try again.</h2>`);
  }
});

// ✅ POST /api/students/register
app.post('/api/students/register', async (req, res) => {
  const { fullName, studentId, email, program, block, yearLevel, password } = req.body;

  if (!fullName || !studentId || !email || !password)
    return res.status(400).json({ success: false, message: 'Missing required fields.' });

  try {
    const [existing] = await db.query(
      'SELECT id FROM students WHERE student_id = ?', [studentId]
    );
    if (existing.length > 0)
      return res.status(400).json({ success: false, message: 'Student ID already registered.' });

    const [existingEmail] = await db.query(
      'SELECT id FROM students WHERE email = ?', [email]
    );
    if (existingEmail.length > 0)
      return res.status(400).json({ success: false, message: 'Email already registered.' });

    await db.query(
      `INSERT INTO students (student_id, full_name, email, program, block, year_level, password)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [studentId, fullName, email, program || '', block || '', yearLevel || '', password]
    );

    res.json({ success: true, message: 'Registration successful!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ✅ POST /api/auth/change-password
app.post('/api/auth/change-password', async (req, res) => {
  const { studentId, currentPassword, newPassword } = req.body;

  try {
    const [rows] = await db.query(
      'SELECT * FROM students WHERE student_id = ?', [studentId]
    );
    if (rows.length === 0)
      return res.status(404).json({ success: false, message: 'Student not found.' });

    const student = rows[0];

    if (currentPassword !== student.password)
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });

    await db.query(
      'UPDATE students SET password = ? WHERE student_id = ?',
      [newPassword, studentId]
    );

    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ✅ GET /api/points/:student_id
app.get('/api/points/:student_id', authMiddleware, async (req, res) => {
  try {
    const [categories] = await db.query(
      `SELECT c.category_code, c.category_name,
              COALESCE(SUM(s.points_awarded), 0) AS points_earned
       FROM categories c
       LEFT JOIN submissions s
         ON s.category_id = c.id
        AND s.student_id  = ?
        AND s.status      = 'approved'
       GROUP BY c.id`,
      [req.params.student_id]
    );

    const [totRows] = await db.query(
      `SELECT COALESCE(SUM(points_awarded), 0) AS total
       FROM submissions
       WHERE student_id = ? AND status = 'approved'`,
      [req.params.student_id]
    );

    res.json({
      success:    true,
      total:      totRows[0].total,
      categories
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ✅ GET /api/submissions/:student_id
app.get('/api/submissions/:student_id', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT s.id, s.title, s.description, s.points_requested, s.points_awarded,
              s.status, s.submitted_at, c.category_name
       FROM submissions s
       JOIN categories c ON s.category_id = c.id
       WHERE s.student_id = ?
       ORDER BY s.submitted_at DESC`,
      [req.params.student_id]
    );
    res.json({ success: true, submissions: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ✅ POST /api/submissions
app.post('/api/submissions', authMiddleware, upload.single('proof'), async (req, res) => {
  const { title, category_id, description, points_requested, pin_code } = req.body;
  const student_id = req.user.student_id;

  if (!title || !category_id || !points_requested)
    return res.status(400).json({ success: false, message: 'Missing required fields.' });

  try {
    if (parseInt(category_id) === 6) {
      if (!pin_code || pin_code.trim() === '') {
        return res.status(400).json({ success: false, message: 'PIN code is required for Lost & Found.' });
      }

      const [pinRows] = await db.query(
        'SELECT id, student_id FROM lost_found_certificates WHERE pin_code = ? AND is_used = 0',
        [pin_code.trim()]
      );

      if (pinRows.length === 0) {
        return res.status(400).json({ success: false, message: 'Invalid or already used PIN code.' });
      }

      const pin_owner = pinRows[0].student_id;
      if (pin_owner !== student_id) {
        return res.status(400).json({ success: false, message: 'This PIN does not belong to your account.' });
      }

      await db.query(
        'UPDATE lost_found_certificates SET is_used = 1, used_at = NOW() WHERE id = ?',
        [pinRows[0].id]
      );
    }

    const proof_path = req.file ? req.file.filename : null;
    await db.query(
      `INSERT INTO submissions
        (student_id, category_id, title, description, points_requested, proof_path, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [student_id, category_id, title, description || '', points_requested, proof_path]
    );
    res.json({ success: true, message: 'Submission received!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ✅ GET /api/rewards
app.get('/api/rewards', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM rewards WHERE is_active = 1 ORDER BY points_required ASC'
    );
    res.json({ success: true, rewards: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ✅ POST /api/rewards/redeem
app.post('/api/rewards/redeem', authMiddleware, async (req, res) => {
  const { rewardId } = req.body;
  const student_id = req.user.student_id;

  try {
    const [rewards] = await db.query(
      'SELECT * FROM rewards WHERE reward_id = ? AND is_active = 1', [rewardId]
    );
    if (rewards.length === 0)
      return res.json({ success: false, message: 'Reward not found.' });

    const reward = rewards[0];

    const [totRows] = await db.query(
      `SELECT COALESCE(SUM(points_awarded), 0) AS total
       FROM submissions WHERE student_id = ? AND status = 'approved'`,
      [student_id]
    );
    const balance = totRows[0].total;

    const [existing] = await db.query(
      `SELECT id FROM redemptions
       WHERE student_id = ? AND reward_id = ? AND claimed = 0`,
      [student_id, rewardId]
    );
    if (existing.length > 0)
      return res.json({ success: false, message: 'You already have a pending redemption for this reward.' });

    if (balance < reward.points_required)
      return res.json({ success: false, message: 'Not enough points.' });

    await db.query(
      'INSERT INTO redemptions (student_id, reward_id) VALUES (?, ?)',
      [student_id, rewardId]
    );
    res.json({ success: true, message: 'Reward redeemed! Show this to your coordinator.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ✅ GET /api/rewards/history/:student_id
app.get('/api/rewards/history/:student_id', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT r.reward_name, r.points_required,
              rd.redeemed_at, rd.claimed
       FROM redemptions rd
       JOIN rewards r ON rd.reward_id = r.reward_id
       WHERE rd.student_id = ?
       ORDER BY rd.redeemed_at DESC`,
      [req.params.student_id]
    );
    res.json({ success: true, history: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ✅ GET /api/ranking
app.get('/api/ranking', authMiddleware, async (req, res) => {
  try {
    const { year } = req.query;
    let query = `
      SELECT s.student_id, s.full_name, s.program, s.year_level, s.block,
             COALESCE(SUM(sub.points_awarded), 0) AS total_points
      FROM students s
      LEFT JOIN submissions sub
        ON sub.student_id = s.student_id AND sub.status = 'approved'
    `;
    const params = [];
    if (year) {
      query += ' WHERE s.year_level = ?';
      params.push(year);
    }
    query += ' GROUP BY s.student_id ORDER BY total_points DESC LIMIT 50';

    const [rows] = await db.query(query, params);
    res.json({ success: true, ranking: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ---- START ----
app.listen(PORT, () => {
  console.log(`✅ STARS backend running on http://localhost:${PORT}`);
});