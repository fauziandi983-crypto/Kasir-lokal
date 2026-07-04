const { getDB } = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { logActivity } = require('../utils/logger');
const { OAuth2Client } = require('google-auth-library');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretposkey2026';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'PLACEHOLDER_CLIENT_ID';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// Konfigurasi Nodemailer (SMTP Gmail)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_EMAIL || 'email_anda@gmail.com',
    pass: process.env.SMTP_PASS || 'password_app_gmail'
  }
});


// Middleware: Verify JWT Token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token tidak ditemukan' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Contains id, username, role, business_id, toko_id
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token tidak valid atau sudah kedaluwarsa' });
  }
};

// Middleware: Only Owner (Root)
const ownerOnly = (req, res, next) => {
  if (req.user.role !== 'owner') {
    return res.status(403).json({ message: 'Hanya root owner yang bisa melakukan aksi ini' });
  }
  next();
};

// Middleware: SuperAdmin Only
const superAdminOnly = (req, res, next) => {
  if (req.user.role !== 'superadmin' && req.user.role !== 'owner') {
    return res.status(403).json({ message: 'Hanya superadmin yang bisa melakukan aksi ini' });
  }
  next();
};

// Dummy hash untuk timing attack mitigation (VULN-09)
// Selalu jalankan bcrypt.compare meskipun user tidak ditemukan, agar response time konsisten
const DUMMY_HASH = '$2a$10$abcdefghijklmnopqrstuuDummyHashForTimingNormalization111';

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const db = await getDB();
    
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    
    // VULN-09 FIX: Selalu jalankan bcrypt.compare untuk cegah timing attack
    // Jika user tidak ada, bandingkan dengan dummy hash (hasilnya selalu false)
    const hashToCompare = user ? user.password_hash : DUMMY_HASH;
    const isMatch = await bcrypt.compare(password, hashToCompare);
    
    if (!user || !isMatch) {
      return res.status(401).json({ message: 'Username atau password salah' });
    }

    const payload = { 
      id: user.id, 
      role: user.role, 
      username: user.username,
      business_id: user.business_id,
      toko_id: user.toko_id,
      email: user.email
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
    
    // Log activity (mock req.user)
    await logActivity({ user: payload }, 'LOGIN', `User ${username} berhasil login`);

    res.json({ token, user: payload });

  } catch (error) {
    // VULN-03 FIX: Jangan kirim error.stack ke client
    console.error('Login error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};

// GET /api/auth/me - Verify token & return user info
exports.me = async (req, res) => {
  try {
    const db = await getDB();
    const user = await db.get('SELECT id, username, role, business_id, toko_id, created_at, email FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }
    res.json(user);
  } catch (error) {
    console.error('Me error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /api/auth/register-public (Client Registers as Super Admin)
exports.registerPublic = async (req, res) => {
  try {
    const { username, password, nama_klien, email } = req.body;
    if (!username || !password || !nama_klien || !email) return res.status(400).json({ message: 'Username, password, nama klien, dan email wajib diisi' });

    // VULN-08 FIX: Validasi kekuatan password
    if (password.length < 8) return res.status(400).json({ message: 'Password minimal 8 karakter' });
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({ message: 'Password harus mengandung minimal 1 huruf dan 1 angka' });
    }

    const db = await getDB();
    const existing = await db.get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) return res.status(400).json({ message: 'Username sudah digunakan' });
    
    const existingEmail = await db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existingEmail) return res.status(400).json({ message: 'Email sudah digunakan' });

    const password_hash = await bcrypt.hash(password, 10);
    
    // Create Business
    const bizRes = await db.run('INSERT INTO business (nama_klien) VALUES (?) RETURNING id', [nama_klien]);
    const business_id = bizRes.lastID || (await db.get("SELECT MAX(id) as id FROM business")).id;

    // Create Super Admin user
    const result = await db.run(
      'INSERT INTO users (username, password_hash, role, business_id, email) VALUES (?, ?, ?, ?, ?) RETURNING id',
      [username, password_hash, 'superadmin', business_id, email]
    );
    const user_id = result.lastID || (await db.get("SELECT MAX(id) as id FROM users")).id;

    res.status(201).json({ message: 'Pendaftaran berhasil. Silakan login.', user_id });
  } catch (error) {
    // VULN-03 FIX: Jangan kirim detail error ke client
    console.error('Register Public error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};

// POST /api/auth/register (Create sub-users from dashboard)
exports.register = async (req, res) => {
  try {
    const { username, password, role, toko_id, nama_toko } = req.body; // toko_id for kasir, nama_toko for toko
    
    if (!username || !password) return res.status(400).json({ message: 'Username dan password wajib diisi' });

    const db = await getDB();
    const existing = await db.get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) return res.status(400).json({ message: 'Username sudah digunakan' });

    const password_hash = await bcrypt.hash(password, 10);
    const business_id = req.user.business_id;

    if (req.user.role === 'superadmin') {
      if (role === 'toko') {
        if (!nama_toko) return res.status(400).json({ message: 'Nama toko wajib diisi' });
        // Create Toko record
        const tRes = await db.run('INSERT INTO toko (business_id, nama_toko) VALUES (?, ?) RETURNING id', [business_id, nama_toko]);
        const new_toko_id = tRes.lastID || (await db.get("SELECT MAX(id) as id FROM toko")).id;
        // Create Toko user
        await db.run('INSERT INTO users (username, password_hash, role, business_id, toko_id) VALUES (?, ?, ?, ?, ?)',
          [username, password_hash, 'toko', business_id, new_toko_id]);
      } else if (role === 'kasir') {
        if (!toko_id) return res.status(400).json({ message: 'Toko ID wajib diisi untuk membuat kasir' });
        await db.run('INSERT INTO users (username, password_hash, role, business_id, toko_id) VALUES (?, ?, ?, ?, ?)',
          [username, password_hash, 'kasir', business_id, toko_id]);
      } else {
        return res.status(400).json({ message: 'Role tidak valid' });
      }
    } else if (req.user.role === 'toko') {
      if (role !== 'kasir') return res.status(403).json({ message: 'Toko hanya bisa membuat akun kasir' });
      await db.run('INSERT INTO users (username, password_hash, role, business_id, toko_id) VALUES (?, ?, ?, ?, ?)',
        [username, password_hash, 'kasir', business_id, req.user.toko_id]);
    } else {
      return res.status(403).json({ message: 'Anda tidak memiliki akses' });
    }

    await logActivity(req, 'CREATE_USER', `Membuat akun baru: ${username} (Role: ${role})`);
    res.status(201).json({ message: 'User berhasil dibuat' });
  } catch (error) {
    // VULN-03 FIX: Jangan kirim detail error ke client
    console.error('Register error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};

// GET /api/auth/users - List users within the same business
exports.getUsers = async (req, res) => {
  try {
    const db = await getDB();
    let users = [];
    if (req.user.role === 'owner') {
      users = await db.all('SELECT u.id, u.username, u.role, u.created_at, b.nama_klien, t.nama_toko FROM users u LEFT JOIN business b ON u.business_id = b.id LEFT JOIN toko t ON u.toko_id = t.id ORDER BY u.created_at DESC');
    } else if (req.user.role === 'superadmin') {
      users = await db.all("SELECT u.id, u.username, u.role, u.created_at, t.nama_toko FROM users u LEFT JOIN toko t ON u.toko_id = t.id WHERE u.business_id = ? AND u.role IN ('toko', 'kasir') ORDER BY u.created_at DESC", [req.user.business_id]);
    } else if (req.user.role === 'toko') {
      users = await db.all("SELECT id, username, role, created_at FROM users WHERE toko_id = ? AND role = 'kasir' ORDER BY created_at DESC", [req.user.toko_id]);
    }
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// DELETE /api/auth/users/:id
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (parseInt(id) === req.user.id) return res.status(400).json({ message: 'Tidak bisa menghapus akun Anda sendiri' });

    const db = await getDB();
    const targetUser = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!targetUser) return res.status(404).json({ message: 'User tidak ditemukan' });

    // Permissions check
    if (req.user.role === 'superadmin' && targetUser.business_id !== req.user.business_id) return res.status(403).json({ message: 'Akses ditolak' });
    if (req.user.role === 'toko' && targetUser.toko_id !== req.user.toko_id) return res.status(403).json({ message: 'Akses ditolak' });

    await db.run('DELETE FROM users WHERE id = ?', [id]);
    await logActivity(req, 'DELETE_USER', `Menghapus akun dengan username: ${targetUser.username}`);
    res.json({ message: 'User berhasil dihapus' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /api/auth/google
exports.googleAuth = async (req, res) => {
  try {
    const { token, nama_klien } = req.body;
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload.email;
    const name = payload.name;
    const googleId = payload.sub;

    const db = await getDB();
    let user = await db.get('SELECT * FROM users WHERE email = ? OR google_id = ?', [email, googleId]);
    
    if (user) {
      // Jika user ditemukan tapi belum ada google_id (misal emailnya sama), update google_id-nya
      if (!user.google_id) {
        await db.run('UPDATE users SET google_id = ? WHERE id = ?', [googleId, user.id]);
      }
    } else {
      // Jika user belum ada sama sekali, buatkan akun baru
      const klienName = nama_klien || name || 'Klien Baru';
      const bizRes = await db.run('INSERT INTO business (nama_klien) VALUES (?) RETURNING id', [klienName]);
      const business_id = bizRes.lastID || (await db.get("SELECT MAX(id) as id FROM business")).id;
      
      const username = email.split('@')[0];
      const password_hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 10);
      
      const result = await db.run(
        'INSERT INTO users (username, password_hash, role, business_id, email, google_id) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
        [username, password_hash, 'superadmin', business_id, email, googleId]
      );
      
      user = { id: result.lastID || (await db.get("SELECT MAX(id) as id FROM users")).id, role: 'superadmin', username, business_id, toko_id: null };
    }

    const tokenPayload = { 
      id: user.id, 
      role: user.role, 
      username: user.username,
      business_id: user.business_id,
      toko_id: user.toko_id
    };
    const jwtToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1d' });
    
    await logActivity({ user: tokenPayload }, 'LOGIN_GOOGLE', `User ${user.username} berhasil login via Google`);
    res.json({ token: jwtToken, user: tokenPayload });

  } catch (error) {
    console.error('Google Auth error:', error);
    res.status(500).json({ message: 'Autentikasi Google gagal', error: error.message });
  }
};

// POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const db = await getDB();
    
    const user = await db.get('SELECT * FROM users WHERE email = ? OR username = ?', [email, email]);
    if (!user) {
      return res.status(404).json({ message: 'Email atau username tidak ditemukan' });
    }
    
    if (!user.email) {
      return res.status(400).json({ message: 'Akun ini belum memiliki email. Harap hubungi admin.' });
    }

    // Generate token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
    
    await db.run('UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?', [resetToken, resetTokenExpiry, user.id]);
    
    // Send Email
    // Kita anggap frontend URL nya bisa diambil dari headers origin (misal http://localhost:5173 atau domain aaPanel)
    const frontendUrl = req.headers.origin || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/?reset=${resetToken}`;
    
    const mailOptions = {
      from: '"KasirUKM Admin" <no-reply@kasirukm.com>',
      to: user.email,
      subject: 'Reset Password KasirUKM',
      html: `
        <h3>Halo, ${user.username}</h3>
        <p>Kami menerima permintaan untuk mereset password akun KasirUKM Anda.</p>
        <p>Silakan klik tautan di bawah ini untuk membuat password baru:</p>
        <a href="${resetLink}" style="display:inline-block;padding:10px 15px;background:#10b981;color:white;text-decoration:none;border-radius:5px;">Reset Password</a>
        <p>Tautan ini hanya berlaku selama 1 jam.</p>
        <p>Jika Anda tidak meminta reset password, abaikan saja email ini.</p>
      `
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: 'Link reset password telah dikirim ke email Anda' });
    
  } catch (error) {
    // VULN-03 FIX: Jangan kirim detail error ke client
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Gagal mengirim email reset password' });
  }
};

// POST /api/auth/reset-password
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const db = await getDB();
    
    const user = await db.get('SELECT * FROM users WHERE reset_token = ?', [token]);
    
    if (!user) {
      return res.status(400).json({ message: 'Token tidak valid' });
    }
    
    // Check expiry
    const expiryDate = new Date(user.reset_token_expiry);
    if (new Date() > expiryDate) {
      return res.status(400).json({ message: 'Token reset password sudah kedaluwarsa' });
    }
    
    const password_hash = await bcrypt.hash(newPassword, 10);
    
    // Clear token and update password
    await db.run('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?', [password_hash, user.id]);
    
    res.json({ message: 'Password berhasil direset. Silakan login dengan password baru Anda.' });
    
  } catch (error) {
    // VULN-03 FIX: Jangan kirim detail error ke client
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};

// PUT /api/auth/update-email
exports.updateEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email wajib diisi' });
    
    const db = await getDB();
    const existing = await db.get('SELECT id FROM users WHERE email = ? AND id != ?', [email, req.user.id]);
    if (existing) return res.status(400).json({ message: 'Email sudah digunakan oleh akun lain' });

    await db.run('UPDATE users SET email = ? WHERE id = ?', [email, req.user.id]);
    res.json({ message: 'Email berhasil diperbarui' });
  } catch (error) {
    console.error('Update email error:', error);
    res.status(500).json({ message: 'Gagal memperbarui email' });
  }
};

exports.verifyToken = verifyToken;
exports.ownerOnly = ownerOnly;
exports.superAdminOnly = superAdminOnly;
