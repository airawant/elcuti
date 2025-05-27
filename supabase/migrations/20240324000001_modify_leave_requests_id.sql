-- Ubah tipe kolom id menjadi VARCHAR
ALTER TABLE leave_requests
DROP CONSTRAINT leave_requests_pkey;

ALTER TABLE leave_requests
ALTER COLUMN id TYPE VARCHAR(50);

ALTER TABLE leave_requests
ADD PRIMARY KEY (id);
