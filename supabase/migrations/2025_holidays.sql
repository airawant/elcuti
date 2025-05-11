-- Hari Libur Nasional dan Cuti Bersama 2025

-- Hapus data yang mungkin sudah ada untuk tahun 2025
DELETE FROM holidays WHERE EXTRACT(YEAR FROM date) = 2025;

-- Insert Hari Libur Nasional 2025
INSERT INTO holidays (name, date, description) VALUES
-- Januari
('Tahun Baru 2025', '2025-01-01', 'Hari Libur Nasional'),

-- Februari
('Tahun Baru Imlek 2576 Kongzili', '2025-02-01', 'Hari Libur Nasional'),

-- Maret
('Isra Mikraj Nabi Muhammad SAW', '2025-03-01', 'Hari Libur Nasional'),
('Hari Suci Nyepi Tahun Baru Saka 1947', '2025-03-30', 'Hari Libur Nasional'),

-- April
('Wafat Isa Al Masih', '2025-04-18', 'Hari Libur Nasional'),
('Hari Raya Idul Fitri 1446 Hijriah', '2025-04-21', 'Hari Libur Nasional'),
('Hari Raya Idul Fitri 1446 Hijriah', '2025-04-22', 'Hari Libur Nasional'),

-- Mei
('Hari Buruh Internasional', '2025-05-01', 'Hari Libur Nasional'),
('Kenaikan Isa Al Masih', '2025-05-29', 'Hari Libur Nasional'),
('Hari Raya Waisak 2569', '2025-05-31', 'Hari Libur Nasional'),

-- Juni
('Hari Lahir Pancasila', '2025-06-01', 'Hari Libur Nasional'),

-- Agustus
('Hari Kemerdekaan Republik Indonesia', '2025-08-17', 'Hari Libur Nasional'),

-- September
('Tahun Baru Islam 1447 Hijriah', '2025-09-24', 'Hari Libur Nasional'),

-- Desember
('Maulid Nabi Muhammad SAW', '2025-12-13', 'Hari Libur Nasional'),
('Hari Raya Natal', '2025-12-25', 'Hari Libur Nasional');

-- Insert Cuti Bersama 2025
INSERT INTO holidays (name, date, description) VALUES
-- Cuti Bersama Idul Fitri
('Cuti Bersama Idul Fitri', '2025-04-23', 'Cuti Bersama'),
('Cuti Bersama Idul Fitri', '2025-04-24', 'Cuti Bersama'),
('Cuti Bersama Idul Fitri', '2025-04-25', 'Cuti Bersama'),

-- Cuti Bersama Natal dan Tahun Baru
('Cuti Bersama Natal', '2025-12-26', 'Cuti Bersama');
