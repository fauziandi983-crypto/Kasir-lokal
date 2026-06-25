import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

function BarcodeScanner({ onScan, onClose }) {
  // Gunakan ID unik agar tidak bentrok di React 18 Strict Mode
  const [readerId] = useState(() => `reader-${Math.random().toString(36).substr(2, 9)}`);
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let isMounted = true;
    const html5QrCode = new Html5Qrcode(readerId);

    html5QrCode.start(
      { facingMode: "environment" },
      {
        fps: 10,
        // Ubah bentuk area scan menjadi persegi panjang (cocok untuk barcode batang 1D)
        qrbox: { width: 300, height: 150 },
        // disableFlip false agar bisa menangani kamera depan laptop yang biasanya seperti cermin (mirrored)
        disableFlip: false 
      },
      (decodedText) => {
        if (onScanRef.current) {
          onScanRef.current(decodedText);
        }
        if (isMounted) {
          html5QrCode.stop().catch(console.error);
        }
      },
      undefined
    ).then(() => {
      // PENTING: Jika komponen keburu ditutup (unmount) saat kamera sedang loading menyala,
      // kita harus segera mematikan kameranya begitu proses loading selesai.
      if (!isMounted) {
        html5QrCode.stop().catch(console.error);
      }
    }).catch(err => {
      console.error("Gagal memulai kamera:", err);
    });

    return () => {
      isMounted = false;
      if (html5QrCode.isScanning) {
        html5QrCode.stop().catch(err => console.error("Gagal menghentikan kamera:", err));
      }
    };
  }, [readerId]);

  return (
    <div className="receipt-overlay" style={{ zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', background: 'var(--panel-bg)', padding: '24px', borderRadius: '12px' }}>
        <h3 style={{ marginBottom: '16px', textAlign: 'center' }}>Arahkan Kamera ke Barcode</h3>
        
        <div id={readerId} style={{ width: '100%', minHeight: '300px', background: '#000', borderRadius: '8px', overflow: 'hidden' }}></div>
        
        <button 
          className="btn btn-danger" 
          style={{ width: '100%', marginTop: '20px' }}
          onClick={() => onClose()}
        >
          Batal & Tutup
        </button>
      </div>
    </div>
  );
}

export default BarcodeScanner;
