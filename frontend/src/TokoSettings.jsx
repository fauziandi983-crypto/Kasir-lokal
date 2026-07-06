import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = '/api';

function TokoSettings({ currentUser, onProfileUpdated }) {
  const [toko, setToko] = useState(null);
  const [formData, setFormData] = useState({
    nama_toko: '',
    logo: '',
    alamat: '',
    no_hp: ''
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API_URL}/toko`)
      .then(res => {
        setToko(res.data);
        setFormData({
          nama_toko: res.data.nama_toko || '',
          logo: res.data.logo || '',
          alamat: res.data.alamat || '',
          no_hp: res.data.no_hp || ''
        });
        setIsLoading(false);
      })
      .catch(err => {
        console.error(err);
        setIsLoading(false);
      });
  }, []);

  const [fileBarang, setFileBarang] = useState(null);
  const [fileBatch, setFileBatch] = useState(null);
  const [fileTransaksi, setFileTransaksi] = useState(null);
  const [fileDetail, setFileDetail] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/toko/${toko.id}`, formData);
      alert('Profil toko berhasil disimpan!');
      if (onProfileUpdated) onProfileUpdated();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menyimpan');
    }
  };

  const handleExport = async (type, filename) => {
    try {
      const res = await axios.get(`${API_URL}/backup/export/${type}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error(err);
      alert('Gagal mengekspor data ' + type);
    }
  };

  const handleRestoreFull = async () => {
    if (!fileBarang || !fileBatch || !fileTransaksi || !fileDetail) {
      return alert('Harap pilih keempat file CSV (Barang, Batch, Transaksi, Detail) terlebih dahulu!');
    }
    
    if (!window.confirm('PERINGATAN KRITIS: Proses restore menggunakan sistem PostgreSQL UPSERT. Data dengan ID yang sama akan ditimpa secara permanen. Apakah Anda yakin ingin melanjutkan?')) return;
    
    const fd = new FormData();
    fd.append('file_barang', fileBarang);
    fd.append('file_batch', fileBatch);
    fd.append('file_transaksi', fileTransaksi);
    fd.append('file_detail', fileDetail);
    
    try {
      const res = await axios.post(`${API_URL}/backup/import-full`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert(res.data.message || 'Restore berhasil!');
      setFileBarang(null); setFileBatch(null); setFileTransaksi(null); setFileDetail(null);
      document.getElementById('input-barang').value = null;
      document.getElementById('input-batch').value = null;
      document.getElementById('input-transaksi').value = null;
      document.getElementById('input-detail').value = null;
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Gagal restore data');
    }
  };

  if (isLoading) return <p>Loading...</p>;
  if (!toko) return <p>Data toko tidak ditemukan.</p>;

  return (
    <div className="glass-panel" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h2>Pengaturan Profil Toko</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
        Data ini akan ditampilkan pada saat cetak struk/nota pembayaran.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '16px' }}>
          <label>Nama Toko</label>
          <input 
            type="text" 
            value={formData.nama_toko} 
            onChange={e => setFormData({ ...formData, nama_toko: e.target.value })} 
            required 
          />
        </div>
        
        <div style={{ marginBottom: '16px' }}>
          <label>Alamat Lengkap</label>
          <textarea 
            rows="3" 
            value={formData.alamat} 
            onChange={e => setFormData({ ...formData, alamat: e.target.value })}
            style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'rgba(15, 23, 42, 0.6)', color: 'white', border: '1px solid rgba(148, 163, 184, 0.2)' }}
          ></textarea>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label>No. Handphone / WhatsApp</label>
          <input 
            type="text" 
            value={formData.no_hp} 
            onChange={e => setFormData({ ...formData, no_hp: e.target.value })} 
          />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label>Logo Toko</label>
          <input 
            type="file" 
            accept="image/*"
            onChange={e => {
              const file = e.target.files[0];
              if (file) {
                const reader = new FileReader();
                reader.onloadend = () => {
                  const img = new Image();
                  img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 300;
                    const MAX_HEIGHT = 300;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                      if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                      }
                    } else {
                      if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                      }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = "#FFFFFF";
                    ctx.fillRect(0, 0, width, height);
                    ctx.drawImage(img, 0, 0, width, height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                    setFormData({ ...formData, logo: dataUrl });
                  };
                  img.src = reader.result;
                };
                reader.readAsDataURL(file);
              }
            }}
          />
          {formData.logo && (
            <div style={{ marginTop: '8px' }}>
              <img src={formData.logo} alt="Preview Logo" style={{ maxHeight: '60px', borderRadius: '8px' }} />
              <button 
                type="button" 
                onClick={() => setFormData({ ...formData, logo: '' })}
                className="btn btn-danger" 
                style={{ marginLeft: '12px', padding: '4px 8px', fontSize: '12px' }}>
                Hapus Logo
              </button>
            </div>
          )}
        </div>

        <button type="submit" className="btn btn-success" style={{ width: '100%' }}>Simpan Pengaturan</button>
      </form>

      <div style={{ marginTop: '40px', padding: '24px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
        <h3 style={{ marginBottom: '8px', color: '#38bdf8' }}>Backup & Restore Data</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Amankan data toko Anda dengan mengekspornya ke format CSV/Excel. Jika STB Anda diganti, Anda dapat mengimpor kembali file CSV Master Barang.
        </p>

        <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: '1fr 1fr' }}>
          <button type="button" className="btn" style={{ background: '#3b82f6', color: 'white', border: 'none' }} onClick={() => handleExport('barang', 'data_barang.csv')}>📥 Export Master Barang</button>
          <button type="button" className="btn" style={{ background: '#8b5cf6', color: 'white', border: 'none' }} onClick={() => handleExport('batch', 'data_stok_batch.csv')}>📥 Export Stok Batch</button>
          <button type="button" className="btn" style={{ background: '#f59e0b', color: 'white', border: 'none' }} onClick={() => handleExport('transaksi', 'riwayat_transaksi.csv')}>📥 Export Induk Transaksi</button>
          <button type="button" className="btn" style={{ background: '#10b981', color: 'white', border: 'none' }} onClick={() => handleExport('detail', 'detail_transaksi.csv')}>📥 Export Detail Transaksi</button>
        </div>

        <hr style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '24px 0' }} />
        
        <h4 style={{ marginBottom: '12px', color: '#f43f5e' }}>Restore Database (4-File CSV)</h4>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
          Masukkan 4 file CSV sekaligus. Peringatan: Proses ini menggunakan <b>BEGIN TRANSACTION</b>, sehingga aman dari korupsi data relasional.
        </p>

        <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: '1fr 1fr', marginBottom: '20px' }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <label style={{ fontSize: '13px', display: 'block', marginBottom: '8px', fontWeight: '500' }}>1. CSV Barang</label>
            <input id="input-barang" type="file" accept=".csv" onChange={e => setFileBarang(e.target.files[0])} style={{ width: '100%', fontSize: '13px' }} />
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <label style={{ fontSize: '13px', display: 'block', marginBottom: '8px', fontWeight: '500' }}>2. CSV Batch (Stok)</label>
            <input id="input-batch" type="file" accept=".csv" onChange={e => setFileBatch(e.target.files[0])} style={{ width: '100%', fontSize: '13px' }} />
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <label style={{ fontSize: '13px', display: 'block', marginBottom: '8px', fontWeight: '500' }}>3. CSV Transaksi Induk</label>
            <input id="input-transaksi" type="file" accept=".csv" onChange={e => setFileTransaksi(e.target.files[0])} style={{ width: '100%', fontSize: '13px' }} />
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <label style={{ fontSize: '13px', display: 'block', marginBottom: '8px', fontWeight: '500' }}>4. CSV Detail Transaksi</label>
            <input id="input-detail" type="file" accept=".csv" onChange={e => setFileDetail(e.target.files[0])} style={{ width: '100%', fontSize: '13px' }} />
          </div>
        </div>

        <button type="button" className="btn btn-danger" style={{ width: '100%' }} onClick={handleRestoreFull}>
          ⚠️ Mulai Proses Restore Data
        </button>
      </div>
    </div>
  );
}

export default TokoSettings;
