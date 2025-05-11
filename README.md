# ELCUTI - Sistem Elektronik Cuti

ELCUTI adalah aplikasi manajemen cuti elektronik untuk instansi pemerintah yang memudahkan pegawai dalam mengajukan, memproses, dan melacak permohonan cuti.

## Fitur Utama

- **Manajemen Cuti Terpadu**: Pengelolaan berbagai jenis cuti (Tahunan, Sakit, Melahirkan, dll)
- **Sistem Approval Berjenjang**: Persetujuan dua level (Atasan Langsung dan Pejabat Berwenang)
- **Perhitungan Saldo Cuti Otomatis**: Menghitung saldo cuti tersisa berdasarkan kebijakan carry-over
- **Kalendar Cuti**: Visualisasi cuti pegawai dalam bentuk kalendar
- **Dashboard Informatif**: Informasi saldo cuti dan status permohonan
- **Tanda Tangan Elektronik**: Penandatanganan digital untuk proses persetujuan

## Teknologi

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase PostgreSQL
- **Authentication**: JWT (JSON Web Token)

## Struktur Aplikasi

- **/app**: Komponen halaman utama aplikasi (menggunakan Next.js App Router)
- **/components**: Komponen UI yang dapat digunakan kembali
- **/lib**: Utilitas, konteks auth, dan fungsi helper
- **/public**: Aset statis
- **/hooks**: Custom React hooks

## Jenis Cuti yang Didukung

1. Cuti Tahunan
2. Cuti Besar
3. Cuti Sakit
4. Cuti Melahirkan
5. Cuti Karena Alasan Penting
6. Cuti di Luar Tanggungan Negara

## Manajemen Saldo Cuti

- Saldo cuti tahunan: 12 hari per tahun
- Carry-over maksimal 6 hari ke tahun berikutnya (N-1)
- Prioritas penggunaan: cuti carry-over (N-1) digunakan terlebih dahulu

## Cara Penggunaan

### Untuk Pegawai:
1. Login dengan NIP dan password
2. Lihat saldo cuti di dashboard
3. Klik "Ajukan Cuti" untuk membuat permohonan baru
4. Isi formulir dan pilih jenis cuti, tanggal mulai dan selesai
5. Sistem otomatis menghitung hari kerja dengan mempertimbangkan akhir pekan dan hari libur
6. Pilih atasan langsung dan pejabat berwenang
7. Kirim permohonan

### Untuk Atasan:
1. Login dengan NIP dan password
2. Lihat notifikasi permohonan cuti yang menunggu
3. Tinjau permohonan cuti
4. Tandatangani dan setujui/tolak permohonan

## Administrasi

Admin dapat:
- Mengelola pengguna
- Mengatur hari libur
- Menetapkan saldo cuti pegawai
- Melakukan reset password
- Memantau dan mengelola semua permohonan cuti

## Pengembangan

Untuk menjalankan aplikasi di lingkungan pengembangan:

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Run development server
npm run dev
```

## Lisensi

© 2024 Kankemenag Kota Tanjungpinang. Hak Cipta Dilindungi.
