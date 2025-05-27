-- Ubah tipe kolom id
BEGIN;

-- Drop primary key constraint dengan CASCADE untuk menghapus semua dependencies
ALTER TABLE leave_requests
DROP CONSTRAINT IF EXISTS leave_requests_pkey CASCADE;

-- Ubah tipe kolom
ALTER TABLE leave_requests
ALTER COLUMN id TYPE VARCHAR(50) USING id::VARCHAR;

-- Set kembali primary key
ALTER TABLE leave_requests
ADD PRIMARY KEY (id);

COMMIT;

-- Tambahkan kembali foreign key constraints dengan tipe yang sesuai (jika diperlukan)
-- ALTER TABLE other_table ADD CONSTRAINT fk_name FOREIGN KEY (leave_request_id) REFERENCES leave_requests(id);
