-- Add tipe_pengguna column to pegawai table
ALTER TABLE public.pegawai
ADD COLUMN IF NOT EXISTS tipe_pengguna TEXT CHECK (tipe_pengguna IN ('PNS', 'PPPK'));

-- Set default value for existing records (optional)
UPDATE public.pegawai
SET tipe_pengguna = 'PNS'
WHERE tipe_pengguna IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.pegawai.tipe_pengguna IS 'Tipe pengguna: PNS atau PPPK';
