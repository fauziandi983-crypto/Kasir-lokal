import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = '/api';

function MonitoringStok() {
  const [batches, setBatches] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchBatches();
  }, []);

  const fetchBatches = () => {
    axios.get(`${API_URL}/barang/monitoring`)
      .then(res => setBatches(res.data))
      .catch(console.error);
  };

  const handleBuangExpired = async () => {
    try {
      // 1. Ambil preview kerugian
      const previewRes = await axios.get(`${API_URL}/barang/preview-expired`);
      const { totalItems, totalKerugian } = previewRes.data;

      if (totalItems === 0) {
        alert('Stok aman. Tidak ada barang yang kedaluwarsa saat ini.');
        return;
      }

      // 2. Tampilkan popup konfirmasi dengan detail
      const confirmMsg = `Ditemukan ${totalItems} item yang sudah kedaluwarsa.\n\nTotal estimasi kerugian dari stok ini adalah: Rp${totalKerugian.toLocaleString('id-ID')}\n\nApakah Anda yakin ingin membuang stok ini? (Tindakan ini akan dicatat sebagai kerugian).`;
      
      if (window.confirm(confirmMsg)) {
        // 3. Eksekusi pembuangan
        const res = await axios.post(`${API_URL}/barang/buang-expired`);
        alert(res.data.message);
        fetchBatches();
      }
    } catch (err) {
      alert('Gagal memproses pembuangan stok: ' + (err.response?.data?.message || err.message));
    }
  };

  const filteredBatches = batches.filter(b => 
    b.nama_barang.toLowerCase().includes(searchQuery.toLowerCase()) || 
    b.no_batch.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="pos-header" style={{ marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, width: '100%' }}>
          <h2 style={{ marginBottom: '16px' }}>Monitoring Stok (FEFO)</h2>
          <input 
            type="text" 
            placeholder="🔍 Cari nama barang atau no batch..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--panel-border)', background: 'var(--bg-color)', color: 'var(--text-primary)' }}
          />
        </div>
        <button 
          className="btn btn-danger" 
          onClick={handleBuangExpired}
          style={{ padding: '10px 16px' }}
        >
          🗑️ Buang Stok Kedaluwarsa
        </button>
      </div>

      <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Nama Barang</th>
              <th>No Batch</th>
              <th>Tgl Masuk</th>
              <th>Tgl Kedaluwarsa (Expired)</th>
              <th style={{ textAlign: 'right' }}>Sisa Stok</th>
            </tr>
          </thead>
          <tbody>
            {filteredBatches.length === 0 ? (
              <tr><td colSpan="5" style={{ textAlign: 'center' }}>Tidak ada data batch.</td></tr>
            ) : (
              filteredBatches.map(b => {
                const isNearExpiry = new Date(b.tgl_expired) <= new Date(new Date().setDate(new Date().getDate() + 30));
                
                return (
                  <tr key={b.batch_id}>
                    <td>{b.nama_barang}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{b.no_batch}</td>
                    <td>{new Date(b.tgl_masuk).toLocaleDateString()}</td>
                    <td>
                      <span style={{ color: isNearExpiry ? 'var(--danger)' : 'inherit', fontWeight: isNearExpiry ? 'bold' : 'normal' }}>
                        {new Date(b.tgl_expired).toLocaleDateString()}
                        {isNearExpiry && ' ⚠️'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--accent)' }}>
                      {b.stok_batch} <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 'normal' }}>{b.satuan_pecahan}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default MonitoringStok;
