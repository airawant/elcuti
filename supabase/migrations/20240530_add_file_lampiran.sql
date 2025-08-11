-- Add file_lampiran column to leave_requests table
ALTER TABLE public.leave_requests
ADD COLUMN file_lampiran text NULL;

-- Add comment to explain the purpose of the column
COMMENT ON COLUMN public.leave_requests.file_lampiran IS 'URL file lampiran yang diupload oleh pengguna';
