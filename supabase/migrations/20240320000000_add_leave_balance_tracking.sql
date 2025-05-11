-- Add leave balance tracking columns
ALTER TABLE leave_requests
ADD COLUMN used_carry_over_days INTEGER DEFAULT 0,
ADD COLUMN used_current_year_days INTEGER DEFAULT 0,
ADD COLUMN leave_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
ADD CONSTRAINT leave_days_check CHECK (
    (used_carry_over_days >= 0) AND
    (used_current_year_days >= 0) AND
    (used_carry_over_days + used_current_year_days = workingdays)
);

-- Add comment for documentation
COMMENT ON COLUMN leave_requests.used_carry_over_days IS 'Jumlah hari cuti yang diambil dari saldo carry-over tahun sebelumnya';
COMMENT ON COLUMN leave_requests.used_current_year_days IS 'Jumlah hari cuti yang diambil dari saldo tahun berjalan';
COMMENT ON COLUMN leave_requests.leave_year IS 'Tahun saldo cuti yang digunakan';

-- Create function to automatically calculate and update leave balance tracking
CREATE OR REPLACE FUNCTION calculate_leave_balance_usage()
RETURNS TRIGGER AS $$
DECLARE
    carry_over_balance INTEGER;
    current_year_balance INTEGER;
    total_working_days INTEGER;
BEGIN
    -- Get the carry-over balance from previous year
    SELECT COALESCE(leave_balance->>(NEW.leave_year - 1)::text, '0')::integer
    INTO carry_over_balance
    FROM pegawai
    WHERE id = NEW.user_id;

    -- Get current year balance
    SELECT COALESCE(leave_balance->>NEW.leave_year::text, '0')::integer
    INTO current_year_balance
    FROM pegawai
    WHERE id = NEW.user_id;

    -- Calculate total working days
    total_working_days := NEW.workingdays;

    -- First use carry-over balance, then current year balance
    NEW.used_carry_over_days := LEAST(carry_over_balance, total_working_days);
    NEW.used_current_year_days := total_working_days - NEW.used_carry_over_days;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update leave balance tracking
CREATE TRIGGER update_leave_balance_usage
    BEFORE INSERT OR UPDATE ON leave_requests
    FOR EACH ROW
    WHEN (NEW.status = 'Approved')
    EXECUTE FUNCTION calculate_leave_balance_usage();

-- Update existing approved leave requests
UPDATE leave_requests
SET
    leave_year = EXTRACT(YEAR FROM start_date)::integer
WHERE status = 'Approved';

-- Recalculate leave balance usage for existing approved requests
WITH leave_usage AS (
    SELECT
        lr.id,
        lr.user_id,
        lr.workingdays,
        lr.leave_year,
        p.leave_balance->>(lr.leave_year - 1)::text AS carry_over_balance,
        p.leave_balance->>lr.leave_year::text AS current_year_balance
    FROM leave_requests lr
    JOIN pegawai p ON p.id = lr.user_id
    WHERE lr.status = 'Approved'
)
UPDATE leave_requests lr
SET
    used_carry_over_days = LEAST(
        (lu.carry_over_balance::integer),
        lr.workingdays
    ),
    used_current_year_days = lr.workingdays - LEAST(
        (lu.carry_over_balance::integer),
        lr.workingdays
    )
FROM leave_usage lu
WHERE lr.id = lu.id;
