const { getDB } = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretposkey2026';

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

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const db = await getDB();
    
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(401).json({ message: 'Username atau password salah' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Username atau password salah' });
    }

    const payload = { 
      id: user.id, 
      role: user.role, 
      username: user.username,
      business_id: user.business_id,
      toko_id: user.toko_id
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: payload });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message, stack: error.stack });
  }
};

// GET /api/auth/me - Verify token & return user info
exports.me = async (req, res) => {
  try {
    const db = await getDB();
    const user = await db.get('SELECT id, username, role, business_id, toko_id, created_at FROM users WHERE id = ?', [req.user.id]);
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
    const { username, password, nama_klien } = req.body;
    if (!username || !password || !nama_klien) return res.status(400).json({ message: 'Username, password, dan nama klien wajib diisi' });

    const db = await getDB();
    const existing = await db.get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) return res.status(400).json({ message: 'Username sudah digunakan' });

    const password_hash = await bcrypt.hash(password, 10);
    
    // Create Business
    const bizRes = await db.run('INSERT INTO business (nama_klien) VALUES (?) RETURNING id', [nama_klien]);
    const business_id = bizRes.lastID || (await db.get("SELECT MAX(id) as id FROM business")).id;

    // Create Super Admin user
    const result = await db.run(
      'INSERT INTO users (username, password_hash, role, business_id) VALUES (?, ?, ?, ?) RETURNING id',
      [username, password_hash, 'superadmin', business_id]
    );
    const user_id = result.lastID || (await db.get("SELECT MAX(id) as id FROM users")).id;

    res.status(201).json({ message: 'Pendaftaran berhasil. Silakan login.', user_id });
  } catch (error) {
    console.error('Register Public error:', error);
    res.status(500).json({ message: 'Internal server error' });
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

    res.status(201).json({ message: 'User berhasil dibuat' });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Internal server error' });
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
    res.json({ message: 'User berhasil dihapus' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.verifyToken = verifyToken;
exports.ownerOnly = ownerOnly;
exports.superAdminOnly = superAdminOnly;
