import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './index.css';
import Inventory from './Inventory';
import MonitoringStok from './MonitoringStok';
import LaporanTransaksi from './LaporanTransaksi';
import Dashboard from './Dashboard';
import BarcodeScanner from './components/BarcodeScanner';
import Login from './Login';
import UserManagement from './UserManagement';

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
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [isPedagangMode, setIsPedagangMode] = useState(false);
  const [uangBayar, setUangBayar] = useState('');
  const [searchPos, setSearchPos] = useState('');
  const [displayLimit, setDisplayLimit] = useState(10);
  const [namaPelanggan, setNamaPelanggan] = useState('');
  const [receiptData, setReceiptData] = useState(null);
  const [isPosScannerOpen, setIsPosScannerOpen] = useState(false);

  // Check if user is already logged in on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      axios.get(`${API_URL}/auth/me`).then(res => {
        setCurrentUser(JSON.parse(savedUser));
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

  const fetchProducts = () => {
    axios.get(`${API_URL}/barang`).then(res => {
      setProducts(res.data);
    }).catch(err => console.error("Error fetching products", err));
  };

  useEffect(() => {
    if (currentTab === 'pos') {
      fetchProducts();
    }
  }, [currentTab]);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    setCurrentUser(null);
    setCurrentTab('pos');
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
        items
      });
      
      setReceiptData({
        nota_nomor: response.data.nota_nomor,
        uang_kembalian: response.data.uang_kembalian,
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
        <h2>Kasir Lokal POS</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', fontWeight: 'normal' }}>
            {currentUser.role === 'owner' ? '👑' : '🧑‍💻'} {currentUser.username}
          </span>
          <button className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '12px', width: 'auto' }} onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="sidebar">
        <h2>Kasir Lokal POS</h2>
        
        <div className="sidebar-menu">
          <button 
            className={`btn ${currentTab === 'dashboard' ? 'btn-success' : ''}`}
            onClick={() => setCurrentTab('dashboard')}
            style={{ justifyContent: 'flex-start', background: currentTab === 'dashboard' ? '' : 'rgba(255,255,255,0.1)' }}
          >
            📈 Dashboard Analitik
          </button>
          <button 
            className={`btn ${currentTab === 'pos' ? 'btn-success' : ''}`}
            onClick={() => setCurrentTab('pos')}
            style={{ justifyContent: 'flex-start', background: currentTab === 'pos' ? '' : 'rgba(255,255,255,0.1)' }}
          >
            🛒 Transaksi Kasir
          </button>
          <button 
            className={`btn ${currentTab === 'inventory' ? 'btn-success' : ''}`}
            onClick={() => setCurrentTab('inventory')}
            style={{ justifyContent: 'flex-start', background: currentTab === 'inventory' ? '' : 'rgba(255,255,255,0.1)' }}
          >
            📦 Master Barang
          </button>
          <button 
            className={`btn ${currentTab === 'monitoring' ? 'btn-success' : ''}`}
            onClick={() => setCurrentTab('monitoring')}
            style={{ justifyContent: 'flex-start', background: currentTab === 'monitoring' ? '' : 'rgba(255,255,255,0.1)' }}
          >
            📊 Monitoring Stok
          </button>
          <button 
            className={`btn ${currentTab === 'laporan' ? 'btn-success' : ''}`}
            onClick={() => setCurrentTab('laporan')}
            style={{ justifyContent: 'flex-start', background: currentTab === 'laporan' ? '' : 'rgba(255,255,255,0.1)' }}
          >
            📋 Laporan Transaksi
          </button>
          {currentUser.role === 'owner' && (
            <button 
              className={`btn ${currentTab === 'users' ? 'btn-success' : ''}`}
              onClick={() => setCurrentTab('users')}
              style={{ justifyContent: 'flex-start', background: currentTab === 'users' ? '' : 'rgba(255,255,255,0.1)' }}
            >
              👥 Kelola User
            </button>
          )}
        </div>

        <div className="sidebar-footer">
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '8px' }}>
            {currentUser.role === 'owner' ? '👑' : '🧑‍💻'} {currentUser.username} ({currentUser.role})
          </p>
          <button 
            className="btn btn-danger" 
            style={{ width: '100%', padding: '8px', fontSize: '13px' }}
            onClick={handleLogout}
          >
            🚪 Logout
          </button>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="mobile-bottom-nav">
        <button className={`bottom-nav-item ${currentTab === 'dashboard' ? 'active' : ''}`} onClick={() => setCurrentTab('dashboard')}>
          <span>📈</span>Dashboard
        </button>
        <button className={`bottom-nav-item ${currentTab === 'pos' ? 'active' : ''}`} onClick={() => setCurrentTab('pos')}>
          <span>🛒</span>Kasir
        </button>
        <button className={`bottom-nav-item ${currentTab === 'inventory' ? 'active' : ''}`} onClick={() => setCurrentTab('inventory')}>
          <span>📦</span>Barang
        </button>
        <button className={`bottom-nav-item ${currentTab === 'monitoring' ? 'active' : ''}`} onClick={() => setCurrentTab('monitoring')}>
          <span>📊</span>Stok
        </button>
        <button className={`bottom-nav-item ${currentTab === 'laporan' ? 'active' : ''}`} onClick={() => setCurrentTab('laporan')}>
          <span>📋</span>Laporan
        </button>
        {currentUser.role === 'owner' && (
          <button className={`bottom-nav-item ${currentTab === 'users' ? 'active' : ''}`} onClick={() => setCurrentTab('users')}>
            <span>👥</span>Users
          </button>
        )}
      </div>
      
      <div className="main-content">
        {currentTab === 'dashboard' && <Dashboard />}
        {currentTab === 'inventory' && <Inventory />}
        {currentTab === 'monitoring' && <MonitoringStok />}
        {currentTab === 'laporan' && <LaporanTransaksi />}
        {currentTab === 'users' && currentUser.role === 'owner' && <UserManagement />}
        
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
                          Rp{p.harga_jual_ecer.toLocaleString()}
                        </p>
                        <p style={{ fontSize: '12px', color: p.total_stok > 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold' }}>
                          Stok: {p.total_stok}
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
                              @ Rp{price.toLocaleString()}
                              {isGrosir && <span style={{ color: 'var(--success)', marginLeft: '4px', padding: '2px 4px', background: 'rgba(16, 185, 129, 0.2)', borderRadius: '4px' }}>Grosir</span>}
                            </p>
                            <span style={{ fontWeight: 'bold' }}>Rp{(price * q).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--panel-border)' }}>
                <div style={{ marginBottom: '16px' }}>
                  <input 
                    type="text" 
                    placeholder="Nama Pelanggan (Opsional)" 
                    value={namaPelanggan}
                    onChange={(e) => setNamaPelanggan(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '20px', fontWeight: 'bold' }}>
                  <span>Total Belanja:</span>
                  <span style={{ color: 'var(--accent)' }}>Rp{totalBelanja.toLocaleString()}</span>
                </div>
                
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>Uang Bayar (Rp)</label>
                  <input 
                    type="text" 
                    placeholder="Contoh: Rp50.000" 
                    value={uangBayar}
                    onChange={handleUangBayarChange}
                    style={{ fontSize: '18px', fontWeight: 'bold' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '16px', fontWeight: 'bold' }}>
                  <span>Kembalian:</span>
                  <span style={{ color: kembalian >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    Rp{kembalian > 0 ? kembalian.toLocaleString() : 0}
                  </span>
                </div>

                <button 
                  className="btn btn-success" 
                  style={{ width: '100%', padding: '16px', fontSize: '16px' }}
                  onClick={handleCheckout}
                  disabled={cart.length === 0 || !uangBayar || kembalian < 0}
                >
                  Bayar & Cetak Nota
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
          <div className="receipt-modal printable-receipt">
            <h2 style={{ textAlign: 'center', marginBottom: '4px' }}>KASIR LOKAL</h2>
            <p style={{ textAlign: 'center', fontSize: '12px', color: '#666', borderBottom: '1px dashed #ccc', paddingBottom: '12px', marginBottom: '12px' }}>
              Nota: {receiptData.nota_nomor}<br/>
              Waktu: {receiptData.date}<br/>
              {receiptData.pelanggan && <>Pelanggan: {receiptData.pelanggan}</>}
            </p>

            <table style={{ width: '100%', fontSize: '12px', marginBottom: '12px', borderCollapse: 'collapse' }}>
              <tbody>
                {receiptData.items.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: '4px 0' }}>
                      {item.nama_barang}<br/>
                      <span style={{ color: '#666' }}>{item.qty} {item.satuan_pecahan} x Rp{item.finalPrice.toLocaleString()} {item.isGrosir ? '(Grosir)' : ''}</span>
                    </td>
                    <td style={{ textAlign: 'right', verticalAlign: 'bottom', padding: '4px 0' }}>
                      Rp{(item.qty * item.finalPrice).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ borderTop: '1px dashed #ccc', paddingTop: '12px', fontSize: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Total Belanja:</span>
                <span style={{ fontWeight: 'bold' }}>Rp{receiptData.total_belanja.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Tunai:</span>
                <span>Rp{receiptData.uang_bayar.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span>Kembali:</span>
                <span style={{ fontWeight: 'bold' }}>Rp{receiptData.uang_kembalian.toLocaleString()}</span>
              </div>
            </div>
            
            <p style={{ textAlign: 'center', fontSize: '12px', marginTop: '12px' }}>Terima kasih atas kunjungan Anda!</p>
            
            <div className="no-print" style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button className="btn btn-success" style={{ flex: 1 }} onClick={() => window.print()}>🖨️ Print PDF</button>
              <button className="btn" style={{ flex: 1 }} onClick={() => setReceiptData(null)}>Tutup</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
