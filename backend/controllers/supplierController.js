const { getDB } = require('../db');

exports.getSuppliers = async (req, res) => {
  try {
    const db = await getDB();
    const rows = await db.all('SELECT * FROM supplier WHERE business_id = ? ORDER BY nama_supplier ASC', [req.user.business_id]);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching suppliers' });
  }
};

exports.createSupplier = async (req, res) => {
  try {
    const { nama_supplier } = req.body;
    if (!nama_supplier) return res.status(400).json({ message: 'Nama supplier is required' });

    const db = await getDB();
    let req_toko_id = req.user.role === 'superadmin' ? null : req.user.toko_id;
    
    // Check if supplier exists for this business
    const existing = await db.get('SELECT id FROM supplier WHERE nama_supplier ILIKE ? AND business_id = ?', [nama_supplier.trim(), req.user.business_id]);
    if (existing) {
      return res.status(400).json({ message: 'Supplier sudah ada di bisnis ini' });
    }

    const result = await db.run('INSERT INTO supplier (nama_supplier, business_id, toko_id) VALUES (?, ?, ?) RETURNING id', [nama_supplier.trim(), req.user.business_id, req_toko_id]);
    res.status(201).json({ id: result.lastID, message: 'Supplier created' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating supplier' });
  }
};
