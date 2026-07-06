import React, { useState, useEffect } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';

const API_URL = '/api';

function Hutang() {
  const [hutangList, setHutangList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('Semua'); // Semua, Aman, Hampir, Telat
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedHutang, setSelectedHutang] = useState(null);
  const [jumlahBayar, setJumlahBayar] = useState('');
  
  const [receiptData, setReceiptData] = useState(null);
  const [tokoProfile, setTokoProfile] = useState(null);

  const fetchTokoProfile = async () => {
    try {
      const res = await axios.get(`${API_URL}/toko`);
      setTokoProfile(res.data);
    } catch (err) {
      console.error("Error fetching toko profile", err);
    }
  };

  useEffect(() => {
    fetchHutang();
    fetchTokoProfile();
  }, []);

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
        const file = new File([blob], `cicilan-${receiptData.nota_asli}.png`, { type: 'image/png' });
        
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              title: 'Bukti Cicilan',
              text: `Cicilan Nota: ${receiptData.nota_asli}`,
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
        link.download = `cicilan-${receiptData.nota_asli}.png`;
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
      link.download = `cicilan-${receiptData.nota_asli}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error generating receipt image:', err);
      alert('Gagal mendownload nota.');
    }
  };

  const fetchHutang = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/transaksi/hutang`);
      setHutangList(response.data);
    } catch (err) {
      console.error("Error fetching hutang", err);
      alert("Gagal memuat daftar hutang.");
    } finally {
      setLoading(false);
    }
  };

  const handleBayarClick = (hutang) => {
    setSelectedHutang(hutang);
    setJumlahBayar('');
    setIsModalOpen(true);
  };

  const handleJumlahBayarChange = (e) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    if (!rawValue) {
      setJumlahBayar('');
      return;
    }
    const formatted = "Rp" + parseInt(rawValue, 10).toLocaleString('id-ID');
    setJumlahBayar(formatted);
  };

  const submitBayar = async (e) => {
    e.preventDefault();
    const parsedBayar = jumlahBayar ? parseFloat(jumlahBayar.replace(/\D/g, '')) : 0;
    
    if (parsedBayar <= 0) {
      alert("Jumlah bayar harus lebih dari 0");
      return;
    }
    
    if (parsedBayar > selectedHutang.sisa_tagihan) {
      alert("Jumlah bayar tidak boleh lebih besar dari sisa tagihan!");
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/transaksi/${selectedHutang.id}/bayar-hutang`, {
        jumlah_bayar: parsedBayar
      });
      
      alert(response.data.message);
      
      // Prepare receipt data
      setReceiptData({
        nota_nomor: `CICILAN-${selectedHutang.nota_nomor}`,
        date: new Date().toLocaleString('id-ID'),
        pelanggan: selectedHutang.nama_pelanggan,
        nota_asli: selectedHutang.nota_nomor,
        sisa_sebelumnya: selectedHutang.sisa_tagihan,
        dibayar: parsedBayar,
        sisa_sekarang: response.data.new_sisa,
        status: response.data.new_status
      });

      setIsModalOpen(false);
      fetchHutang();
    } catch (err) {
      alert(`Gagal menyimpan pembayaran: ${err.response?.data?.message || err.message}`);
    }
  };

  // Helper: Calculate days between two dates
  const getDaysDifference = (targetDateStr) => {
    if (!targetDateStr) return null;
    const targetDate = new Date(targetDateStr);
    targetDate.setHours(0,0,0,0);
    const today = new Date();
    today.setHours(0,0,0,0);
    const diffTime = targetDate - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // positive if future, negative if past
  };

  const filteredHutang = hutangList.filter(h => {
    // 1. Search Query
    const matchSearch = (h.nama_pelanggan || '').toLowerCase().includes(searchQuery.toLowerCase()) || h.nota_nomor.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchSearch) return false;

    // 2. Filter Status
    if (filterStatus === 'Semua') return true;
    
    const diffDays = getDaysDifference(h.tgl_jatuh_tempo);
    
    if (filterStatus === 'Aman') {
      return diffDays === null || diffDays > 3; // No date or more than 3 days left
    } else if (filterStatus === 'Hampir') {
      return diffDays !== null && diffDays >= 0 && diffDays <= 3; // 0 to 3 days left
    } else if (filterStatus === 'Telat') {
      return diffDays !== null && diffDays < 0; // Past due
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Buku Hutang (Piutang Pelanggan)</h2>
      </div>

      <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--panel-border)', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 300px' }}>
            <input 
              type="text" 
              placeholder="🔍 Cari Nama Pelanggan atau No Nota..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ flex: '0 0 200px' }}>
            <select 
              value={filterStatus} 
              onChange={e => setFilterStatus(e.target.value)}
              style={{ width: '100%', cursor: 'pointer', fontWeight: 'bold' }}
            >
              <option value="Semua">📋 Semua Status</option>
              <option value="Aman">✅ Masih Aman</option>
              <option value="Hampir">⏳ Hampir Jatuh Tempo</option>
              <option value="Telat">⚠️ Sudah Lewat (Macet)</option>
            </select>
          </div>
        </div>
        
        <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <p style={{ textAlign: 'center', padding: '20px' }}>Memuat data...</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tanggal Nota</th>
                  <th>Nota Belanja</th>
                  <th>Pelanggan</th>
                  <th>Jatuh Tempo</th>
                  <th style={{ textAlign: 'right' }}>Total Belanja</th>
                  <th style={{ textAlign: 'right' }}>Sisa Hutang</th>
                  <th style={{ textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredHutang.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center' }}>Tidak ada data pelanggan yang berhutang.</td>
                  </tr>
                ) : (
                  filteredHutang.map(h => (
                    <tr key={h.id}>
                      <td>{new Date(h.waktu_transaksi).toLocaleDateString('id-ID')}</td>
                      <td>{h.nota_nomor}</td>
                      <td style={{ fontWeight: 'bold' }}>
                        {h.nama_pelanggan || '-'}
                        {h.no_hp && <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'normal' }}>{h.no_hp}</div>}
                      </td>
                      <td style={{ 
                        color: getDaysDifference(h.tgl_jatuh_tempo) < 0 ? 'var(--danger)' : getDaysDifference(h.tgl_jatuh_tempo) <= 3 && getDaysDifference(h.tgl_jatuh_tempo) !== null ? 'var(--warning)' : 'inherit', 
                        fontWeight: getDaysDifference(h.tgl_jatuh_tempo) <= 3 && getDaysDifference(h.tgl_jatuh_tempo) !== null ? 'bold' : 'normal' 
                      }}>
                        <div style={{ marginBottom: '2px' }}>
                          {h.tgl_jatuh_tempo ? new Date(h.tgl_jatuh_tempo).toLocaleDateString('id-ID') : '-'}
                        </div>
                        
                        {/* Status Label */}
                        {(() => {
                          const diff = getDaysDifference(h.tgl_jatuh_tempo);
                          if (diff === null) return null;
                          if (diff < 0) return <div style={{ fontSize: '11px', padding: '2px 6px', background: '#fef2f2', color: 'var(--danger)', borderRadius: '4px', display: 'inline-block' }}>⚠️ Telat {Math.abs(diff)} Hari</div>;
                          if (diff === 0) return <div style={{ fontSize: '11px', padding: '2px 6px', background: '#fef3c7', color: '#d97706', borderRadius: '4px', display: 'inline-block' }}>⏳ Hari Ini</div>;
                          if (diff <= 3) return <div style={{ fontSize: '11px', padding: '2px 6px', background: '#fef3c7', color: '#d97706', borderRadius: '4px', display: 'inline-block' }}>⏳ Sisa {diff} Hari</div>;
                          return null;
                        })()}
                      </td>
                      <td style={{ textAlign: 'right' }}>Rp{parseFloat(h.total_belanja).toLocaleString('id-ID')}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--danger)' }}>
                        Rp{parseFloat(h.sisa_tagihan).toLocaleString('id-ID')}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button className="btn btn-success" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleBayarClick(h)}>
                          💵 Terima Cicilan
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredHutang.length > 0 && (
                <tfoot style={{ background: '#fef2f2', fontWeight: 'bold' }}>
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'right', color: 'var(--danger)' }}>Total Piutang Berjalan:</td>
                    <td style={{ color: 'var(--danger)', textAlign: 'right' }}>
                      Rp{filteredHutang.reduce((sum, h) => sum + parseFloat(h.sisa_tagihan || 0), 0).toLocaleString('id-ID')}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </div>

      {isModalOpen && selectedHutang && (
        <div className="receipt-overlay">
          <div className="receipt-modal" style={{ width: '400px', maxWidth: '90%' }}>
            <h2 style={{ marginBottom: '16px' }}>Terima Pembayaran</h2>
            <div style={{ marginBottom: '16px', padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>Pelanggan: <strong style={{ color: '#000' }}>{selectedHutang.nama_pelanggan}</strong></p>
              <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>Sisa Hutang Saat Ini:</p>
              <h3 style={{ margin: 0, color: 'var(--danger)', fontSize: '24px' }}>Rp{parseFloat(selectedHutang.sisa_tagihan).toLocaleString('id-ID')}</h3>
            </div>
            
            <form onSubmit={submitBayar}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>Jumlah Uang Diterima (Rp)</label>
                <input 
                  type="text" 
                  placeholder="Contoh: Rp50.000" 
                  value={jumlahBayar}
                  onChange={handleJumlahBayarChange}
                  style={{ fontSize: '18px', fontWeight: 'bold', width: '100%', padding: '12px' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-danger" onClick={() => setIsModalOpen(false)}>Batal</button>
                <button type="submit" className="btn btn-success" disabled={!jumlahBayar}>Simpan & Cetak Struk</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
              <div style={{ fontSize: '24px', fontWeight: 'bold', margin: '8px 0', textTransform: 'uppercase' }}>*** BUKTI CICILAN ***</div>
              WAKTU: {receiptData.date}<br/>
              NOTA ASLI: {receiptData.nota_asli}<br/>
              PELANGGAN: {receiptData.pelanggan}
            </div>
            
            <div style={{ textAlign: 'center', marginBottom: '8px', letterSpacing: '2px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              ----------------------------------------------------------------------------------------------------
            </div>

            <div style={{ fontSize: '24px', color: '#000', textTransform: 'uppercase' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Sisa Sblmnya:</span>
                <span style={{ fontWeight: 'bold' }}>Rp{parseFloat(receiptData.sisa_sebelumnya).toLocaleString('id-ID')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Dibayar:</span>
                <span style={{ fontWeight: 'bold' }}>Rp{parseFloat(receiptData.dibayar).toLocaleString('id-ID')}</span>
              </div>
              
              <div style={{ textAlign: 'center', margin: '8px 0', letterSpacing: '2px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                ----------------------------------------------------------------------------------------------------
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Sisa Hutang:</span>
                <span style={{ fontWeight: 'bold', color: receiptData.status === 'LUNAS' ? 'green' : 'inherit' }}>
                  Rp{parseFloat(receiptData.sisa_sekarang).toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <div style={{ textAlign: 'center', margin: '12px 0', letterSpacing: '2px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              ----------------------------------------------------------------------------------------------------
            </div>

            <div style={{ textAlign: 'center', fontSize: '24px', fontWeight: 'bold', color: receiptData.status === 'LUNAS' ? 'green' : '#000', marginBottom: '16px' }}>
              STATUS: {receiptData.status}
            </div>
            
            <p style={{ textAlign: 'center', fontSize: '20px', color: '#000', marginTop: '12px', textTransform: 'uppercase' }}>Terima kasih atas pembayarannya!</p>
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

export default Hutang;
