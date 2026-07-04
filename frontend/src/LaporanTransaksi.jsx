import React, { useState, useEffect } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const API_URL = '/api';

function LaporanTransaksi() {
  const [transactions, setTransactions] = useState([]);
  
  // Default to last 30 days
  const getPastDate = (days) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  };

  const [startDate, setStartDate] = useState(getPastDate(30));
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [kerugian, setKerugian] = useState([]);
  const [activeTab, setActiveTab] = useState('transaksi');

  const fetchTransactions = async (start, end) => {
    setLoading(true);
    try {
      let url = `${API_URL}/transaksi`;
      if (start && end) {
        url += `?startDate=${start}&endDate=${end}`;
      }
      const response = await axios.get(url);
      setTransactions(response.data);
      
      const kerugianRes = await axios.get(`${API_URL}/barang/laporan-kerugian`);
      setKerugian(kerugianRes.data);
    } catch (err) {
      console.error("Error fetching data", err);
      alert("Gagal memuat data laporan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions(startDate, endDate);
  }, []);

  const handleFilter = () => {
    fetchTransactions(startDate, endDate);
  };

  const downloadPDF = (data, filename) => {
    if (!data || !data.length) return;
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(14);
    doc.text('Laporan Transaksi KasirUKM', 14, 15);
    doc.setFontSize(10);
    doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 14, 22);

    const headers = [['Waktu', 'Nota', 'Pelanggan', 'Kasir', 'Total Belanja', 'Uang Bayar', 'Kembalian', 'Status', 'Sisa Tagihan']];
    const rows = data.map(t => [
      new Date(t.waktu_transaksi).toLocaleString('id-ID'),
      t.nota_nomor,
      t.nama_pelanggan || '-',
      t.nama_kasir || '-',
      `Rp${parseFloat(t.total_belanja || 0).toLocaleString('id-ID')}`,
      `Rp${parseFloat(t.uang_bayar || 0).toLocaleString('id-ID')}`,
      `Rp${parseFloat(t.uang_kembalian || 0).toLocaleString('id-ID')}`,
      t.status_pembayaran || 'LUNAS',
      `Rp${parseFloat(t.sisa_tagihan || 0).toLocaleString('id-ID')}`
    ]);

    doc.autoTable({
      startY: 28,
      head: headers,
      body: rows,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 58, 138] }, // var(--accent)
    });

    doc.save(filename);
  };

  const handleDownloadFiltered = () => {
    if (transactions.length === 0) {
      alert("Tidak ada data untuk didownload.");
      return;
    }
    downloadPDF(transactions, `Laporan_Transaksi_${startDate}_sd_${endDate}.pdf`);
  };

  const handleDownload1Tahun = async () => {
    // Download last 365 days
    const start1Year = getPastDate(365);
    const endToday = new Date().toISOString().split('T')[0];
    try {
      // Alert with an actual confirmation or just show message? Alert is fine.
      // But it halts execution, so we just let it fetch, or use toast.
      const response = await axios.get(`${API_URL}/transaksi?startDate=${start1Year}&endDate=${endToday}`);
      const data1Year = response.data;
      if (data1Year.length === 0) {
        alert("Tidak ada data dalam 1 tahun terakhir.");
        return;
      }
      downloadPDF(data1Year, `Laporan_Transaksi_1_Tahun_${endToday}.pdf`);
    } catch (err) {
      console.error("Error fetching 1 year data", err);
      alert("Gagal memuat data laporan tahunan.");
    }
  };

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Laporan Transaksi</h2>
        <button className="btn btn-success" onClick={handleDownload1Tahun}>
          📥 Download Laporan 1 Tahun (PDF)
        </button>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>Tanggal Mulai</label>
          <input 
            type="date" 
            value={startDate} 
            onChange={e => setStartDate(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--panel-border)', background: 'var(--bg-color)', color: 'var(--text-primary)' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>Tanggal Akhir</label>
          <input 
            type="date" 
            value={endDate} 
            onChange={e => setEndDate(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--panel-border)', background: 'var(--bg-color)', color: 'var(--text-primary)' }}
          />
        </div>
        <button className="btn" onClick={handleFilter}>🔍 Filter</button>
        <button className="btn" onClick={handleDownloadFiltered} style={{ marginLeft: 'auto', background: 'var(--panel-border)' }}>
          📥 Download Data Ditampilkan
        </button>
      </div>

      {/* TAB NAVIGATION */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <button 
          className={`btn ${activeTab === 'transaksi' ? 'btn-success' : ''}`} 
          onClick={() => setActiveTab('transaksi')}
          style={{ padding: '8px 16px', background: activeTab === 'transaksi' ? '' : 'var(--panel-border)' }}
        >
          Laporan Pendapatan (Kasir)
        </button>
        <button 
          className={`btn ${activeTab === 'kerugian' ? 'btn-danger' : ''}`} 
          onClick={() => setActiveTab('kerugian')}
          style={{ padding: '8px 16px', background: activeTab === 'kerugian' ? '' : 'var(--panel-border)' }}
        >
          Laporan Kerugian Stok
        </button>
      </div>

      {activeTab === 'transaksi' && (
        <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <p style={{ textAlign: 'center', padding: '20px' }}>Memuat data...</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Nota</th>
                  <th>Pelanggan</th>
                  <th>Total Belanja</th>
                  <th>Uang Bayar</th>
                  <th>Status</th>
                  <th>Sisa Tagihan</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center' }}>Tidak ada transaksi.</td>
                  </tr>
                ) : (
                  transactions.map(t => (
                    <tr key={t.id}>
                      <td>{new Date(t.waktu_transaksi).toLocaleString('id-ID')}</td>
                      <td>{t.nota_nomor}</td>
                      <td>{t.nama_pelanggan || '-'}</td>
                      <td>Rp{parseFloat(t.total_belanja || 0).toLocaleString('id-ID')}</td>
                      <td>Rp{parseFloat(t.uang_bayar || 0).toLocaleString('id-ID')}</td>
                      <td style={{ fontWeight: 'bold', color: t.status_pembayaran === 'HUTANG' ? 'var(--danger)' : 'var(--success)' }}>
                        {t.status_pembayaran || 'LUNAS'}
                      </td>
                      <td style={{ color: t.sisa_tagihan > 0 ? 'var(--danger)' : 'inherit' }}>
                        Rp{parseFloat(t.sisa_tagihan || 0).toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {transactions.length > 0 && (
                <tfoot style={{ background: '#f8fafc', fontWeight: 'bold' }}>
                  <tr>
                    <td colSpan="3" style={{ textAlign: 'right' }}>Total dari {transactions.length} Transaksi:</td>
                    <td style={{ color: 'var(--accent)' }}>
                      Rp{transactions.reduce((sum, t) => sum + parseFloat(t.total_belanja || 0), 0).toLocaleString('id-ID')}
                    </td>
                    <td>
                      Rp{transactions.reduce((sum, t) => sum + parseFloat(t.uang_bayar || 0), 0).toLocaleString('id-ID')}
                    </td>
                    <td colSpan="2" style={{ color: 'var(--danger)', textAlign: 'right' }}>
                      Piutang: Rp{transactions.reduce((sum, t) => sum + parseFloat(t.sisa_tagihan || 0), 0).toLocaleString('id-ID')}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      )}

      {activeTab === 'kerugian' && (
        <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Tanggal Eksekusi</th>
                <th>Nama Barang</th>
                <th>Batch ID</th>
                <th style={{ textAlign: 'right' }}>Jumlah Dibuang</th>
                <th style={{ textAlign: 'right' }}>Total Kerugian</th>
                <th>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {kerugian.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center' }}>Belum ada riwayat kerugian stok terbuang.</td></tr>
              ) : (
                kerugian.map(k => (
                  <tr key={k.id}>
                    <td>{new Date(k.tanggal).toLocaleString('id-ID')}</td>
                    <td style={{ fontWeight: 'bold' }}>{k.nama_barang || 'Barang Dihapus'}</td>
                    <td>{k.batch_id}</td>
                    <td style={{ textAlign: 'right', color: 'var(--danger)', fontWeight: 'bold' }}>{k.jumlah_stok_terbuang}</td>
                    <td style={{ textAlign: 'right', color: 'var(--danger)', fontWeight: 'bold' }}>Rp{k.nilai_kerugian_rp.toLocaleString('id-ID')}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{k.keterangan}</td>
                  </tr>
                ))
              )}
            </tbody>
            {kerugian.length > 0 && (
              <tfoot style={{ background: '#fef2f2', fontWeight: 'bold' }}>
                <tr>
                  <td colSpan="4" style={{ textAlign: 'right', color: 'var(--danger)' }}>Total Kerugian Keseluruhan:</td>
                  <td colSpan="2" style={{ color: 'var(--danger)' }}>
                    Rp{kerugian.reduce((sum, k) => sum + k.nilai_kerugian_rp, 0).toLocaleString('id-ID')}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

export default LaporanTransaksi;
