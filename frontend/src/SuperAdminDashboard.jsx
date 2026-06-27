import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = '/api';

function SuperAdminDashboard() {
  const [tokos, setTokos] = useState([]);
  const [users, setUsers] = useState([]);
  const [namaToko, setNamaToko] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const fetchData = async () => {
    try {
      const [tokoRes, userRes] = await Promise.all([
        axios.get(`${API_URL}/toko`),
        axios.get(`${API_URL}/auth/users`)
      ]);
      setTokos(tokoRes.data);
      setUsers(userRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateToko = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/auth/register`, {
        username,
        password,
        role: 'toko',
        nama_toko: namaToko
      });
      alert('Toko berhasil dibuat');
      setNamaToko('');
      setUsername('');
      setPassword('');
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal membuat toko');
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Hapus akun toko ini?')) return;
    try {
      await axios.delete(`${API_URL}/auth/users/${id}`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menghapus');
    }
  };

  return (
    <div className="glass-panel">
      <h2>Super Admin Dashboard</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Kelola cabang toko di bawah bisnis Anda.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
        <div className="glass-panel">
          <h3>Buat Cabang Toko Baru</h3>
          <form onSubmit={handleCreateToko} style={{ marginTop: '16px' }}>
            <div style={{ marginBottom: '12px' }}>
              <label>Nama Toko</label>
              <input type="text" value={namaToko} onChange={e => setNamaToko(e.target.value)} required />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label>Username (Untuk Login Toko)</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} required />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button className="btn btn-success" type="submit" style={{ width: '100%' }}>Buat Toko</button>
          </form>
        </div>

        <div className="glass-panel">
          <h3>Daftar Toko & Akun</h3>
          <table className="data-table" style={{ marginTop: '16px' }}>
            <thead>
              <tr>
                <th>Username</th>
                <th>Nama Toko</th>
                <th>Role</th>
                <th>Tgl Dibuat</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.username}</td>
                  <td>{u.nama_toko || '-'}</td>
                  <td><span className="badge">{u.role}</span></td>
                  <td>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td>
                    <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => handleDeleteUser(u.id)}>
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center' }}>Belum ada cabang toko.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default SuperAdminDashboard;
