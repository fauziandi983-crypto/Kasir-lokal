import React, { useState, useEffect } from 'react';
import axios from 'axios';
import html2canvas from 'html2canvas';
import './index.css';
import Inventory from './Inventory';
import MonitoringStok from './MonitoringStok';
import LaporanTransaksi from './LaporanTransaksi';
import Hutang from './Hutang';
import Dashboard from './Dashboard';
import BarcodeScanner from './components/BarcodeScanner';
import Login from './Login';
import UserManagement from './UserManagement';
import SuperAdminDashboard from './SuperAdminDashboard';
import TokoSettings from './TokoSettings';
import { 
  Building2, 
  LineChart, 
  ShoppingCart, 
  Package, 
  Activity, 
  ClipboardList, 
  Users,
  Wallet
} from 'lucide-react';

const API_URL = '/api';
axios.defaults.headers.common['Bypass-Tunnel-Reminder'] = 'true';

// Restore token from localStorage on app load
const savedToken = localStorage.getItem('token');
if (savedToken) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
}

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [currentTab, setCurrentTab] = useState('pos');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [isPedagangMode, setIsPedagangMode] = useState(false);
  const [uangBayar, setUangBayar] = useState('');
  const [searchPos, setSearchPos] = useState('');
  const [displayLimit, setDisplayLimit] = useState(50);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [namaPelanggan, setNamaPelanggan] = useState('');
  const [receiptData, setReceiptData] = useState(null);
  const [isPosScannerOpen, setIsPosScannerOpen] = useState(false);
  const [tokoProfile, setTokoProfile] = useState(null);
  
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailPromptLoading, setEmailPromptLoading] = useState(false);

  // Hutang State
  const [isHutangMode, setIsHutangMode] = useState(false);
  const [catatanHutang, setCatatanHutang] = useState('');
  const [tglJatuhTempo, setTglJatuhTempo] = useState('');

  // Check if user is already logged in on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      axios.get(`${API_URL}/auth/me`).then(res => {
        const u = JSON.parse(savedUser);
        setCurrentUser(res.data);
        if (!res.data.email) setShowEmailPrompt(true);
        if (u.role === 'superadmin') setCurrentTab('superadmin');
        else if (u.role === 'owner') setCurrentTab('users');
      }).catch(() => {
        // Token expired or invalid
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        delete axios.defaults.headers.common['Authorization'];
      }).finally(() => {
        setIsCheckingAuth(false);
      });
    } else {
      setIsCheckingAuth(false);
    }
  }, []);

  const handleUpdateEmail = async (e) => {
    e.preventDefault();
    setEmailPromptLoading(true);
    try {
      await axios.put(`${API_URL}/auth/update-email`, { email: newEmail });
      const updatedUser = { ...currentUser, email: newEmail };
      setCurrentUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setShowEmailPrompt(false);
      alert('Email berhasil disimpan!');
    } catch (error) {
      alert(error.response?.data?.message || 'Gagal menyimpan email');
    } finally {
      setEmailPromptLoading(false);
    }
  };

  const fetchProducts = () => {
    axios.get(`${API_URL}/barang`).then(res => {
      setProducts(res.data);
    }).catch(err => console.error("Error fetching products", err));
  };

  useEffect(() => {
    if (currentTab === 'pos' && currentUser) {
      fetchProducts();
    }
  }, [currentTab, currentUser]);

  const fetchTokoProfile = () => {
    if (currentUser && (currentUser.role === 'toko' || currentUser.role === 'kasir')) {
      axios.get(`${API_URL}/toko`)
        .then(res => setTokoProfile(res.data))
        .catch(err => console.error("Error fetching toko profile", err));
    }
  };

  useEffect(() => {
    fetchTokoProfile();
  }, [currentUser]);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    if (!user.email) setShowEmailPrompt(true);
    if (user.role === 'superadmin') setCurrentTab('superadmin');
    else if (user.role === 'owner') setCurrentTab('users');
    else setCurrentTab('pos');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    setCurrentUser(null);
    setProducts([]);
    setCart([]);
    setCurrentTab('pos');
  };

  const applyBlackAndWhiteThreshold = (canvas) => {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
      const color = avg < 200 ? 0 : 255;
      data[i] = color;
      data[i + 1] = color;
      data[i + 2] = color;
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  };

  const shareReceiptImage = async () => {
    const receiptElement = document.querySelector('.printable-receipt');
    if (!receiptElement) return;

    try {
      let canvas = await html2canvas(receiptElement, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      canvas = applyBlackAndWhiteThreshold(canvas);

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `nota-${receiptData.nota_nomor}.png`, { type: 'image/png' });
        
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              title: 'Nota Transaksi',
              text: `Nota: ${receiptData.nota_nomor}`,
              files: [file]
            });
            return;
          } catch (error) {
            console.log('Share canceled or failed', error);
          }
        }
        
        // Fallback
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `nota-${receiptData.nota_nomor}.png`;
        link.href = dataUrl;
        link.click();
      }, 'image/png');
    } catch (err) {
      console.error('Error generating receipt image:', err);
      alert('Gagal membagikan nota.');
    }
  };

  const downloadReceiptImage = async () => {
    const receiptElement = document.querySelector('.printable-receipt');
    if (!receiptElement) return;

    try {
      let canvas = await html2canvas(receiptElement, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      canvas = applyBlackAndWhiteThreshold(canvas);

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `nota-${receiptData.nota_nomor}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error generating receipt image:', err);
      alert('Gagal mendownload nota.');
    }
  };



  // Show loading while checking auth
  if (isCheckingAuth) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}>
        <p style={{ color: '#94a3b8', fontSize: '18px' }}>⏳ Memuat...</p>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const updateCartQty = (id, newQty) => {
    // Allow empty string or numbers so users can type "0.x" smoothly
    setCart(prev => prev.map(item => item.id === id ? { ...item, qty: newQty } : item));
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const handlePosScan = (scannedCode) => {
    setIsPosScannerOpen(false); // Close scanner after successful scan
    const product = products.find(p => p.kode_barang.toLowerCase() === scannedCode.toLowerCase());
    
    if (product) {
      addToCart(product);
      // Optional: Give some visual feedback that item was added
    } else {
      alert(`Barang dengan kode ${scannedCode} tidak ditemukan!`);
    }
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => {
      const q = parseFloat(item.qty) || 0;
      const isGrosir = isPedagangMode || q >= item.min_beli_grosir;
      const price = isGrosir ? item.harga_jual_grosir : item.harga_jual_ecer;
      return total + (price * q);
    }, 0);
  };

  const handleUangBayarChange = (e) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    if (!rawValue) {
      setUangBayar('');
      return;
    }
    const formatted = "Rp" + parseInt(rawValue, 10).toLocaleString('id-ID');
    setUangBayar(formatted);
  };

  const handleCheckout = async () => {
    try {
      const parsedUangBayar = uangBayar ? parseFloat(uangBayar.replace(/\D/g, '')) : 0;
      const items = cart.map(c => ({ barang_id: c.id, jumlah_beli: parseFloat(c.qty) || 0 })).filter(c => c.jumlah_beli > 0);
      const response = await axios.post(`${API_URL}/transaksi/checkout`, {
        pelanggan_nama: namaPelanggan,
        uang_bayar: parsedUangBayar,
        is_mode_pedagang: isPedagangMode,
        is_hutang: isHutangMode,
        catatan_hutang: isHutangMode ? catatanHutang : '',
        tgl_jatuh_tempo: isHutangMode ? tglJatuhTempo : '',
        items
      });
      
      setReceiptData({
        nota_nomor: response.data.nota_nomor,
        uang_kembalian: response.data.uang_kembalian,
        status_pembayaran: response.data.status_pembayaran,
        sisa_tagihan: response.data.sisa_tagihan,
        catatan_hutang: isHutangMode ? catatanHutang : '',
        tgl_jatuh_tempo: isHutangMode ? tglJatuhTempo : '',
        total_belanja: totalBelanja,
        uang_bayar: parsedUangBayar,
        pelanggan: namaPelanggan,
        date: new Date().toLocaleString(),
        items: cart.map(item => {
          const q = parseFloat(item.qty) || 0;
          return {
            ...item, 
            qty: q,
            isGrosir: isPedagangMode || q >= item.min_beli_grosir,
            finalPrice: (isPedagangMode || q >= item.min_beli_grosir) ? item.harga_jual_grosir : item.harga_jual_ecer
          }
        })
      });

      setCart([]);
      setUangBayar('');
      setNamaPelanggan('');
      setIsHutangMode(false);
      setCatatanHutang('');
      setTglJatuhTempo('');
      fetchProducts(); // Refresh stock
    } catch (err) {
      alert(`Checkout Gagal: ${err.response?.data?.message || err.message}`);
    }
  };

  const totalBelanja = calculateTotal();
  const parsedUangBayarDisplay = uangBayar ? parseFloat(uangBayar.replace(/\D/g, '')) : 0;
  const kembalian = parsedUangBayarDisplay - totalBelanja;
  const filteredPosProducts = products.filter(p => p.nama_barang.toLowerCase().includes(searchPos.toLowerCase()));
  const displayedPosProducts = displayLimit === 'all' ? filteredPosProducts : filteredPosProducts.slice(0, displayLimit);

  return (
    <div className="layout">
      {/* Mobile Top Header */}
      <div className="mobile-top-header">
        <h2>KasirUKM</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {tokoProfile?.logo && (
            <img src={tokoProfile.logo} alt="Logo" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--accent)' }} />
          )}
          <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
            {tokoProfile?.nama_toko || currentUser.username}
          </span>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className={`sidebar ${!isSidebarOpen ? 'collapsed' : ''}`}>
        <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src="/logo.png" alt="Logo" style={{ height: '32px', width: 'auto', objectFit: 'contain' }} />
          <h2 className="sidebar-title" style={{ margin: 0, fontSize: '18px' }}>KasirUKM</h2>
          <button 
            className="sidebar-toggle-btn" 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '4px', padding: '4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {isSidebarOpen ? '◀' : '☰'}
          </button>
        </div>
        
        <div className="sidebar-menu">
          {currentUser.role === 'superadmin' && (
            <button 
              className={`sidebar-nav-item ${currentTab === 'superadmin' ? 'active' : ''}`}
              onClick={() => setCurrentTab('superadmin')}
            >
              <Building2 /> <span>Dashboard Pusat</span>
            </button>
          )}

          {currentUser.role !== 'owner' && currentUser.role !== 'superadmin' && (
            <>
              <button 
                className={`sidebar-nav-item ${currentTab === 'dashboard' ? 'active' : ''}`}
                onClick={() => setCurrentTab('dashboard')}
              >
                <LineChart /> <span>Dashboard Toko</span>
              </button>
              <button 
                className={`sidebar-nav-item ${currentTab === 'pos' ? 'active' : ''}`}
                onClick={() => setCurrentTab('pos')}
              >
                <ShoppingCart /> <span>Transaksi Kasir</span>
              </button>
              <button 
                className={`sidebar-nav-item ${currentTab === 'inventory' ? 'active' : ''}`}
                onClick={() => setCurrentTab('inventory')}
              >
                <Package /> <span>Master Barang</span>
              </button>
              <button 
                className={`sidebar-nav-item ${currentTab === 'monitoring' ? 'active' : ''}`}
                onClick={() => setCurrentTab('monitoring')}
              >
                <Activity /> <span>Monitoring Stok</span>
              </button>
              <button 
                className={`sidebar-nav-item ${currentTab === 'hutang' ? 'active' : ''}`}
                onClick={() => setCurrentTab('hutang')}
              >
                <Wallet /> <span>Buku Hutang</span>
              </button>
              <button 
                className={`sidebar-nav-item ${currentTab === 'laporan' ? 'active' : ''}`}
                onClick={() => setCurrentTab('laporan')}
              >
                <ClipboardList /> <span>Laporan Transaksi</span>
              </button>
            </>
          )}

          {currentUser.role === 'toko' && (
            <>

              <button 
                className={`sidebar-nav-item ${currentTab === 'users' ? 'active' : ''}`}
                onClick={() => setCurrentTab('users')}
              >
                <Users /> <span>Kelola Kasir</span>
              </button>
            </>
          )}

          {currentUser.role === 'owner' && (
            <button 
              className={`sidebar-nav-item ${currentTab === 'users' ? 'active' : ''}`}
              onClick={() => setCurrentTab('users')}
            >
              <Users /> <span>Kelola Klien</span>
            </button>
          )}
        </div>

        <div className="sidebar-footer" style={{ marginTop: 'auto', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>
            Powered by KasirUKM<br/>Version 1.0.0
          </p>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="mobile-bottom-nav">
        {currentUser.role === 'superadmin' && (
          <button className={`bottom-nav-item ${currentTab === 'superadmin' ? 'active' : ''}`} onClick={() => setCurrentTab('superadmin')}>
            <Building2 />
            Pusat
          </button>
        )}

        {currentUser.role !== 'owner' && currentUser.role !== 'superadmin' && (
          <>
            <button className={`bottom-nav-item ${currentTab === 'dashboard' ? 'active' : ''}`} onClick={() => setCurrentTab('dashboard')}>
              <LineChart />
              Dashboard
            </button>
            <button className={`bottom-nav-item ${currentTab === 'pos' ? 'active' : ''}`} onClick={() => setCurrentTab('pos')}>
              <ShoppingCart />
              Kasir
            </button>
            <button className={`bottom-nav-item ${currentTab === 'inventory' ? 'active' : ''}`} onClick={() => setCurrentTab('inventory')}>
              <Package />
              Barang
            </button>
            <button className={`bottom-nav-item ${currentTab === 'monitoring' ? 'active' : ''}`} onClick={() => setCurrentTab('monitoring')}>
              <Activity />
              Stok
            </button>
            <button className={`bottom-nav-item ${currentTab === 'hutang' ? 'active' : ''}`} onClick={() => setCurrentTab('hutang')}>
              <Wallet />
              Hutang
            </button>
            <button className={`bottom-nav-item ${currentTab === 'laporan' ? 'active' : ''}`} onClick={() => setCurrentTab('laporan')}>
              <ClipboardList />
              Laporan
            </button>
          </>
        )}

        {currentUser.role === 'toko' && (
          <>
            <button className={`bottom-nav-item ${currentTab === 'users' ? 'active' : ''}`} onClick={() => setCurrentTab('users')}>
              <Users />
              Kasir
            </button>
          </>
        )}

        {currentUser.role === 'owner' && (
          <button className={`bottom-nav-item ${currentTab === 'users' ? 'active' : ''}`} onClick={() => setCurrentTab('users')}>
            <Users />
            Klien
          </button>
        )}
      </div>
      
      <div className="main-content">
        {/* Modal Prompt Update Email */}
        {showEmailPrompt && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div style={{ background: 'white', padding: '32px', borderRadius: '12px', width: '90%', maxWidth: '400px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <span style={{ fontSize: '40px' }}>⚠️</span>
                <h2 style={{ margin: '12px 0 8px', color: '#1e293b' }}>Lengkapi Profil Anda</h2>
                <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Akun Anda belum memiliki email. Silakan masukkan email agar Anda bisa menggunakan fitur "Lupa Password" nanti.</p>
              </div>
              <form onSubmit={handleUpdateEmail}>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold', color: '#334155' }}>Email Anda</label>
                  <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@anda.com" required style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} onFocus={e => e.target.style.borderColor = '#10b981'} />
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="button" onClick={() => setShowEmailPrompt(false)} style={{ flex: 1, padding: '12px', background: '#f1f5f9', border: 'none', borderRadius: '8px', color: '#64748b', fontWeight: 'bold', cursor: 'pointer' }}>Nanti Saja</button>
                  <button type="submit" disabled={emailPromptLoading} style={{ flex: 1, padding: '12px', background: '#10b981', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 'bold', cursor: emailPromptLoading ? 'not-allowed' : 'pointer' }}>{emailPromptLoading ? 'Menyimpan...' : 'Simpan Email'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* DESKTOP TOP HEADER / PROFILE DROPDOWN */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 32px', margin: '-24px -24px 24px -24px', background: 'white', borderBottom: '1px solid var(--panel-border)', alignItems: 'center', position: 'relative', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
           <div 
             style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '6px 12px', borderRadius: '30px', transition: 'background 0.3s' }}
             onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
             onMouseLeave={() => setTimeout(() => setIsProfileDropdownOpen(false), 2000)}
             onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
             onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
           >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>{tokoProfile?.nama_toko || currentUser.username}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{currentUser.role.toUpperCase()}</span>
              </div>
              {tokoProfile?.logo ? (
                <img src={tokoProfile.logo} alt="Logo" style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--panel-border)' }} />
              ) : (
                <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px' }}>
                   {currentUser.username.charAt(0).toUpperCase()}
                </div>
              )}
           </div>

           {isProfileDropdownOpen && (
             <div 
               style={{ position: 'absolute', top: '64px', right: '32px', background: 'white', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', width: '220px', overflow: 'hidden', border: '1px solid var(--panel-border)', zIndex: 100 }}
               onMouseEnter={() => setIsProfileDropdownOpen(true)}
               onMouseLeave={() => setIsProfileDropdownOpen(false)}
             >
                {currentUser.role === 'toko' && (
                  <div 
                    style={{ padding: '14px 20px', cursor: 'pointer', color: 'var(--text-primary)', borderBottom: '1px solid var(--panel-border)', display: 'flex', alignItems: 'center', gap: '12px', transition: 'background 0.2s', fontWeight: '500' }}
                    onClick={() => { setCurrentTab('toko_settings'); setIsProfileDropdownOpen(false); }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ fontSize: '18px' }}>⚙️</span> Pengaturan
                  </div>
                )}
                <div 
                  style={{ padding: '14px 20px', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '12px', transition: 'background 0.2s', fontWeight: '500' }}
                  onClick={handleLogout}
                  onMouseOver={(e) => e.currentTarget.style.background = '#fef2f2'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontSize: '18px' }}>🚪</span> Keluar Akun
                </div>
             </div>
           )}
        </div>
        {currentTab === 'superadmin' && currentUser.role === 'superadmin' && <SuperAdminDashboard />}
        {currentTab === 'toko_settings' && currentUser.role === 'toko' && <TokoSettings currentUser={currentUser} onProfileUpdated={fetchTokoProfile} />}
        {currentTab === 'dashboard' && <Dashboard />}
        {currentTab === 'inventory' && <Inventory />}
        {currentTab === 'monitoring' && <MonitoringStok />}
        {currentTab === 'hutang' && <Hutang />}
        {currentTab === 'laporan' && <LaporanTransaksi />}
        {currentTab === 'users' && <UserManagement currentUser={currentUser} />}
        
        {currentTab === 'pos' && (
          <div className="pos-grid">
            {/* Left Panel: Products */}
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div className="pos-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2>Daftar Barang</h2>
                
                <div className="toggle-switch" onClick={() => setIsPedagangMode(!isPedagangMode)}>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: isPedagangMode ? 'var(--accent)' : 'var(--text-secondary)' }}>
                    Mode Pedagang
                  </span>
                  <div className="toggle-bg" data-active={isPedagangMode}>
                    <div className="toggle-knob"></div>
                  </div>
                </div>
              </div>

              <div className="pos-controls" style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                <input 
                  type="text" 
                  placeholder="Cari nama barang untuk kasir..." 
                  value={searchPos}
                  onChange={e => setSearchPos(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button 
                  className="btn btn-success" 
                  onClick={() => setIsPosScannerOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <span>📷</span> Scan Barcode
                </button>
                <select 
                  value={displayLimit} 
                  onChange={e => setDisplayLimit(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                  style={{ width: '150px' }}
                >
                  <option value={10}>Top 10</option>
                  <option value={20}>Top 20</option>
                  <option value={30}>Top 30</option>
                  <option value={50}>Top 50</option>
                  <option value={80}>Top 80</option>
                  <option value={100}>Top 100</option>
                  <option value="all">Semua Data</option>
                </select>
              </div>

              <div className="product-grid" style={{ overflowY: 'auto', paddingRight: '8px', flex: 1 }}>
                {displayedPosProducts.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)' }}>Barang tidak ditemukan.</p>
                ) : (
                  displayedPosProducts.map(p => (
                    <div key={p.id} className="glass-panel product-card" onClick={() => addToCart(p)}>
                      <h3 style={{ marginBottom: '8px', fontSize: '16px' }}>{p.nama_barang}</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Satuan: {p.satuan_pecahan}</p>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                        <p style={{ color: 'var(--accent)', fontWeight: 'bold' }}>
                          Rp{parseFloat(p.harga_jual_ecer).toLocaleString('id-ID')}
                        </p>
                        <p style={{ fontSize: '12px', color: p.total_stok > 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold' }}>
                          Stok: {parseFloat(p.total_stok).toLocaleString('id-ID')}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right Panel: Cart */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)' }}>
              <h2 style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--panel-border)' }}>Keranjang</h2>
              
              <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
                {cart.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '40px' }}>Keranjang Kosong</p>
                ) : (
                  cart.map(item => {
                    const q = parseFloat(item.qty) || 0;
                    const isGrosir = isPedagangMode || q >= item.min_beli_grosir;
                    const price = isGrosir ? item.harga_jual_grosir : item.harga_jual_ecer;
                    
                    return (
                      <div key={item.id} className="cart-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <h4 style={{ fontSize: '14px' }}>{item.nama_barang}</h4>
                          <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => removeFromCart(item.id)}>Hapus</button>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                            <input 
                              type="number" 
                              step="0.01"
                              min="0"
                              value={item.qty} 
                              onChange={(e) => updateCartQty(item.id, e.target.value)}
                              style={{ width: '80px', padding: '8px', fontSize: '14px' }}
                            />
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{item.satuan_pecahan}</span>
                          </div>
                          
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              @ Rp{parseFloat(price).toLocaleString('id-ID')}
                              {isGrosir && <span style={{ color: 'var(--success)', marginLeft: '4px', padding: '2px 4px', background: 'rgba(16, 185, 129, 0.2)', borderRadius: '4px' }}>Grosir</span>}
                            </p>
                            <span style={{ fontWeight: 'bold' }}>Rp{(parseFloat(price) * q).toLocaleString('id-ID')}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div style={{ marginTop: 'auto', paddingTop: '24px', borderTop: '2px dashed var(--panel-border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <label className="modern-switch-wrapper">
                  <input type="checkbox" id="kasbon" checked={isHutangMode} onChange={e => setIsHutangMode(e.target.checked)} style={{ display: 'none' }} />
                  <div className="modern-switch"></div>
                  <span style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--danger)' }}>Aktifkan Mode Kasbon / Hutang</span>
                </label>

                <div>
                  <input 
                    type="text" 
                    placeholder={isHutangMode ? "👤 Nama Pelanggan (Wajib untuk Kasbon)" : "👤 Nama Pelanggan (Opsional)"} 
                    value={namaPelanggan}
                    onChange={e => setNamaPelanggan(e.target.value)}
                    style={{ background: isHutangMode ? '#fff' : '#f8fafc', borderColor: isHutangMode && !namaPelanggan ? 'var(--danger)' : 'var(--panel-border)' }}
                  />
                </div>

                {isHutangMode && (
                  <div className="grid-1fr-1fr">
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Janji Jatuh Tempo</label>
                      <input 
                        type="date" 
                        value={tglJatuhTempo}
                        onChange={e => setTglJatuhTempo(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Catatan Kasbon (Opsional)</label>
                      <input 
                        type="text" 
                        placeholder="Cth: Titip KTP"
                        value={catatanHutang}
                        onChange={e => setCatatanHutang(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', marginTop: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <span style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Total Belanja:</span>
                    <span style={{ fontSize: '28px', fontWeight: '800', color: 'var(--accent)' }}>Rp{totalBelanja.toLocaleString('id-ID')}</span>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: '600' }}>Uang Diterima (Rp)</label>
                    <input 
                      type="text" 
                      placeholder="Masukkan nominal uang..." 
                      value={uangBayar}
                      onChange={handleUangBayarChange}
                      style={{ fontSize: '20px', fontWeight: 'bold', padding: '16px', textAlign: 'right' }}
                    />
                  </div>

                  {!isHutangMode ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '18px', fontWeight: 'bold' }}>
                      <span style={{ color: 'var(--text-primary)' }}>Kembalian:</span>
                      <span style={{ color: kembalian >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        Rp{kembalian > 0 ? parseFloat(kembalian).toLocaleString('id-ID') : 0}
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '18px', fontWeight: 'bold' }}>
                      <span style={{ color: 'var(--text-primary)' }}>Sisa Hutang:</span>
                      <span style={{ color: 'var(--danger)' }}>
                        Rp{Math.abs(kembalian) > 0 ? parseFloat(Math.abs(kembalian)).toLocaleString('id-ID') : 0}
                      </span>
                    </div>
                  )}
                </div>

                <button 
                  className="btn btn-success" 
                  style={{ width: '100%', padding: '18px', fontSize: '18px', letterSpacing: '0.5px', marginTop: '8px' }}
                  onClick={handleCheckout}
                  disabled={cart.length === 0 || (isHutangMode ? (!namaPelanggan || kembalian >= 0) : (!uangBayar || kembalian < 0))}
                >
                  💵 Bayar & Cetak Nota
                </button>
              </div>
            </div>
          </div>
        )}

        {isPosScannerOpen && (
          <BarcodeScanner 
            onScan={handlePosScan} 
            onClose={() => setIsPosScannerOpen(false)} 
          />
        )}
      </div>

      {/* RECEIPT MODAL */}
      {receiptData && (
        <div className="receipt-overlay">
          <div className="receipt-modal printable-receipt" style={{ fontFamily: '"Courier New", Courier, monospace', fontWeight: 'bold' }}>
            {tokoProfile?.logo && (
              <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                <img src={tokoProfile.logo} alt="Logo" style={{ width: '80px', height: '80px', objectFit: 'contain', margin: '0 auto' }} />
              </div>
            )}
            <h2 style={{ textAlign: 'center', marginBottom: '4px', fontSize: '30px', color: 'black', textTransform: 'uppercase' }}>{tokoProfile?.nama_toko || 'KASIR LOKAL'}</h2>
            <div style={{ textAlign: 'center', fontSize: '22px', color: '#000', paddingBottom: '12px', marginBottom: '12px', lineHeight: '1.4' }}>
              {tokoProfile?.alamat && <>{tokoProfile.alamat}<br/></>}
              {tokoProfile?.no_hp && <>{tokoProfile.no_hp}<br/></>}
              <br/>
              NOTA: {receiptData.nota_nomor}<br/>
              WAKTU: {receiptData.date}<br/>
              {receiptData.pelanggan && <>PELANGGAN: {receiptData.pelanggan}</>}
              
              {receiptData.status_pembayaran === 'HUTANG' && (
                <div style={{ marginTop: '8px', padding: '8px', border: '2px dashed #000', display: 'inline-block' }}>
                  <strong>*** BELUM LUNAS (KASBON) ***</strong>
                  {receiptData.tgl_jatuh_tempo && <><br/>Jatuh Tempo: {new Date(receiptData.tgl_jatuh_tempo).toLocaleDateString('id-ID')}</>}
                  {receiptData.catatan_hutang && <><br/>Catatan: {receiptData.catatan_hutang}</>}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'center', marginBottom: '8px', letterSpacing: '2px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              ----------------------------------------------------------------------------------------------------
            </div>

            <table style={{ width: '100%', fontSize: '22px', color: '#000', marginBottom: '12px', borderCollapse: 'collapse' }}>
              <tbody>
                {receiptData.items.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: '4px 0' }}>
                      <span style={{ fontWeight: 'bold' }}>{item.nama_barang.toUpperCase()}</span><br/>
                      <span style={{ color: '#333' }}>{item.qty} {item.satuan_pecahan} x Rp{parseFloat(item.finalPrice).toLocaleString('id-ID')} {item.isGrosir ? '(Grosir)' : ''}</span>
                    </td>
                    <td style={{ textAlign: 'right', verticalAlign: 'bottom', padding: '4px 0' }}>
                      Rp{(item.qty * parseFloat(item.finalPrice)).toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ textAlign: 'center', marginBottom: '12px', letterSpacing: '2px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              ----------------------------------------------------------------------------------------------------
            </div>

            <div style={{ fontSize: '24px', color: '#000', textTransform: 'uppercase' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>TOTAL BELANJA:</span>
                <span style={{ fontWeight: 'bold' }}>Rp{parseFloat(receiptData.total_belanja).toLocaleString('id-ID')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>TUNAI/DP:</span>
                <span>Rp{parseFloat(receiptData.uang_bayar).toLocaleString('id-ID')}</span>
              </div>
              
              {receiptData.status_pembayaran === 'HUTANG' ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span>SISA HUTANG:</span>
                  <span style={{ fontWeight: 'bold' }}>Rp{parseFloat(receiptData.sisa_tagihan).toLocaleString('id-ID')}</span>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span>KEMBALI:</span>
                  <span style={{ fontWeight: 'bold' }}>Rp{parseFloat(receiptData.uang_kembalian).toLocaleString('id-ID')}</span>
                </div>
              )}
            </div>
            
            <p style={{ textAlign: 'center', fontSize: '20px', color: '#000', marginTop: '12px', textTransform: 'uppercase' }}>TERIMA KASIH ATAS KUNJUNGAN ANDA!</p>
            <p style={{ textAlign: 'center', fontSize: '18px', color: '#000', marginTop: '16px', fontWeight: 'bold' }}>POWERED BY KASIRUKM</p>
            
            <div className="no-print" data-html2canvas-ignore="true" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '24px' }}>
              <button className="btn btn-primary" style={{ padding: '16px 8px', fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }} onClick={shareReceiptImage}>
                <span style={{ fontSize: '24px' }}>🖨️</span>
                <span style={{ fontWeight: 'bold' }}>Cetak Bluetooth</span>
              </button>
              <button className="btn" style={{ padding: '16px 8px', fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', backgroundColor: '#e2e8f0', color: '#0f172a' }} onClick={downloadReceiptImage}>
                <span style={{ fontSize: '24px' }}>💾</span>
                <span style={{ fontWeight: 'bold' }}>Simpan Gambar</span>
              </button>
              <button className="btn btn-success" style={{ padding: '16px 8px', fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }} onClick={() => window.print()}>
                <span style={{ fontSize: '24px' }}>📄</span>
                <span style={{ fontWeight: 'bold' }}>PDF / A4</span>
              </button>
              <button className="btn" style={{ padding: '16px 8px', fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', backgroundColor: '#ef4444', color: 'white', border: 'none' }} onClick={() => setReceiptData(null)}>
                <span style={{ fontSize: '24px' }}>✖️</span>
                <span style={{ fontWeight: 'bold' }}>Tutup</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
