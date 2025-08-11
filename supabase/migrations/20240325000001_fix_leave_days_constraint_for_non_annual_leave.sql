-- Drop the existing constraint
ALTER TABLE public.leave_requests DROP CONSTRAINT IF EXISTS leave_days_check;

-- Add the new constraint that only applies to Cuti Tahunan
ALTER TABLE public.leave_requests ADD CONSTRAINT leave_days_check
CHECK (
  type != 'Cuti Tahunan'
  OR (
    used_carry_over_days >= 0
    AND used_current_year_days >= 0
    AND used_n2_year >= 0
    AND (used_carry_over_days + used_current_year_days + used_n2_year) = workingdays
  )
);
