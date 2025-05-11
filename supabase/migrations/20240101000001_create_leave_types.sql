-- Buat tabel leave_types
CREATE TABLE IF NOT EXISTS leave_types (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Isi data awal untuk jenis cuti
INSERT INTO leave_types (code, name, description) VALUES
('CUTI_TAHUNAN', 'Cuti Tahunan', 'Cuti reguler tahunan yang diberikan kepada semua pegawai.'),
('CUTI_SAKIT', 'Cuti Sakit', 'Digunakan ketika Anda sakit dan tidak dapat bekerja. Mungkin memerlukan surat keterangan dokter.'),
('CUTI_MELAHIRKAN', 'Cuti Melahirkan', 'Untuk pegawai wanita sebelum dan sesudah melahirkan. Biasanya berdurasi 3 bulan.'),
('CUTI_ALASAN_PENTING', 'Cuti Alasan Penting', 'Untuk urusan pribadi penting seperti pernikahan, kedukaan, atau keadaan darurat keluarga.'),
('CUTI_BESAR', 'Cuti Besar', 'Cuti jangka panjang, biasanya diberikan setelah periode tertentu masa kerja.'),
('CUTI_DILUAR_TANGGUNGAN', 'Cuti Di Luar Tanggungan Negara', 'Cuti tanpa dibayar, digunakan ketika jenis cuti lain telah habis atau untuk keadaan khusus.');
