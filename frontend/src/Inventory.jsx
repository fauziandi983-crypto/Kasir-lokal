import React, { useState, useEffect } from 'react';
import axios from 'axios';
import BarcodeScanner from './components/BarcodeScanner';

const API_URL = '/api';

const SATUAN_OPTIONS = ['Dus', 'Karung', 'Lusin', 'Pack', 'Pcs', 'Kg', 'Liter', 'Gram', 'Buah', 'Sachet', 'Botol', 'Bungkus'];

function Inventory() {
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [activeForm, setActiveForm] = useState('list'); // 'list', 'new', 'restock'
  const [searchQuery, setSearchQuery] = useState('');
  
  // Scanner state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanTarget, setScanTarget] = useState(null);

  // Searchable dropdown for Restock
  const [restockSearch, setRestockSearch] = useState('');
  const [isRestockDropdownOpen, setIsRestockDropdownOpen] = useState(false);

  // Riwayat Harga Modal
  const [riwayatModalOpen, setRiwayatModalOpen] = useState(false);
  const [riwayatBarang, setRiwayatBarang] = useState(null);
  const [riwayatData, setRiwayatData] = useState([]);

  // Form for New Product
  const [newProduct, setNewProduct] = useState({
    kode_barang: '', nama_barang: '', kategori: '', satuan_utama: '', satuan_pecahan: '',
    multiplier_konversi: '', harga_beli: '', harga_jual_ecer: '',
    harga_jual_grosir: '', min_beli_grosir: '', stok_awal_referensi: '',
    stok_minimum: '', nama_supplier: ''
  });

  // Form for New Batch (Restock)
  const [newBatch, setNewBatch] = useState({
    barang_id: '', barcode_batch: '', stok_batch: '', tgl_masuk: new Date().toISOString().split('T')[0], tgl_expired: '',
    supplier_id: '', harga_beli_aktual: ''
  });

  const [editingPriceId, setEditingPriceId] = useState(null);
  const [editHargaBeli, setEditHargaBeli] = useState('');
  const [editHargaEcer, setEditHargaEcer] = useState('');
  const [editHargaGrosir, setEditHargaGrosir] = useState('');

  const fetchProducts = () => {
    axios.get(`${API_URL}/barang`).then(res => setProducts(res.data)).catch(console.error);
  };

  const fetchSuppliers = () => {
    axios.get(`${API_URL}/supplier`).then(res => setSuppliers(res.data)).catch(console.error);
  };

  useEffect(() => {
    fetchProducts();
    if (activeForm === 'restock') {
      fetchSuppliers();
    }
  }, [activeForm]);

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/barang`, {
        ...newProduct,
        multiplier_konversi: parseFloat(newProduct.multiplier_konversi),
        harga_beli: parseFloat(newProduct.harga_beli),
        harga_jual_ecer: parseFloat(newProduct.harga_jual_ecer),
        harga_jual_grosir: parseFloat(newProduct.harga_jual_grosir),
        min_beli_grosir: parseFloat(newProduct.min_beli_grosir),
        stok_awal_referensi: parseFloat(newProduct.stok_awal_referensi),
        stok_minimum: parseFloat(newProduct.stok_minimum || 0)
      });
      alert('Produk berhasil ditambahkan!');
      setActiveForm('list');
      setNewProduct({
        kode_barang: '', nama_barang: '', kategori: '', satuan_utama: '', satuan_pecahan: '',
        multiplier_konversi: '', harga_beli: '', harga_jual_ecer: '',
        harga_jual_grosir: '', min_beli_grosir: '', stok_awal_referensi: '',
        stok_minimum: '', nama_supplier: ''
      });
    } catch (err) {
      alert('Gagal menambah produk: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleAddBatch = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/barang/${newBatch.barang_id}/batches`, {
        barcode_batch: newBatch.barcode_batch,
        stok_batch: parseFloat(newBatch.stok_batch),
        tgl_masuk: newBatch.tgl_masuk,
        tgl_expired: newBatch.tgl_expired,
        supplier_id: newBatch.supplier_id || null,
        harga_beli_aktual: parseFloat(newBatch.harga_beli_aktual) || null
      });
      alert('Stok Batch berhasil ditambahkan!');
      setActiveForm('list');
      setNewBatch({ barang_id: '', barcode_batch: '', stok_batch: '', tgl_masuk: new Date().toISOString().split('T')[0], tgl_expired: '', supplier_id: '', harga_beli_aktual: '' });
    } catch (err) {
      alert('Gagal menambah batch: ' + (err.response?.data?.message || err.message));
    }
  };

  const openRiwayat = async (barang) => {
    setRiwayatBarang(barang);
    setRiwayatModalOpen(true);
    try {
      const res = await axios.get(`${API_URL}/barang/${barang.id}/riwayat-harga`);
      setRiwayatData(res.data);
    } catch (err) {
      console.error(err);
      alert('Gagal memuat riwayat harga');
    }
  };

  const handleBarangSelectForBatch = (product) => {
    setNewBatch({ ...newBatch, barang_id: product.id.toString(), harga_beli_aktual: product.harga_beli || '' });
    setRestockSearch(`${product.nama_barang} (${product.satuan_pecahan})`);
    setIsRestockDropdownOpen(false);
  };

  const filteredRestockProducts = products.filter(p =>
    p.nama_barang.toLowerCase().includes(restockSearch.toLowerCase()) ||
    p.kode_barang.toLowerCase().includes(restockSearch.toLowerCase())
  );

  const selectedProduct = products.find(p => p.id === parseInt(newBatch.barang_id));
  const dateStr = newBatch.tgl_masuk ? newBatch.tgl_masuk.replace(/-/g, '') : '';
  const previewNoBatch = selectedProduct && dateStr ? `${selectedProduct.kode_barang}-${dateStr}-[AngkaAcak]` : '';

  const handleEditPriceClick = (product) => {
    setEditingPriceId(product.id);
    setEditHargaBeli(product.harga_beli);
    setEditHargaEcer(product.harga_jual_ecer);
    setEditHargaGrosir(product.harga_jual_grosir);
  };

  const handleSavePrice = async (id) => {
    try {
      await axios.put(`${API_URL}/barang/${id}/harga`, {
        harga_beli: parseFloat(editHargaBeli),
        harga_jual_ecer: parseFloat(editHargaEcer),
        harga_jual_grosir: parseFloat(editHargaGrosir)
      });
      alert('Harga berhasil diupdate!');
      setEditingPriceId(null);
      fetchProducts();
    } catch (err) {
      alert('Gagal update harga: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleInventoryScan = (scannedText) => {
    setIsScannerOpen(false);
    if (scanTarget === 'kode_barang') {
      setNewProduct(prev => ({ ...prev, kode_barang: scannedText }));
    } else if (scanTarget === 'barcode_batch') {
      setNewBatch(prev => ({ ...prev, barcode_batch: scannedText }));
    }
  };

  const filteredProducts = products.filter(p => p.nama_barang.toLowerCase().includes(searchQuery.toLowerCase()));

  // Find lowest price in history
  const minPrice = riwayatData.length > 0 ? Math.min(...riwayatData.map(r => r.harga_beli_aktual)) : null;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="pos-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', width: '100%' }}>
        <h2 style={{ marginBottom: '8px' }}>Master Data Barang</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', width: '100%' }}>
          <button 
            className={`btn ${activeForm === 'list' ? 'btn-success' : ''}`}
            onClick={() => setActiveForm('list')}
            style={{ flex: '1 1 auto', background: activeForm === 'list' ? '' : 'var(--panel-border)', color: activeForm === 'list' ? '' : 'var(--text-primary)' }}
          >
            Daftar Barang
          </button>
          <button 
            className={`btn ${activeForm === 'new' ? 'btn-success' : ''}`}
            onClick={() => setActiveForm('new')}
            style={{ flex: '1 1 auto', background: activeForm === 'new' ? '' : 'var(--panel-border)', color: activeForm === 'new' ? '' : 'var(--text-primary)' }}
          >
            + Master Baru
          </button>
          <button 
            className={`btn ${activeForm === 'restock' ? 'btn-success' : ''}`}
            onClick={() => setActiveForm('restock')}
            style={{ flex: '1 1 auto', background: activeForm === 'restock' ? '' : 'var(--panel-border)', color: activeForm === 'restock' ? '' : 'var(--text-primary)' }}
          >
            + Restock (Batch)
          </button>
        </div>
      </div>

      <div className="glass-panel" style={{ flex: 1, overflowY: 'auto', padding: activeForm === 'list' ? '0' : '24px' }}>
        {activeForm === 'list' && (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%' }}>
            <input 
              type="text" 
              placeholder="🔍 Cari nama barang..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ marginBottom: '16px', maxWidth: '400px' }}
            />
            <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Nama Barang</th>
                    <th>Supplier</th>
                    <th>Harga Pokok / Modal</th>
                    <th>Harga Jual</th>
                    <th style={{ textAlign: 'right' }}>Total Stok</th>
                    <th style={{ textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map(p => {
                    const isLowStock = p.total_stok <= p.stok_minimum;
                    return (
                      <tr key={p.id}>
                        <td>{p.kode_barang}</td>
                        <td style={{ fontWeight: 'bold' }}>
                          {p.nama_barang}
                          <br/><span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'normal' }}>{p.kategori}</span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{p.nama_supplier || '-'}</td>
                        
                        {editingPriceId === p.id ? (
                          <>
                            <td>
                              <input type="number" value={editHargaBeli} onChange={e => setEditHargaBeli(e.target.value)} style={{ width: '100px', padding: '6px' }} placeholder="Modal" />
                            </td>
                            <td>
                              <input type="number" value={editHargaEcer} onChange={e => setEditHargaEcer(e.target.value)} style={{ width: '100px', padding: '6px' }} placeholder="Ecer" />
                              <br/><input type="number" value={editHargaGrosir} onChange={e => setEditHargaGrosir(e.target.value)} style={{ width: '100px', padding: '6px', marginTop: '4px' }} placeholder="Grosir" />
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ color: 'var(--text-secondary)' }}>
                              Rp{p.harga_beli.toLocaleString()}
                            </td>
                            <td>
                              Rp{p.harga_jual_ecer.toLocaleString()}
                              <br/><span style={{ fontSize: '11px', color: 'var(--success)' }}>Grosir: Rp{p.harga_jual_grosir.toLocaleString()}</span>
                            </td>
                          </>
                        )}

                        <td style={{ textAlign: 'right' }}>
                          <span style={{ fontWeight: 'bold', color: isLowStock ? '#ef4444' : 'var(--accent)' }}>
                            {p.total_stok} <span style={{ fontSize: '12px', fontWeight: 'normal' }}>{p.satuan_pecahan}</span>
                          </span>
                          {isLowStock && <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px' }}>⚠️ Perlu Restock</div>}
                        </td>
                        
                        <td style={{ textAlign: 'center' }}>
                          {editingPriceId === p.id ? (
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              <button className="btn btn-success" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => handleSavePrice(p.id)}>Simpan</button>
                              <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => setEditingPriceId(null)}>Batal</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              <button className="btn" style={{ padding: '4px 8px', fontSize: '12px', background: '#64748b', color: 'white', border: 'none' }} onClick={() => openRiwayat(p)}>Riwayat Harga</button>
                              <button className="btn" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => handleEditPriceClick(p)}>Edit Harga</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeForm === 'new' && (
          <form className="grid-1fr-1fr" onSubmit={handleAddProduct} style={{ display: 'grid', gap: '16px' }}>
            <h3 style={{ gridColumn: '1 / -1', marginBottom: '16px' }}>Data Barang Baru</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Kode Barang</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input required placeholder="mis. BRG-001" value={newProduct.kode_barang} onChange={e => setNewProduct({...newProduct, kode_barang: e.target.value})} style={{ flex: 1 }} />
                <button type="button" className="btn btn-success btn-icon" onClick={() => { setScanTarget('kode_barang'); setIsScannerOpen(true); }} title="Scan Barcode">📷</button>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Nama Barang</label>
              <input required placeholder="Ketik nama barang..." value={newProduct.nama_barang} onChange={e => setNewProduct({...newProduct, nama_barang: e.target.value})} />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Kategori</label>
              <input placeholder="mis. Snack, Sembako" value={newProduct.kategori} onChange={e => setNewProduct({...newProduct, kategori: e.target.value})} />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Nama Supplier Default</label>
              <input placeholder="Opsional" value={newProduct.nama_supplier} onChange={e => setNewProduct({...newProduct, nama_supplier: e.target.value})} title="Bisa dikosongkan jika belum tahu. Jika nama belum ada, sistem akan membuatkan otomatis." />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Satuan Utama</label>
              <select required value={newProduct.satuan_utama} onChange={e => setNewProduct({...newProduct, satuan_utama: e.target.value})}>
                <option value="" disabled>-- Pilih --</option>
                {SATUAN_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Satuan Pecahan (Terkecil)</label>
              <select required value={newProduct.satuan_pecahan} onChange={e => setNewProduct({...newProduct, satuan_pecahan: e.target.value})}>
                <option value="" disabled>-- Pilih --</option>
                {SATUAN_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Konversi (1 Utama = ? Pecahan)</label>
              <input required type="number" step="0.01" placeholder="mis. 12" value={newProduct.multiplier_konversi} onChange={e => setNewProduct({...newProduct, multiplier_konversi: e.target.value})} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Harga Modal / Beli</label>
              <input required type="number" step="0.01" placeholder="Rp..." value={newProduct.harga_beli} onChange={e => setNewProduct({...newProduct, harga_beli: e.target.value})} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Harga Jual Eceran</label>
              <input required type="number" step="0.01" placeholder="Rp..." value={newProduct.harga_jual_ecer} onChange={e => setNewProduct({...newProduct, harga_jual_ecer: e.target.value})} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Harga Jual Grosir</label>
              <input required type="number" step="0.01" placeholder="Rp..." value={newProduct.harga_jual_grosir} onChange={e => setNewProduct({...newProduct, harga_jual_grosir: e.target.value})} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Min. Beli utk Grosir</label>
              <input required type="number" step="0.01" placeholder="Dlm satuan terkecil" value={newProduct.min_beli_grosir} onChange={e => setNewProduct({...newProduct, min_beli_grosir: e.target.value})} />
            </div>
            
            <div style={{ display: 'flex', gap: '16px', gridColumn: '1 / -1', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 150px' }}>
                <label style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Stok Awal Referensi</label>
                <input required type="number" step="0.01" placeholder="0" value={newProduct.stok_awal_referensi} onChange={e => setNewProduct({...newProduct, stok_awal_referensi: e.target.value})} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 150px' }}>
                <label style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Stok Minimum (Alert)</label>
                <input type="number" step="0.01" placeholder="0" value={newProduct.stok_minimum} onChange={e => setNewProduct({...newProduct, stok_minimum: e.target.value})} title="Jika stok di bawah ini, akan muncul peringatan Restock" />
              </div>
            </div>

            <div style={{ gridColumn: '1 / -1', marginTop: '8px' }}>
              <button type="submit" className="btn btn-success" style={{ width: '100%', padding: '14px', fontSize: '16px' }}>💾 Simpan Data Barang</button>
            </div>
          </form>
        )}

        {activeForm === 'restock' && (
          <form onSubmit={handleAddBatch} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px' }}>
            <h3 style={{ marginBottom: '16px' }}>Penerimaan Barang (Batch Baru)</h3>

            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="🔍 Cari atau pilih barang..."
                value={restockSearch}
                onChange={e => { setRestockSearch(e.target.value); setIsRestockDropdownOpen(true); if (!e.target.value) setNewBatch({...newBatch, barang_id: ''}); }}
                onFocus={() => setIsRestockDropdownOpen(true)}
                style={{ width: '100%', color: 'black' }}
              />
              {isRestockDropdownOpen && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                  background: 'var(--panel-bg, white)', border: '1px solid var(--border-color, #e2e8f0)',
                  borderRadius: '8px', boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
                  maxHeight: '200px', overflowY: 'auto', marginTop: '4px'
                }}>
                  {filteredRestockProducts.length === 0 ? (
                    <div style={{ padding: '12px', color: '#94a3b8', textAlign: 'center' }}>Tidak ada barang ditemukan</div>
                  ) : (
                    filteredRestockProducts.map(p => (
                      <div key={p.id}
                        onMouseDown={() => handleBarangSelectForBatch(p)}
                        style={{
                          padding: '10px 14px', cursor: 'pointer',
                          borderBottom: '1px solid rgba(0,0,0,0.05)',
                          background: newBatch.barang_id === p.id.toString() ? 'rgba(16, 185, 129, 0.1)' : 'transparent'
                        }}
                        onMouseEnter={e => e.target.style.background = 'rgba(16, 185, 129, 0.08)'}
                        onMouseLeave={e => e.target.style.background = newBatch.barang_id === p.id.toString() ? 'rgba(16, 185, 129, 0.1)' : 'transparent'}
                      >
                        <div style={{ fontWeight: 600 }}>{p.nama_barang} ({p.satuan_pecahan})</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>{p.kode_barang}</div>
                      </div>
                    ))
                  )}
                </div>
              )}
              <input type="hidden" required value={newBatch.barang_id} />
            </div>

            <div className="grid-1fr-1fr" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Supplier</label>
                <select value={newBatch.supplier_id} onChange={e => setNewBatch({...newBatch, supplier_id: e.target.value})} style={{ color: 'black' }}>
                  <option value="">-- Tidak Diketahui / Lewati --</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.nama_supplier}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Harga Beli Aktual (Modal)</label>
                <input required type="number" step="0.01" placeholder="Harga Beli saat ini" value={newBatch.harga_beli_aktual} onChange={e => setNewBatch({...newBatch, harga_beli_aktual: e.target.value})} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Tanggal Masuk (Restock)</label>
              <input required type="date" value={newBatch.tgl_masuk} onChange={e => setNewBatch({...newBatch, tgl_masuk: e.target.value})} />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Nomor Batch (Otomatis Dibuat Sistem)</label>
              <input disabled value={previewNoBatch} placeholder="Pilih barang dan tanggal masuk dulu..." style={{ background: '#e2e8f0', color: '#64748b' }} />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input placeholder="Barcode Batch (Opsional)" value={newBatch.barcode_batch} onChange={e => setNewBatch({...newBatch, barcode_batch: e.target.value})} style={{ flex: 1 }} />
              <button type="button" className="btn btn-success btn-icon" onClick={() => { setScanTarget('barcode_batch'); setIsScannerOpen(true); }} title="Scan Barcode">📷</button>
            </div>
            <input required type="number" step="0.01" placeholder="Kuantitas Masuk (Dlm Satuan Pecahan terkecil)" value={newBatch.stok_batch} onChange={e => setNewBatch({...newBatch, stok_batch: e.target.value})} />
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Tanggal Kedaluwarsa (Expired Date)</label>
              <input required type="date" value={newBatch.tgl_expired} onChange={e => setNewBatch({...newBatch, tgl_expired: e.target.value})} />
            </div>

            <button type="submit" className="btn btn-success" style={{ marginTop: '16px' }}>Simpan Stok Batch</button>
          </form>
        )}
      </div>

      {/* Riwayat Harga Modal */}
      {riwayatModalOpen && (
        <div className="receipt-overlay">
          <div className="receipt-modal" style={{ width: '500px', maxWidth: '90%' }}>
            <h2 style={{ marginBottom: '16px' }}>Riwayat Harga Beli</h2>
            <p style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>Barang: <strong style={{ color: 'black' }}>{riwayatBarang?.nama_barang}</strong></p>
            
            <div className="table-container" style={{ maxHeight: '300px' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tanggal Masuk</th>
                    <th>Supplier</th>
                    <th style={{ textAlign: 'right' }}>Harga Modal</th>
                  </tr>
                </thead>
                <tbody>
                  {riwayatData.length === 0 ? (
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'center', padding: '16px' }}>Belum ada riwayat batch dengan harga.</td>
                    </tr>
                  ) : (
                    riwayatData.map(r => {
                      const isCheapest = r.harga_beli_aktual === minPrice;
                      return (
                        <tr key={r.id} style={{ background: isCheapest ? '#dcfce3' : 'transparent' }}>
                          <td>{new Date(r.tgl_masuk).toLocaleDateString()}</td>
                          <td>{r.nama_supplier || '-'}</td>
                          <td style={{ textAlign: 'right', fontWeight: isCheapest ? 'bold' : 'normal', color: isCheapest ? '#166534' : 'inherit' }}>
                            Rp{r.harga_beli_aktual.toLocaleString()}
                            {isCheapest && <span style={{ marginLeft: '8px', fontSize: '10px', background: '#166534', color: 'white', padding: '2px 4px', borderRadius: '4px' }}>Termurah</span>}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '24px', textAlign: 'right' }}>
              <button className="btn" onClick={() => setRiwayatModalOpen(false)}>Tutup</button>
            </div>
          </div>
        </div>
      )}

      {isScannerOpen && (
        <BarcodeScanner 
          onScan={handleInventoryScan} 
          onClose={() => setIsScannerOpen(false)} 
        />
      )}
    </div>
  );
}

export default Inventory;
