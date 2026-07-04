import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = '/api';

function SuperAdminDashboard() {
  const [activeTab, setActiveTab] = useState('kelola_cabang');
  
  // States for Kelola Cabang
  const [users, setUsers] = useState([]);
  const [namaToko, setNamaToko] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // States for Monitoring & Performance
  const [activityLogs, setActivityLogs] = useState([]);
  const [storesSummary, setStoresSummary] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchKelolaData = async () => {
    try {
      const userRes = await axios.get(`${API_URL}/auth/users`);
      setUsers(userRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMonitoringData = async () => {
    try {
      setIsLoading(true);
      const [logsRes, summaryRes] = await Promise.all([
        axios.get(`${API_URL}/dashboard/superadmin/activity-logs`),
        axios.get(`${API_URL}/dashboard/superadmin/stores-summary`)
      ]);
      setActivityLogs(logsRes.data);
      setStoresSummary(summaryRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'kelola_cabang') {
      fetchKelolaData();
    } else {
      fetchMonitoringData();
    }
  }, [activeTab]);

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
      fetchKelolaData();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal membuat toko');
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Hapus akun toko ini?')) return;
    try {
      await axios.delete(`${API_URL}/auth/users/${id}`);
      fetchKelolaData();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menghapus');
    }
  };

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <h2>Super Admin Dashboard</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Kelola cabang toko, pantau aktivitas, dan lihat performa cabang di bawah bisnis Anda.</p>

      {/* TABS */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '1px solid var(--panel-border)', paddingBottom: '12px' }}>
        <button 
          className={`btn ${activeTab === 'kelola_cabang' ? 'btn-success' : ''}`}
          onClick={() => setActiveTab('kelola_cabang')}
        >
          🏢 Kelola Cabang
        </button>
        <button 
          className={`btn ${activeTab === 'monitoring_aktivitas' ? 'btn-success' : ''}`}
          onClick={() => setActiveTab('monitoring_aktivitas')}
        >
          👀 Monitoring Aktivitas
        </button>
        <button 
          className={`btn ${activeTab === 'performa_toko' ? 'btn-success' : ''}`}
          onClick={() => setActiveTab('performa_toko')}
        >
          📈 Performa Toko
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'kelola_cabang' && (
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
        )}

        {activeTab === 'monitoring_aktivitas' && (
          <div className="glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3>Log Aktivitas Terakhir</h3>
              <button className="btn" onClick={fetchMonitoringData} disabled={isLoading}>
                {isLoading ? 'Memuat...' : '🔄 Refresh'}
              </button>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>User / Kasir</th>
                  <th>Toko</th>
                  <th>Aksi</th>
                  <th>Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {activityLogs.map(log => (
                  <tr key={log.id}>
                    <td>{new Date(log.created_at).toLocaleString('id-ID')}</td>
                    <td>{log.username || 'System'}</td>
                    <td>{log.nama_toko || 'Pusat'}</td>
                    <td><span className="badge" style={{ background: 'var(--accent)', color: '#fff' }}>{log.action}</span></td>
                    <td>{log.description}</td>
                  </tr>
                ))}
                {activityLogs.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center' }}>Belum ada aktivitas terekam.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'performa_toko' && (
          <div className="glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3>Rangkuman Performa (30 Hari Terakhir)</h3>
              <button className="btn" onClick={fetchMonitoringData} disabled={isLoading}>
                {isLoading ? 'Memuat...' : '🔄 Refresh'}
              </button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
              {storesSummary.map(store => (
                <div key={store.toko_id} className="glass-panel" style={{ borderLeft: '4px solid var(--accent)' }}>
                  <h4 style={{ fontSize: '18px', marginBottom: '12px' }}>{store.nama_toko}</h4>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Total Transaksi</span>
                    <span style={{ fontWeight: 'bold' }}>{store.total_transaksi}</span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Item Terjual</span>
                    <span style={{ fontWeight: 'bold' }}>{store.total_item_terjual}</span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--panel-border)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Pendapatan Kuto</span>
                    <span style={{ fontWeight: 'bold', color: 'var(--success)' }}>
                      Rp{store.total_pendapatan.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              ))}
              {storesSummary.length === 0 && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Belum ada data toko atau performa.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SuperAdminDashboard;
