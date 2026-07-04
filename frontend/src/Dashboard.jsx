import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = '/api';

function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [bestsellers, setBestsellers] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [products, setProducts] = useState([]);
  const [expiringItems, setExpiringItems] = useState([]);
  const [widgetView, setWidgetView] = useState('bestsellers');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [riwayatHarga, setRiwayatHarga] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState('bulanan');

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const [sumRes, bestRes, chartRes, lowRes, prodRes, expRes] = await Promise.all([
          axios.get(`${API_URL}/dashboard/summary?filter=${timeFilter}`),
          axios.get(`${API_URL}/dashboard/bestsellers?filter=${timeFilter}`),
          axios.get(`${API_URL}/dashboard/chart?filter=${timeFilter}`),
          axios.get(`${API_URL}/dashboard/lowstock`),
          axios.get(`${API_URL}/barang`),
          axios.get(`${API_URL}/dashboard/expiring`)
        ]);
        
        setSummary(sumRes.data);
        setBestsellers(bestRes.data);
        setChartData(chartRes.data);
        setLowStock(lowRes.data);
        setProducts(prodRes.data);
        setExpiringItems(expRes.data);
      } catch (err) {
        console.error('Failed to fetch dashboard data', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [timeFilter]);

  const handleSelectProductCustom = async (product) => {
    setSelectedProductId(product.id);
    setSearchTerm(`${product.kode_barang} - ${product.nama_barang}`);
    setIsDropdownOpen(false);
    setRiwayatHarga([]);
    try {
      const res = await axios.get(`${API_URL}/barang/${product.id}/riwayat-harga`);
      setRiwayatHarga(res.data);
    } catch (err) {
      console.error('Failed to fetch riwayat harga', err);
    }
  };

  if (loading) {
    return <div style={{ padding: '24px', textAlign: 'center' }}>Memuat data analitik...</div>;
  }

  if (!summary) {
    return <div style={{ padding: '24px', textAlign: 'center', color: 'red' }}>Gagal memuat data. Pastikan server backend menyala.</div>;
  }

  // Find max for chart scaling
  const maxSales = Math.max(...chartData.map(d => parseFloat(d.total) || 0), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', overflowY: 'auto', paddingRight: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <h2 style={{ margin: 0 }}>Dashboard Analitik</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontWeight: 'bold', fontSize: '14px', color: 'var(--text-secondary)' }}>Periode:</label>
          <select 
            value={timeFilter} 
            onChange={e => setTimeFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--panel-border)', background: 'var(--panel-bg)', color: 'var(--text-primary)', outline: 'none' }}
          >
            <option value="mingguan">7 Hari Terakhir</option>
            <option value="bulanan">30 Hari Terakhir</option>
            <option value="3bulan">3 Bulan Terakhir</option>
            <option value="6bulan">6 Bulan Terakhir</option>
            <option value="1tahun">1 Tahun Terakhir</option>
          </select>
        </div>
      </div>
      
      {lowStock.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde047', padding: '16px', borderRadius: '12px', color: '#854d0e', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div style={{ background: '#fef08a', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>⚠️</div>
          <div>
            <h4 style={{ margin: 0, fontSize: '16px', color: '#713f12' }}>Peringatan Stok Menipis</h4>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px' }}>
              Terdapat <strong>{lowStock.length}</strong> jenis barang yang stoknya sudah di bawah batas minimum. Silakan periksa halaman Monitoring Stok.
            </p>
          </div>
        </div>
      )}

      {/* SUMMARY CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '4px solid var(--accent)' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Omset Hari Ini</p>
          <h3 style={{ fontSize: '28px', color: 'var(--text-primary)', margin: 0, fontWeight: '800' }}>Rp{(summary.pendapatan_hari_ini || 0).toLocaleString('id-ID')}</h3>
        </div>

        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '4px solid var(--success)' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Uang di Laci (Kas Masuk)</p>
          <h3 style={{ fontSize: '28px', color: 'var(--success)', margin: 0, fontWeight: '800' }}>Rp{(summary.kas_masuk_bulan_ini || 0).toLocaleString('id-ID')}</h3>
        </div>

        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '4px solid var(--danger)' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Piutang Berjalan</p>
          <h3 style={{ fontSize: '28px', color: 'var(--danger)', margin: 0, fontWeight: '800' }}>Rp{(summary.total_piutang || 0).toLocaleString('id-ID')}</h3>
          {summary.total_piutang_jatuh_tempo > 0 && (
            <div style={{ marginTop: '8px', padding: '6px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '12px', color: '#b91c1c', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>⚠️ Risiko Macet (Lewat Waktu):</strong>
              <span style={{ fontWeight: 'bold' }}>Rp{(summary.total_piutang_jatuh_tempo || 0).toLocaleString('id-ID')}</span>
            </div>
          )}
        </div>

        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Keuntungan Bersih</p>
            <span style={{ fontSize: '12px', background: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>Periode Ini</span>
          </div>
          <h3 style={{ fontSize: '28px', color: '#f59e0b', margin: 0, fontWeight: '800' }}>Rp{(summary.keuntungan_bulan_ini || 0).toLocaleString('id-ID')}</h3>
          
          <div style={{ marginTop: '8px', paddingTop: '12px', borderTop: '1px solid var(--panel-border)', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Kas Riil (Di Tangan)</span>
              <strong style={{ color: 'var(--success)' }}>Rp{(summary.keuntungan_di_tangan || 0).toLocaleString('id-ID')}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Piutang (Mengendap)</span>
              <strong style={{ color: 'var(--warning)' }}>Rp{(summary.keuntungan_mengendap || 0).toLocaleString('id-ID')}</strong>
            </div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '4px solid #8b5cf6' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nilai Aset Stok</p>
          <h3 style={{ fontSize: '28px', color: '#8b5cf6', margin: 0, fontWeight: '800' }}>Rp{(summary.saldo_toko || 0).toLocaleString('id-ID')}</h3>
        </div>
      </div>

      <div className="grid-2fr-1fr" style={{ display: 'grid', gap: '24px' }}>
        {/* CHART SECTION */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginBottom: '24px' }}>Tren Penjualan ({
            timeFilter === 'mingguan' ? '7 Hari Terakhir' : 
            timeFilter === 'bulanan' ? '30 Hari Terakhir' : 
            timeFilter === '3bulan' ? '3 Bulan Terakhir' : 
            timeFilter === '6bulan' ? '6 Bulan Terakhir' : '1 Tahun Terakhir'
          })</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '200px', paddingBottom: '20px', borderBottom: '1px solid var(--panel-border)', overflowX: 'auto', gap: '4px' }}>
            {chartData.map((data, idx) => {
              const totalVal = parseFloat(data.total) || 0;
              const heightPercent = maxSales > 0 ? (totalVal / maxSales) * 100 : 0;
              // Format date based on length of date string (YYYY-MM vs YYYY-MM-DD)
              const isMonthOnly = data.tanggal.length === 7;
              const dateObj = new Date(data.tanggal);
              let label = '';
              if (isMonthOnly) {
                label = dateObj.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
              } else {
                label = timeFilter === 'mingguan' ? dateObj.toLocaleDateString('id-ID', { weekday: 'short' }) : dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
              }
              
              return (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: '30px', height: '100%' }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', width: '100%' }}>
                    <div 
                      title={`Rp${totalVal.toLocaleString('id-ID')} - ${data.tanggal}`}
                      style={{ 
                        width: '100%', 
                        height: `${heightPercent}%`, 
                        background: 'var(--accent)', 
                        borderRadius: '4px 4px 0 0',
                        minHeight: totalVal > 0 ? '4px' : '0',
                        transition: 'height 0.5s ease'
                      }} 
                    />
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '8px', whiteSpace: 'nowrap' }}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* DYNAMIC WIDGET */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '18px' }}>
              {widgetView === 'bestsellers' && 'Barang Terlaris'}
              {widgetView === 'expiring' && 'Segera Expired (H-7)'}
              {widgetView === 'restock' && 'Perlu Restock'}
            </h3>
            <select 
              value={widgetView} 
              onChange={(e) => setWidgetView(e.target.value)}
              style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--panel-border)', background: 'var(--panel-bg)', color: 'var(--text-primary)', outline: 'none', flex: 1, minWidth: '120px' }}
            >
              <option value="bestsellers">Terlaris</option>
              <option value="expiring">H-7 Expired</option>
              <option value="restock">Perlu Restock</option>
            </select>
          </div>

          <div className="table-container" style={{ flex: 1, boxShadow: 'none', border: 'none', maxHeight: '350px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nama Barang</th>
                  <th style={{ textAlign: 'right' }}>
                    {widgetView === 'bestsellers' ? 'Terjual' : 
                     widgetView === 'expiring' ? 'Tgl Expired' : 'Sisa Stok'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {widgetView === 'bestsellers' && (
                  bestsellers.length === 0 ? (
                    <tr><td colSpan="2" style={{ textAlign: 'center' }}>Belum ada data</td></tr>
                  ) : (
                    bestsellers.map((b, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 'bold' }}>{b.nama_barang}</td>
                        <td style={{ textAlign: 'right', color: 'var(--success)', fontWeight: 'bold' }}>
                          {parseFloat(b.total_terjual || 0).toLocaleString('id-ID')} <span style={{ fontSize: '11px', fontWeight: 'normal', color: 'var(--text-secondary)' }}>{b.satuan_pecahan}</span>
                        </td>
                      </tr>
                    ))
                  )
                )}

                {widgetView === 'expiring' && (
                  expiringItems.length === 0 ? (
                    <tr><td colSpan="2" style={{ textAlign: 'center' }}>Aman, tidak ada yang segera expired</td></tr>
                  ) : (
                    expiringItems.map((e, idx) => {
                      const isExpired = new Date(e.tgl_expired) < new Date();
                      return (
                        <tr key={idx}>
                          <td style={{ fontWeight: 'bold' }}>
                            {e.nama_barang}
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'normal', marginTop: '2px' }}>
                              Batch: {e.no_batch} ({parseFloat(e.stok_batch).toLocaleString('id-ID')} {e.satuan_pecahan})
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', color: isExpired ? 'var(--danger)' : 'var(--warning)', fontWeight: 'bold' }}>
                            {new Date(e.tgl_expired).toLocaleDateString('id-ID')}
                            {isExpired && <div style={{ fontSize: '10px', color: 'var(--danger)', marginTop: '2px' }}>(Expired)</div>}
                          </td>
                        </tr>
                      );
                    })
                  )
                )}

                {widgetView === 'restock' && (
                  lowStock.length === 0 ? (
                    <tr><td colSpan="2" style={{ textAlign: 'center' }}>Stok aman, belum ada yang perlu restock</td></tr>
                  ) : (
                    lowStock.map((l, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 'bold' }}>
                          {l.nama_barang}
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'normal', marginTop: '2px' }}>
                            Min Stok: {parseFloat(l.stok_minimum).toLocaleString('id-ID')} {l.satuan_pecahan}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', color: l.total_stok === 0 ? 'var(--danger)' : 'var(--warning)', fontWeight: 'bold' }}>
                          {parseFloat(l.total_stok || 0).toLocaleString('id-ID')} <span style={{ fontSize: '11px', fontWeight: 'normal', color: 'var(--text-secondary)' }}>{l.satuan_pecahan}</span>
                        </td>
                      </tr>
                    ))
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SUPPLIER SEARCH */}
      <div className="glass-panel">
        <h3 style={{ marginBottom: '16px' }}>Pencarian Harga Supplier Termurah</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>Pilih barang untuk melihat riwayat harga modal dan rekomendasi supplier terbaik.</p>
        
        <div style={{ position: 'relative', width: '100%', maxWidth: '400px', marginBottom: '20px' }}>
          <input 
            type="text" 
            placeholder="Ketik untuk mencari kode atau nama barang..." 
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsDropdownOpen(true);
              if (e.target.value === '') {
                setSelectedProductId('');
                setRiwayatHarga([]);
              }
            }}
            onFocus={() => setIsDropdownOpen(true)}
            onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
            style={{ 
              width: '100%', 
              padding: '10px 14px', 
              borderRadius: '6px', 
              border: '1px solid var(--panel-border)', 
              background: 'var(--panel-bg)', 
              color: 'var(--text-primary)', 
              outline: 'none',
              fontSize: '14px'
            }}
          />
          {isDropdownOpen && (
            <div style={{ 
              position: 'absolute', 
              top: '100%', 
              left: 0, 
              right: 0, 
              background: 'var(--panel-bg)', 
              border: '1px solid var(--panel-border)', 
              borderRadius: '6px', 
              marginTop: '4px', 
              maxHeight: '250px', 
              overflowY: 'auto', 
              zIndex: 10, 
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)' 
            }}>
              {products.filter(p => p.nama_barang.toLowerCase().includes(searchTerm.toLowerCase()) || p.kode_barang.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: '14px' }}>Barang tidak ditemukan</div>
              ) : (
                products.filter(p => p.nama_barang.toLowerCase().includes(searchTerm.toLowerCase()) || p.kode_barang.toLowerCase().includes(searchTerm.toLowerCase())).map(p => (
                  <div 
                    key={p.id} 
                    style={{ 
                      padding: '10px 14px', 
                      cursor: 'pointer', 
                      borderBottom: '1px solid var(--panel-border)', 
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px'
                    }}
                    onMouseDown={() => handleSelectProductCustom(p)}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(100,100,100,0.1)' }
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent' }
                  >
                    <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>{p.nama_barang}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{p.kode_barang}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {selectedProductId && (
          <div className="table-container" style={{ maxHeight: '300px' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tanggal Masuk</th>
                  <th>Nama Supplier</th>
                  <th style={{ textAlign: 'right' }}>Harga Modal (Aktual)</th>
                </tr>
              </thead>
              <tbody>
                {riwayatHarga.length === 0 ? (
                  <tr><td colSpan="3" style={{ textAlign: 'center' }}>Belum ada riwayat restock / harga modal untuk barang ini.</td></tr>
                ) : (
                  riwayatHarga.map((r, idx) => {
                    const isTermurah = r.harga_beli_aktual === Math.min(...riwayatHarga.map(x => x.harga_beli_aktual));
                    return (
                      <tr key={idx} style={isTermurah ? { background: '#f0fdf4', fontWeight: 'bold' } : {}}>
                        <td>{new Date(r.tgl_masuk).toLocaleDateString('id-ID')}</td>
                        <td>{r.nama_supplier || '-'}</td>
                        <td style={{ textAlign: 'right', color: isTermurah ? '#166534' : 'inherit' }}>
                          Rp{(r.harga_beli_aktual || 0).toLocaleString('id-ID')}
                          {isTermurah && <span style={{ marginLeft: '8px', fontSize: '11px', background: '#166534', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>Termurah</span>}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}

export default Dashboard;
