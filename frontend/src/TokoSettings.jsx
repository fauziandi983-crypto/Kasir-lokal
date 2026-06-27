import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = '/api';

function TokoSettings({ currentUser }) {
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/toko/${toko.id}`, formData);
      alert('Profil toko berhasil disimpan!');
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menyimpan');
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
          <label>Logo URL (Opsional)</label>
          <input 
            type="text" 
            value={formData.logo} 
            onChange={e => setFormData({ ...formData, logo: e.target.value })} 
            placeholder="https://contoh.com/logo.png"
          />
          {formData.logo && (
            <div style={{ marginTop: '8px' }}>
              <img src={formData.logo} alt="Preview Logo" style={{ maxHeight: '60px', borderRadius: '8px' }} />
            </div>
          )}
        </div>

        <button type="submit" className="btn btn-success" style={{ width: '100%' }}>Simpan Pengaturan</button>
      </form>
    </div>
  );
}

export default TokoSettings;
