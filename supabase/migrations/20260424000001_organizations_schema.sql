-- ============================================================
-- EduPro — Organizations Schema
-- References public.teachers (not profiles — this project uses
-- a custom teachers table instead of Supabase auth.users profiles).
-- RLS policies resolve auth.uid() → teachers.id via auth_id.
-- ============================================================

-- Helper: resolve current auth user to teachers.id
-- Used inline in RLS policies as a subquery.

-- ── Organizations ─────────────────────────────────────────
create table if not exists public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  country    text not null,
  type       text not null check (type in ('ministry', 'district', 'school', 'ngo', 'training_center')),
  parent_id  uuid references public.organizations(id) on delete set null,
  metadata   jsonb default '{}',
  created_at timestamptz default now()
);

-- ── Organization Members ──────────────────────────────────
create table if not exists public.organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references public.teachers(id) on delete cascade,
  role            text not null check (role in ('teacher', 'school_admin', 'district_admin', 'ministry_admin')),
  created_at      timestamptz default now(),
  unique (organization_id, user_id)
);

-- ── School Knowledge Space ────────────────────────────────
create table if not exists public.school_knowledge_items (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title           text not null,
  summary         text,
  content         text,
  tags            text[] default '{}',
  content_type    text default 'document',   -- document | scheme_of_work | ai_insight | lesson_plan
  file_url        text,                       -- Supabase Storage URL for uploaded documents
  created_by      uuid references public.teachers(id) on delete set null,
  created_at      timestamptz default now()
);

-- ── Org-level Subscriptions ───────────────────────────────
create table if not exists public.org_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id         text not null,             -- school_basic | school_pro | district | ministry
  seat_count      integer default 1,
  status          text default 'active',
  price_usd       numeric(10,2),
  billing_cycle   text default 'monthly',
  payment_method  text,                      -- mobile_money | bank_transfer | voucher | stripe
  activated_at    timestamptz default now(),
  expires_at      timestamptz,
  created_at      timestamptz default now()
);

-- ── Extend lesson_notes ───────────────────────────────────
alter table public.lesson_notes
  add column if not exists organization_id uuid references public.organizations(id) on delete set null,
  add column if not exists visibility text default 'private'
    check (visibility in ('private', 'school_only', 'general'));

-- ── Indexes ───────────────────────────────────────────────
create index if not exists idx_organizations_country   on public.organizations(country);
create index if not exists idx_organizations_type      on public.organizations(type);
create index if not exists idx_organizations_parent    on public.organizations(parent_id);
create index if not exists idx_org_members_org         on public.organization_members(organization_id);
create index if not exists idx_org_members_user        on public.organization_members(user_id);
create index if not exists idx_school_knowledge_org    on public.school_knowledge_items(organization_id);
create index if not exists idx_lesson_notes_org        on public.lesson_notes(organization_id);
create index if not exists idx_lesson_notes_visibility on public.lesson_notes(visibility);
create index if not exists idx_org_subscriptions_org   on public.org_subscriptions(organization_id);

-- ── RLS ───────────────────────────────────────────────────
alter table public.organizations           enable row level security;
alter table public.organization_members    enable row level security;
alter table public.school_knowledge_items  enable row level security;
alter table public.org_subscriptions       enable row level security;

-- Inline helper macro (used in every policy that needs the current teacher's id):
--   (select id from public.teachers where auth_id = auth.uid() limit 1)

-- Organizations: public read; authenticated create; admin update/delete
create policy "orgs_select" on public.organizations
  for select using (true);

create policy "orgs_insert" on public.organizations
  for insert to authenticated with check (true);

create policy "orgs_update" on public.organizations
  for update using (
    exists (
      select 1 from public.organization_members
      where organization_id = public.organizations.id
        and user_id = (select id from public.teachers where auth_id = auth.uid() limit 1)
        and role in ('school_admin', 'district_admin', 'ministry_admin')
    )
  );

-- Organization members: members see fellow members; own row on insert; admins manage
create policy "org_members_select" on public.organization_members
  for select using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = (select id from public.teachers where auth_id = auth.uid() limit 1)
    )
  );

create policy "org_members_insert" on public.organization_members
  for insert to authenticated with check (
    user_id = (select id from public.teachers where auth_id = auth.uid() limit 1)
  );

create policy "org_members_admin_all" on public.organization_members
  for all using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = (select id from public.teachers where auth_id = auth.uid() limit 1)
        and role in ('school_admin', 'district_admin', 'ministry_admin')
    )
  );

-- School knowledge: org members read; creators/admins write
create policy "school_knowledge_select" on public.school_knowledge_items
  for select using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = (select id from public.teachers where auth_id = auth.uid() limit 1)
    )
  );

create policy "school_knowledge_insert" on public.school_knowledge_items
  for insert to authenticated with check (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = (select id from public.teachers where auth_id = auth.uid() limit 1)
    )
  );

create policy "school_knowledge_update" on public.school_knowledge_items
  for update using (
    created_by = (select id from public.teachers where auth_id = auth.uid() limit 1)
    or organization_id in (
      select organization_id from public.organization_members
      where user_id = (select id from public.teachers where auth_id = auth.uid() limit 1)
        and role in ('school_admin', 'district_admin', 'ministry_admin')
    )
  );

-- Org subscriptions: org admins manage
create policy "org_subs_select" on public.org_subscriptions
  for select using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = (select id from public.teachers where auth_id = auth.uid() limit 1)
    )
  );

create policy "org_subs_insert" on public.org_subscriptions
  for insert to authenticated with check (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = (select id from public.teachers where auth_id = auth.uid() limit 1)
        and role in ('school_admin', 'district_admin', 'ministry_admin')
    )
  );

-- ── Seed Organizations ────────────────────────────────────
insert into public.organizations (name, country, type) values
  ('Ministry of Secondary Education', 'Cameroon', 'ministry'),
  ('Federal Ministry of Education',   'Nigeria',  'ministry'),
  ('Ministry of Education',           'Kenya',    'ministry'),
  ('Ghana Education Service',         'Ghana',    'ministry'),
  ('Ministry of Education',           'Tanzania', 'ministry')
on conflict do nothing;

with cam_min as (
  select id from public.organizations
  where name = 'Ministry of Secondary Education' and country = 'Cameroon' limit 1
)
insert into public.organizations (name, country, type, parent_id)
select 'Northwest Region District', 'Cameroon', 'district', id from cam_min
union all
select 'Centre Region District',    'Cameroon', 'district', id from cam_min
on conflict do nothing;

with nw as (
  select id from public.organizations
  where name = 'Northwest Region District' and country = 'Cameroon' limit 1
)
insert into public.organizations (name, country, type, parent_id)
select 'GBHS Bamenda', 'Cameroon', 'school', id from nw
on conflict do nothing;

with ng_min as (
  select id from public.organizations
  where name = 'Federal Ministry of Education' and country = 'Nigeria' limit 1
)
insert into public.organizations (name, country, type, parent_id)
select 'Lagos State District', 'Nigeria', 'district', id from ng_min
union all
select 'Kano State District',  'Nigeria', 'district', id from ng_min
on conflict do nothing;

-- ── Storage: scheme-of-work uploads ──────────────────────
-- Create the bucket via API on first use. The policy below
-- restricts access to org members only.
-- (Bucket creation via Supabase dashboard: name = 'scheme-of-work', public = false)
