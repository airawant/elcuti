-- Create pegawai table (custom users table)
CREATE TABLE IF NOT EXISTS public.pegawai (
    id BIGSERIAL PRIMARY KEY,
    nip TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
    position TEXT,
    workUnit TEXT,
    email TEXT UNIQUE,
    phone TEXT,
    address TEXT,
    isApprover BOOLEAN DEFAULT FALSE,
    isAuthorizedOfficer BOOLEAN DEFAULT FALSE,
    leave_balance JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create leave_requests table
CREATE TABLE IF NOT EXISTS public.leave_requests (
    create table public.leave_requests (
  id character varying(50) (50) not null,
  user_id bigint not null,
  type text not null,
  status text not null,
  start_date date not null,
  end_date date not null,
  reason text null,
  created_at timestamp with time zone null default now(),
  rejection_reason text null,
  supervisor_id bigint null,
  supervisor_status text not null,
  supervisor_viewed boolean null default false,
  supervisor_signed boolean null default false,
  supervisor_signature_date timestamp with time zone null,
  authorized_officer_id bigint null,
  authorized_officer_status text not null,
  authorized_officer_viewed boolean null default false,
  authorized_officer_signed boolean null default false,
  authorized_officer_signature_date timestamp with time zone null,
  workingdays integer null,
  address text null,
  phone text null,
  used_carry_over_days integer null default 0,
  used_current_year_days integer null default 0,
  leave_year integer not null default EXTRACT(
    year
    from
      CURRENT_DATE
  ),
  saldo_carry integer null default 0,
  saldo_current_year integer null default 0,
  link_file text null,
  saldo_n2_year integer null default 0,
  used_n2_year integer null default 0,
  constraint leave_requests_pkey primary key (id),
  constraint leave_requests_supervisor_id_fkey foreign KEY (supervisor_id) references pegawai (id) on delete set null,
  constraint leave_requests_user_id_fkey foreign KEY (user_id) references pegawai (id) on delete CASCADE,
  constraint leave_requests_authorized_officer_id_fkey foreign KEY (authorized_officer_id) references pegawai (id) on delete set null,
  constraint leave_days_check check (
    (
      (used_carry_over_days >= 0)
      and (used_current_year_days >= 0)
      and (used_n2_year >= 0)
      and (
        (used_carry_over_days + used_current_year_days + used_n2_year) = workingdays
      )
    )
  ),
  constraint valid_date_range check ((end_date >= start_date)),
  constraint leave_requests_authorized_officer_status_check check (
    (
      authorized_officer_status = any (
        array[
          'Pending'::text,
          'Approved'::text,
          'Rejected'::text
        ]
      )
    )
  ),
  constraint leave_requests_status_check check (
    (
      status = any (
        array[
          'Pending'::text,
          'Approved'::text,
          'Rejected'::text
        ]
      )
    )
  ),
  constraint leave_requests_supervisor_status_check check (
    (
      supervisor_status = any (
        array[
          'Pending'::text,
          'Approved'::text,
          'Rejected'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

);

-- Create holidays table
CREATE TABLE IF NOT EXISTS public.holidays (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    date DATE NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW()
);

-- Create RLS policies
-- Enable Row Level Security
ALTER TABLE public.pegawai ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- Pegawai policies
CREATE POLICY "Admins can read all users" ON public.pegawai FOR
SELECT USING (
        auth.role () = 'authenticated'
        AND EXISTS (
            SELECT 1
            FROM auth.users
            WHERE
                auth.users.id = auth.uid ()
                AND auth.users.role = 'admin'
        )
    );

CREATE POLICY "Users can read their own data" ON public.pegawai FOR
SELECT USING (
        auth.role () = 'authenticated'
        AND id = (
            SELECT pegawai_id
            FROM auth.users
            WHERE
                auth.users.id = auth.uid ()
        )
    );

CREATE POLICY "Admins can insert users" ON public.pegawai FOR
INSERT
WITH
    CHECK (
        auth.role () = 'authenticated'
        AND EXISTS (
            SELECT 1
            FROM auth.users
            WHERE
                auth.users.id = auth.uid ()
                AND auth.users.role = 'admin'
        )
    );

CREATE POLICY "Admins can update users" ON public.pegawai FOR
UPDATE USING (
    auth.role () = 'authenticated'
    AND EXISTS (
        SELECT 1
        FROM auth.users
        WHERE
            auth.users.id = auth.uid ()
            AND auth.users.role = 'admin'
    )
);

CREATE POLICY "Users can update their own data" ON public.pegawai FOR
UPDATE USING (
    auth.role () = 'authenticated'
    AND id = (
        SELECT pegawai_id
        FROM auth.users
        WHERE
            auth.users.id = auth.uid ()
    )
);

CREATE POLICY "Admins can delete users" ON public.pegawai FOR DELETE USING (
    auth.role () = 'authenticated'
    AND EXISTS (
        SELECT 1
        FROM auth.users
        WHERE
            auth.users.id = auth.uid ()
            AND auth.users.role = 'admin'
    )
);

-- Leave requests policies
CREATE POLICY "Admins can read all leave requests" ON public.leave_requests FOR
SELECT USING (
        auth.role () = 'authenticated'
        AND EXISTS (
            SELECT 1
            FROM auth.users
            WHERE
                auth.users.id = auth.uid ()
                AND auth.users.role = 'admin'
        )
    );

CREATE POLICY "Users can read their own leave requests" ON public.leave_requests FOR
SELECT USING (
        auth.role () = 'authenticated'
        AND user_id = (
            SELECT pegawai_id
            FROM auth.users
            WHERE
                auth.users.id = auth.uid ()
        )
    );

CREATE POLICY "Supervisors can read leave requests they need to approve" ON public.leave_requests FOR
SELECT USING (
        auth.role () = 'authenticated'
        AND supervisor_id = (
            SELECT pegawai_id
            FROM auth.users
            WHERE
                auth.users.id = auth.uid ()
        )
    );

CREATE POLICY "Authorized officers can read leave requests they need to approve" ON public.leave_requests FOR
SELECT USING (
        auth.role () = 'authenticated'
        AND authorized_officer_id = (
            SELECT pegawai_id
            FROM auth.users
            WHERE
                auth.users.id = auth.uid ()
        )
    );

CREATE POLICY "Users can insert their own leave requests" ON public.leave_requests FOR
INSERT
WITH
    CHECK (
        auth.role () = 'authenticated'
        AND user_id = (
            SELECT pegawai_id
            FROM auth.users
            WHERE
                auth.users.id = auth.uid ()
        )
    );

CREATE POLICY "Admins can insert leave requests" ON public.leave_requests FOR
INSERT
WITH
    CHECK (
        auth.role () = 'authenticated'
        AND EXISTS (
            SELECT 1
            FROM auth.users
            WHERE
                auth.users.id = auth.uid ()
                AND auth.users.role = 'admin'
        )
    );

CREATE POLICY "Supervisors can update leave requests they need to approve" ON public.leave_requests FOR
UPDATE USING (
    auth.role () = 'authenticated'
    AND supervisor_id = (
        SELECT pegawai_id
        FROM auth.users
        WHERE
            auth.users.id = auth.uid ()
    )
);

CREATE POLICY "Authorized officers can update leave requests they need to approve" ON public.leave_requests FOR
UPDATE USING (
    auth.role () = 'authenticated'
    AND authorized_officer_id = (
        SELECT pegawai_id
        FROM auth.users
        WHERE
            auth.users.id = auth.uid ()
    )
);

CREATE POLICY "Admins can update leave requests" ON public.leave_requests FOR
UPDATE USING (
    auth.role () = 'authenticated'
    AND EXISTS (
        SELECT 1
        FROM auth.users
        WHERE
            auth.users.id = auth.uid ()
            AND auth.users.role = 'admin'
    )
);

-- Holidays policies
CREATE POLICY "Anyone can read holidays" ON public.holidays FOR
SELECT USING (true);

CREATE POLICY "Admins can insert holidays" ON public.holidays FOR
INSERT
WITH
    CHECK (
        auth.role () = 'authenticated'
        AND EXISTS (
            SELECT 1
            FROM auth.users
            WHERE
                auth.users.id = auth.uid ()
                AND auth.users.role = 'admin'
        )
    );

CREATE POLICY "Admins can update holidays" ON public.holidays FOR
UPDATE USING (
    auth.role () = 'authenticated'
    AND EXISTS (
        SELECT 1
        FROM auth.users
        WHERE
            auth.users.id = auth.uid ()
            AND auth.users.role = 'admin'
    )
);

CREATE POLICY "Admins can delete holidays" ON public.holidays FOR DELETE USING (
    auth.role () = 'authenticated'
    AND EXISTS (
        SELECT 1
        FROM auth.users
        WHERE
            auth.users.id = auth.uid ()
            AND auth.users.role = 'admin'
    )
);

-- Insert initial admin user (password: #admin25)
INSERT INTO
    public.pegawai (
        nip,
        name,
        password,
        role,
        position,
        workUnit,
        email,
        isApprover,
        isAuthorizedOfficer
    )
VALUES (
        '198501012010011001',
        'admin',
        '$2a$10$X7tUYySu1qLYSEtI.Jn5eeJsLwMjuM1CvIXbor4zcLlJvLn.Hs3Hy',
        'admin',
        'Administrator Sistem',
        'Bagian IT Kankemenag Kota Tanjungpinang',
        'admin@example.com',
        false,
        false
    ) ON CONFLICT (nip) DO NOTHING;

-- Insert initial user (password: 1234567)
INSERT INTO
    public.pegawai (
        nip,
        name,
        password,
        role,
        position,
        workUnit,
        email,
        isApprover,
        isAuthorizedOfficer,
        leave_balance
    )
VALUES (
        '198501012010011002',
        'ini orang',
        '$2a$10$Xt5UQFwAUJxRG.iYs/U0/.7VF5RlQRsOLqmHnZ.Y0DZxW.yDGP5Uy',
        'user',
        'Staff Administrasi',
        'Subbag. Tata Usaha Kankemenag Kota Tanjungpinang',
        'nip@example.com',
        false,
        false,
        '{"2023": 5, "2024": 12}'
    ) ON CONFLICT (nip) DO NOTHING;
