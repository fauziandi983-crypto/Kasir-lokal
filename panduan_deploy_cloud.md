# Panduan Migrasi Database & Deploy ke Cloud (Gratis)

Panduan ini disusun khusus untuk membantu Anda memindahkan Sistem Kasir Lokal ini dari komputer lokal ke server online agar bisa diakses dari mana saja (seperti tablet Android, HP, atau komputer lain).

---

## 1. Persiapan Database Online (PostgreSQL)

Karena layanan hosting gratis biasanya menghapus file lokal (`.sqlite`) setiap kali server direstart, kita perlu memindahkan penyimpanan data ke **Supabase** (layanan database PostgreSQL gratis).

### Langkah 1: Buat Akun Supabase
1. Buka [https://supabase.com/](https://supabase.com/) dan klik **"Start your project"**.
2. Buat akun menggunakan GitHub atau Email Anda.
3. Setelah login, klik **"New Project"**.
4. Isi data proyek:
   - **Name**: `kasir-lokal` (atau apa saja).
   - **Database Password**: Buat password yang kuat dan **catat baik-baik** (jangan sampai lupa).
   - **Region**: Pilih **Singapore** (agar lebih cepat diakses dari Indonesia).
5. Tunggu sekitar 2-3 menit sampai database selesai disiapkan.

### Langkah 2: Dapatkan URL Koneksi Database
1. Di *dashboard* Supabase Anda, masuk ke menu **Settings** (ikon gerigi di kiri bawah).
2. Pilih menu **Database**.
3. Gulir ke bawah ke bagian **Connection parameters**, dan cari opsi **URI**.
4. Copy URI tersebut. Formatnya kurang lebih seperti ini:
   `postgresql://postgres:[YOUR-PASSWORD]@db.[id-supabase].supabase.co:5432/postgres`
5. Ganti `[YOUR-PASSWORD]` dengan password yang Anda buat di Langkah 1.

---

## 2. Modifikasi Kode Backend

Saat ini backend menggunakan `sqlite3`. Kita harus mengubahnya agar bisa membaca PostgreSQL.

### Langkah 1: Install Driver PostgreSQL
Di terminal Anda, masuk ke folder `backend` lalu jalankan:
```bash
npm install pg
```

### Langkah 2: Edit file `backend/db.js`
Ubah **seluruh isi** file `backend/db.js` menjadi seperti ini:

```javascript
const { Pool } = require('pg');

let pool;

async function getDB() {
  if (!pool) {
    // Membaca URL database dari environment variables (disediakan oleh hosting nanti)
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
      throw new Error("DATABASE_URL belum diatur di server!");
    }

    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false
      }
    });
  }
  
  return {
    // Ini membuat "wrapper" sederhana agar sintaks kita yang tadinya sqlite3 (db.all, db.get, db.run) 
    // bisa tetap jalan di PostgreSQL tanpa perlu merombak seluruh query backend.
    all: async (sql, params = []) => {
      const result = await pool.query(sql.replace(/\?/g, (match, offset, string) => {
        // Mengubah tanda tanya (?) di SQLite menjadi $1, $2 di PostgreSQL
        let count = 0;
        for (let i = 0; i < offset; i++) { if (string[i] === '?') count++; }
        return `$${count + 1}`;
      }), params);
      return result.rows;
    },
    get: async (sql, params = []) => {
      const result = await pool.query(sql.replace(/\?/g, (match, offset, string) => {
        let count = 0;
        for (let i = 0; i < offset; i++) { if (string[i] === '?') count++; }
        return `$${count + 1}`;
      }), params);
      return result.rows[0];
    },
    run: async (sql, params = []) => {
      const result = await pool.query(sql.replace(/\?/g, (match, offset, string) => {
        let count = 0;
        for (let i = 0; i < offset; i++) { if (string[i] === '?') count++; }
        return `$${count + 1}`;
      }), params);
      return { lastID: result.rows[0]?.id || null, changes: result.rowCount };
    }
  };
}

module.exports = { getDB };
```

### Langkah 3: Modifikasi `init.sql` (Skema Database)
File `init.sql` saat ini ditulis dalam format SQLite. Anda harus mengubah tipe datanya sedikit agar cocok dengan PostgreSQL.
- Ubah `INTEGER PRIMARY KEY AUTOINCREMENT` menjadi `SERIAL PRIMARY KEY`.
- Ubah tipe data `DATETIME` menjadi `TIMESTAMP`.
*(Jika Anda membutuhkan bantuan teknis untuk mengkonversi ini nanti, berikan kode `init.sql` Anda ke AI dan minta untuk di-translate ke format PostgreSQL).*

---

## 3. Upload & Deploy Server (Gratis via Render.com)

1. Buat akun di **[GitHub.com](https://github.com/)**.
2. *Upload* seluruh folder Kasir Lokal Anda ke dalam satu *repository* GitHub.
3. Buka **[Render.com](https://render.com/)** dan buat akun gratis (bisa login pakai GitHub).
4. Di dashboard Render, klik **"New +"** lalu pilih **"Web Service"**.
5. Hubungkan akun GitHub Anda, lalu pilih *repository* Kasir Lokal.
6. Isi pengaturan berikut:
   - **Name**: `kasir-backend`
   - **Root Directory**: `backend` (sangat penting!)
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: Pilih yang "Free".
7. Di bagian bawah, klik **"Advanced"**, lalu klik **"Add Environment Variable"**.
   - **Key**: `DATABASE_URL`
   - **Value**: *(Masukkan URL Koneksi Supabase dari tahap 1)*
8. Klik **Create Web Service**. Tunggu sekitar 5 menit sampai statusnya menjadi "Live".
9. Catat URL server Anda (misal: `https://kasir-backend.onrender.com`).

---

## 4. Deploy Frontend (Aplikasi Web/React)

Setelah backend online, kita buat frontend-nya online menggunakan Vercel. Karena aplikasi kita menggunakan *proxy* `/api` untuk menghubungi backend, kita perlu memberi tahu Vercel ke mana arah API tersebut di server produksi.

1. Buka folder `frontend` di komputer Anda.
2. Buat file baru bernama `vercel.json` di dalam folder `frontend` (sejajar dengan `package.json`).
3. Isi file `vercel.json` dengan kode berikut:
   ```json
   {
     "rewrites": [
       {
         "source": "/api/:path*",
         "destination": "https://kasir-backend.onrender.com/api/:path*"
       },
       {
         "source": "/(.*)",
         "destination": "/index.html"
       }
     ]
   }
   ```
   *(Penting: Ganti `https://kasir-backend.onrender.com` dengan URL backend Anda yang sesungguhnya dari Render).*
4. Lakukan *commit* dan dorong (push) perubahan ini ke GitHub Anda.
5. Buka **[Vercel.com](https://vercel.com/)** dan login dengan GitHub.
6. Klik **"Add New"** -> **"Project"**.
7. Pilih *repository* GitHub Anda dan klik **Import**.
8. Pada bagian **Root Directory**, klik Edit dan pilih `frontend`.
9. Klik **Deploy**.
10. Selesai! Vercel akan memberikan link website (misal `https://kasir-lokal.vercel.app`) yang bisa dibuka langsung di Tablet Android / HP klien Anda!

> **Tips Ekstra untuk Tablet Android / HP:**
> Tampilan web ini sudah dirancang **Responsif (Mobile-Friendly)** dengan *Bottom Navigation* bergaya aplikasi native.
> Jika Anda membuka link Vercel tersebut di browser Google Chrome Android, klik tombol titik tiga (menu) di kanan atas, lalu pilih **"Tambahkan ke Layar Utama" (Add to Home screen)**. Aplikasi kasir akan terinstal dan terasa seperti aplikasi lokal biasa!
