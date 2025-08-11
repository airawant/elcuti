-- Add file_lampiran column to leave_requests table
ALTER TABLE public.leave_requests
ADD COLUMN file_lampiran text null;

-- Add comment to explain the column purpose
COMMENT ON COLUMN public.leave_requests.file_lampiran IS 'Public URL untuk file lampiran yang diupload user';
