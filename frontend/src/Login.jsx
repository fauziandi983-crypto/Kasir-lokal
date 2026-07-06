import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';

const API_URL = '/api';
const GOOGLE_CLIENT_ID = '268274669708-t7j0au9mqhimhblksdlbae65c918eeh9.apps.googleusercontent.com';

function Login({ onLoginSuccess }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(false);
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [namaKlien, setNamaKlien] = useState('');
  const [email, setEmail] = useState('');
  
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    // Cek apakah ada token reset di URL (misal: /?reset=abcde123)
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('reset');
    if (token) {
      setResetToken(token);
      setIsResetPassword(true);
    }
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');
    
    try {
      if (isRegistering) {
        await axios.post(`${API_URL}/auth/register-public`, { username, password, nama_klien: namaKlien, email });
        setSuccess('Pendaftaran berhasil! Silakan login.');
        setIsRegistering(false);
        setPassword('');
        setEmail('');
      } else {
        const res = await axios.post(`${API_URL}/auth/login`, { username, password });
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
        onLoginSuccess(res.data.user);
      }
    } catch (err) {
      setError(err.response?.data?.message || (isRegistering ? 'Gagal mendaftar.' : 'Gagal login. Periksa koneksi Anda.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setIsLoading(true);
    setError('');
    try {
      const res = await axios.post(`${API_URL}/auth/google`, { 
        token: credentialResponse.credential,
        nama_klien: 'Klien Baru (Google)'
      });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
      onLoginSuccess(res.data.user);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal login dengan Google');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const res = await axios.post(`${API_URL}/auth/forgot-password`, { email });
      setSuccess(res.data.message || 'Link reset password telah dikirim');
      setEmail('');
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mengirim email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const res = await axios.post(`${API_URL}/auth/reset-password`, { token: resetToken, newPassword });
      setSuccess(res.data.message || 'Password berhasil direset');
      
      // Bersihkan URL dari token
      window.history.replaceState({}, document.title, window.location.pathname);
      
      setTimeout(() => {
        setIsResetPassword(false);
        setResetToken('');
        setNewPassword('');
      }, 2000);
      
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal reset password');
    } finally {
      setIsLoading(false);
    }
  };

  let title = 'Sistem KasirUKM';
  let subtitle = 'Silakan masuk untuk melanjutkan';
  if (isRegistering) {
    title = 'Daftar Klien KasirUKM';
    subtitle = 'Lengkapi data usaha Anda untuk mendaftar';
  } else if (isResetPassword) {
    title = 'Reset Password';
    subtitle = 'Masukkan password baru Anda';
  } else if (isForgotPassword) {
    title = 'Lupa Password';
    subtitle = 'Masukkan email untuk menerima link reset';
  }

  // Light Theme styling matching App.jsx
  const inputStyle = {
    width: '100%', 
    padding: '10px 14px', 
    background: '#ffffff', 
    border: '1px solid #cbd5e1', 
    borderRadius: '8px', 
    color: '#1e293b', 
    fontSize: '14px', 
    outline: 'none',
    transition: 'border-color 0.2s'
  };

  const labelStyle = { 
    display: 'block', 
    color: '#475569', 
    fontSize: '12px', 
    marginBottom: '6px', 
    fontWeight: 600 
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f1f5f9', // Light gray from App.jsx
      fontFamily: "'Inter', 'Segoe UI', sans-serif"
    }}>
      <div style={{
        width: '100%',
        maxWidth: '380px',
        padding: '24px 32px',
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.05)',
        margin: '16px'
      }}>
        {/* Logo / Header */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <img src="/logo.png" alt="KasirUKM Logo" style={{ height: '50px', objectFit: 'contain', marginBottom: '10px' }} />
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#1e40af', margin: '0 0 4px' }}>
            {title}
          </h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>{subtitle}</p>
        </div>

        {/* Error / Success Message */}
        {error && (
          <div style={{ padding: '10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#ef4444', fontSize: '12px', marginBottom: '16px', textAlign: 'center' }}>
            ❌ {error}
          </div>
        )}
        {success && (
          <div style={{ padding: '10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#10b981', fontSize: '12px', marginBottom: '16px', textAlign: 'center' }}>
            ✅ {success}
          </div>
        )}

        {/* FORMS */}
        {isResetPassword ? (
          <form onSubmit={handleResetPassword}>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Password Baru</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Masukkan password baru" required autoFocus style={inputStyle} onFocus={e => e.target.style.borderColor = '#10b981'} onBlur={e => e.target.style.borderColor = '#cbd5e1'} />
            </div>
            <button type="submit" disabled={isLoading} style={{ width: '100%', padding: '12px', background: isLoading ? '#94a3b8' : '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: isLoading ? 'not-allowed' : 'pointer' }}>
              {isLoading ? '⏳ Memproses...' : 'Simpan Password Baru'}
            </button>
          </form>
        ) : isForgotPassword ? (
          <form onSubmit={handleForgotPassword}>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Email Terdaftar</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@anda.com" required autoFocus style={inputStyle} onFocus={e => e.target.style.borderColor = '#10b981'} onBlur={e => e.target.style.borderColor = '#cbd5e1'} />
            </div>
            <button type="submit" disabled={isLoading} style={{ width: '100%', padding: '12px', background: isLoading ? '#94a3b8' : '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: isLoading ? 'not-allowed' : 'pointer', marginBottom: '16px' }}>
              {isLoading ? '⏳ Mengirim...' : 'Kirim Link Reset'}
            </button>
            <div style={{ textAlign: 'center' }}>
              <button type="button" onClick={() => { setIsForgotPassword(false); setError(''); setSuccess(''); setEmail(''); }} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}>
                Kembali ke Login
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleAuth}>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Username</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Masukkan username" required autoFocus style={inputStyle} onFocus={e => e.target.style.borderColor = '#10b981'} onBlur={e => e.target.style.borderColor = '#cbd5e1'} />
            </div>

            <div style={{ marginBottom: isRegistering ? '16px' : '8px' }}>
              <label style={labelStyle}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Masukkan password" required style={inputStyle} onFocus={e => e.target.style.borderColor = '#10b981'} onBlur={e => e.target.style.borderColor = '#cbd5e1'} />
            </div>

            {!isRegistering && (
              <div style={{ textAlign: 'right', marginBottom: '16px' }}>
                <button type="button" onClick={() => setIsForgotPassword(true)} style={{ background: 'none', border: 'none', color: '#1e40af', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}>
                  Lupa Password?
                </button>
              </div>
            )}

            {isRegistering && (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>Email (Untuk pemulihan akun)</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@anda.com" required style={inputStyle} onFocus={e => e.target.style.borderColor = '#10b981'} onBlur={e => e.target.style.borderColor = '#cbd5e1'} />
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={labelStyle}>Nama Usaha / Perusahaan</label>
                  <input type="text" value={namaKlien} onChange={e => setNamaKlien(e.target.value)} placeholder="Masukkan nama usaha Anda" required style={inputStyle} onFocus={e => e.target.style.borderColor = '#10b981'} onBlur={e => e.target.style.borderColor = '#cbd5e1'} />
                </div>
              </>
            )}

            <button type="submit" disabled={isLoading} style={{ width: '100%', padding: '12px', background: isLoading ? '#94a3b8' : '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: isLoading ? 'not-allowed' : 'pointer', marginBottom: '16px' }}>
              {isLoading ? '⏳ Memproses...' : (isRegistering ? '📝 Daftar' : '🔐 Masuk')}
            </button>
            
            <div style={{ position: 'relative', textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, borderTop: '1px solid #e2e8f0' }}></div>
              <span style={{ position: 'relative', background: '#ffffff', padding: '0 10px', color: '#94a3b8', fontSize: '11px', fontWeight: 600 }}>ATAU</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Google Login Failed')}
                useOneTap
                theme="outline"
                size="medium"
                shape="rectangular"
              />
            </div>

            <div style={{ textAlign: 'center' }}>
              <button type="button" onClick={() => { setIsRegistering(!isRegistering); setError(''); setSuccess(''); }} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}>
                {isRegistering ? 'Sudah punya akun? Masuk di sini' : 'Belum punya akun? Daftar di sini'}
              </button>
            </div>
          </form>
        )}

        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '11px', marginTop: '24px' }}>
          © 2026 KasirUKM. All rights reserved.
        </p>
      </div>
    </div>
  );
}

export default function LoginWrapper(props) {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <Login {...props} />
    </GoogleOAuthProvider>
  );
}
