import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = '/api';

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'kasir' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API_URL}/auth/users`);
      setUsers(res.data);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUser = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await axios.post(`${API_URL}/auth/register`, newUser);
      setSuccess(`User "${newUser.username}" berhasil ditambahkan!`);
      setNewUser({ username: '', password: '', role: 'kasir' });
      setShowForm(false);
      fetchUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menambah user');
    }
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Yakin ingin menghapus user "${user.username}"?`)) return;
    setError('');
    try {
      await axios.delete(`${API_URL}/auth/users/${user.id}`);
      setSuccess(`User "${user.username}" berhasil dihapus`);
      fetchUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menghapus user');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h2 style={{ margin: 0 }}>👥 Kelola User</h2>
        <button className="btn btn-success" onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Batal' : '+ Tambah User Baru'}
        </button>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div style={{
          padding: '12px 16px', marginBottom: '16px', borderRadius: '8px',
          background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)',
          color: '#10b981', fontSize: '14px'
        }}>
          ✅ {success}
        </div>
      )}
      {error && (
        <div style={{
          padding: '12px 16px', marginBottom: '16px', borderRadius: '8px',
          background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#ef4444', fontSize: '14px'
        }}>
          ❌ {error}
        </div>
      )}

      {/* Add User Form */}
      {showForm && (
        <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '16px' }}>Tambah User Baru</h3>
          <form className="grid-4-cols" onSubmit={handleAddUser} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Username</label>
              <input
                required
                type="text"
                placeholder="Username baru"
                value={newUser.username}
                onChange={e => setNewUser({ ...newUser, username: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Password</label>
              <input
                required
                type="password"
                placeholder="Password"
                value={newUser.password}
                onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                minLength={4}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Role</label>
              <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })} style={{ color: 'black' }}>
                <option value="kasir">Kasir</option>
                <option value="owner">Owner</option>
              </select>
            </div>
            <button type="submit" className="btn btn-success" style={{ height: '42px' }}>Simpan</button>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
              <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>USERNAME</th>
              <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>ROLE</th>
              <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>DIBUAT</th>
              <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>AKSI</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
                <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                  {user.username}
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 600,
                    background: user.role === 'owner' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                    color: user.role === 'owner' ? '#f59e0b' : '#3b82f6',
                    border: `1px solid ${user.role === 'owner' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`
                  }}>
                    {user.role === 'owner' ? '👑 Owner' : '🧑‍💻 Kasir'}
                  </span>
                </td>
                <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                  {new Date(user.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                  <button
                    className="btn btn-danger"
                    style={{ padding: '6px 14px', fontSize: '12px' }}
                    onClick={() => handleDeleteUser(user)}
                  >
                    🗑️ Hapus
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Belum ada user terdaftar
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default UserManagement;
