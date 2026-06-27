const { getDB } = require('../db');

exports.getSuppliers = async (req, res) => {
  try {
    const db = await getDB();
    const rows = await db.all('SELECT * FROM supplier ORDER BY nama_supplier ASC');
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
    const result = await db.run('INSERT INTO supplier (nama_supplier) VALUES (?) RETURNING id', [nama_supplier]);
    res.status(201).json({ id: result.lastID, message: 'Supplier created' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating supplier' });
  }
};
