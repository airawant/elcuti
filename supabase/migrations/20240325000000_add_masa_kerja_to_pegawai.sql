-- Add masa_kerja column to pegawai
ALTER TABLE public.pegawai
ADD COLUMN IF NOT EXISTS masa_kerja date NULL;

-- Optional: comment for documentation
COMMENT ON COLUMN public.pegawai.masa_kerja IS 'Tanggal mulai masa kerja pegawai';
