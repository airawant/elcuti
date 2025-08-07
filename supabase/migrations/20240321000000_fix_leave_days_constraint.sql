-- Fix leave_days_check constraint to handle N-2 year leave balance
-- Drop the existing constraint
ALTER TABLE public.leave_requests DROP CONSTRAINT IF EXISTS leave_days_check;

-- Add the new constraint that includes used_n2_year
ALTER TABLE public.leave_requests ADD CONSTRAINT leave_days_check CHECK (
    (used_carry_over_days >= 0)
    AND (used_current_year_days >= 0)
    AND (used_n2_year >= 0)
    AND (
        (used_carry_over_days + used_current_year_days + used_n2_year) = workingdays
    )
);

-- Add comment for documentation
COMMENT ON CONSTRAINT leave_days_check ON public.leave_requests IS 'Validates that the sum of used days from different leave balance sources equals the total working days';
