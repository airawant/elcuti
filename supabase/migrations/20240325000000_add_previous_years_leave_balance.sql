-- Add previous years leave balance tracking
CREATE OR REPLACE FUNCTION update_previous_years_leave_balance()
RETURNS TRIGGER AS $$
DECLARE
    current_year INTEGER;
    two_years_ago INTEGER;
    current_balance JSONB;
BEGIN
    -- Get current year and calculate two years ago
    current_year := EXTRACT(YEAR FROM CURRENT_DATE);
    two_years_ago := current_year - 2;
    
    -- Get current leave_balance
    current_balance := COALESCE(NEW.leave_balance, '{}'::jsonb);
    
    -- If leave_balance for two years ago doesn't exist, initialize it
    IF NOT (current_balance ? two_years_ago::text) THEN
        current_balance := jsonb_set(
            current_balance,
            ARRAY[two_years_ago::text],
            '12'::jsonb,  -- Default annual leave balance
            true
        );
    END IF;
    
    NEW.leave_balance := current_balance;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update leave balance for n-2 years
CREATE TRIGGER update_previous_years_leave_balance_trigger
    BEFORE INSERT OR UPDATE ON pegawai
    FOR EACH ROW
    EXECUTE FUNCTION update_previous_years_leave_balance();

-- Update existing records
UPDATE pegawai
SET leave_balance = leave_balance || jsonb_build_object(
    (EXTRACT(YEAR FROM CURRENT_DATE) - 2)::text,
    12
)
WHERE NOT (leave_balance ? (EXTRACT(YEAR FROM CURRENT_DATE) - 2)::text);