const { getDB } = require('../db');

exports.getToko = async (req, res) => {
  try {
    const db = await getDB();
    if (req.user.role === 'superadmin') {
      const tokos = await db.all('SELECT * FROM toko WHERE business_id = ? ORDER BY created_at DESC', [req.user.business_id]);
      res.json(tokos);
    } else if (req.user.role === 'toko' || req.user.role === 'kasir') {
      const toko = await db.get('SELECT * FROM toko WHERE id = ?', [req.user.toko_id]);
      res.json(toko);
    } else if (req.user.role === 'owner') {
      const tokos = await db.all('SELECT t.*, b.nama_klien FROM toko t JOIN business b ON t.business_id = b.id ORDER BY t.created_at DESC');
      res.json(tokos);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching toko data' });
  }
};

exports.updateToko = async (req, res) => {
  try {
    const { id } = req.params;
    const { nama_toko, logo, alamat, no_hp } = req.body;
    
    // Auth check
    if (req.user.role === 'toko' && parseInt(id) !== req.user.toko_id) {
      return res.status(403).json({ message: 'Akses ditolak' });
    }
    
    const db = await getDB();
    const toko = await db.get('SELECT business_id FROM toko WHERE id = ?', [id]);
    if (!toko) return res.status(404).json({ message: 'Toko tidak ditemukan' });
    
    if (req.user.role === 'superadmin' && toko.business_id !== req.user.business_id) {
      return res.status(403).json({ message: 'Akses ditolak' });
    }

    await db.run(
      'UPDATE toko SET nama_toko = ?, logo = ?, alamat = ?, no_hp = ? WHERE id = ?',
      [nama_toko, logo, alamat, no_hp, id]
    );

    res.json({ message: 'Profil toko berhasil diupdate' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating toko' });
  }
};
