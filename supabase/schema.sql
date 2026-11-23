-- Crisp Coat booking database (run once in Supabase > SQL editor)

-- Staff who may log in to the dashboard. Add a row per staff email after creating
-- their login in Supabase > Authentication > Users.
create table if not exists staff (
  email text primary key,
  name  text,
  role  text not null default 'staff' check (role in ('owner','staff'))
);

create table if not exists bookings (
  ref        text primary key,
  created_at timestamptz not null default now(),
  status     text not null default 'new' check (status in ('new','confirmed','done','cancelled','no_show')),
  day        date not null,
  hour       int  not null check (hour between 0 and 23),
  service    text not null,
  size       text,
  quoted     numeric,          -- price shown on the site (null = needs a quote)
  amount     numeric,          -- what was actually charged; staff fill this in
  name       text not null,
  phone      text not null,
  email      text,
  address    text not null,
  town       text,
  vehicle    text,
  notes      text,
  source     text default 'website',
  terms_version     text,          -- which Terms of Service the customer agreed to
  terms_accepted_at timestamptz    -- when they ticked the box
);
-- one live booking per start time
create unique index if not exists bookings_one_per_slot on bookings(day, hour) where status <> 'cancelled';

-- Weekly hours: which start times are offered on each weekday (0 = Sunday)
create table if not exists weekly_hours (
  weekday int primary key check (weekday between 0 and 6),
  hours   int[] not null default '{6,8,10,12,14}'
);
insert into weekly_hours(weekday) select g from generate_series(0,6) g on conflict do nothing;

-- One-off blocks: a whole day (hour null) or one start time
create table if not exists blocks (
  id     bigserial primary key,
  day    date not null,
  hour   int,
  reason text
);

-- Security: the public site never touches these tables directly. It goes through
-- the Netlify functions, which use the service key. Staff read/write as themselves.
alter table staff        enable row level security;
alter table bookings     enable row level security;
alter table weekly_hours enable row level security;
alter table blocks       enable row level security;

create or replace function is_staff() returns boolean language sql stable security definer as $$
  select exists (select 1 from staff where email = auth.jwt() ->> 'email');
$$;

create policy staff_read_self on staff        for select using (is_staff());
create policy staff_all       on bookings     for all    using (is_staff()) with check (is_staff());
create policy staff_hours     on weekly_hours for all    using (is_staff()) with check (is_staff());
create policy staff_blocks    on blocks       for all    using (is_staff()) with check (is_staff());

-- Table access for the API roles (row-level security above still decides what each can see).
grant usage on schema public to authenticated, service_role;
grant all on all tables    in schema public to authenticated, service_role;
grant all on all sequences in schema public to authenticated, service_role;
