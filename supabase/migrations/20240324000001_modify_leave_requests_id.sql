create table public.leave_requests (
  id character varying(50) not null,
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
  workingdays integer not null,
  address text null,
  phone text null,
  used_n2_year integer null default 0,
  used_carry_over_days integer null default 0,
  used_current_year_days integer null default 0,
  leave_year integer not null default EXTRACT(
    year
    from
      CURRENT_DATE
  ),
  saldo_n2_year integer null default 0,
  saldo_carry integer null default 0,
  saldo_current_year integer null default 0,
  link_file text null,
  constraint leave_requests_pkey1 primary key (id),
  constraint leave_requests_user_id_fkey1 foreign KEY (user_id) references pegawai (id) on delete CASCADE,
  constraint leave_requests_authorized_officer_id_fkey1 foreign KEY (authorized_officer_id) references pegawai (id) on delete set null,
  constraint leave_requests_supervisor_id_fkey1 foreign KEY (supervisor_id) references pegawai (id) on delete set null,
  constraint leave_requests_used_carry_over_days_check check ((used_carry_over_days >= 0)),
  constraint leave_requests_used_current_year_days_check check ((used_current_year_days >= 0)),
  constraint leave_requests_used_n2_year_check check ((used_n2_year >= 0)),
  constraint leave_requests_workingdays_check check ((workingdays > 0)),
  constraint leave_days_check check (
    (
      type != 'Cuti Tahunan'
    ) or (
      (used_carry_over_days >= 0)
      and (used_current_year_days >= 0)
      and (used_n2_year >= 0)
      and (
        (
          (used_carry_over_days + used_current_year_days) + used_n2_year
        ) = workingdays
      )
    )
  ),
  constraint valid_date_range check ((end_date >= start_date)),
  constraint leave_requests_authorized_officer_status_check1 check (
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
  constraint leave_requests_status_check1 check (
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
  constraint leave_requests_supervisor_status_check1 check (
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
