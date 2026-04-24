-- Organizations: ministries, districts, schools, NGOs, training centers
create table if not exists public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  country    text not null,
  type       text not null check (type in ('ministry', 'district', 'school', 'ngo', 'training_center')),
  parent_id  uuid references public.organizations(id) on delete set null,
  metadata   jsonb default '{}',
  created_at timestamptz default now()
);

-- Members of organizations (teachers, admins)
create table if not exists public.organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  role            text not null check (role in ('teacher', 'school_admin', 'district_admin', 'ministry_admin')),
  created_at      timestamptz default now(),
  unique (organization_id, user_id)
);

-- Per-school knowledge space: lessons, schemes of work, internal curriculum adaptations
create table if not exists public.school_knowledge_items (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title           text not null,
  summary         text,
  content         text,
  tags            text[] default '{}',
  content_type    text default 'document',
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz default now()
);

-- Add organization_id to lesson_notes for school-level sharing and analytics
alter table public.lesson_notes
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;

-- Extend subscriptions for school/district/ministry licenses
alter table public.subscriptions
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists seat_count integer default 1,
  add column if not exists plan_type text default 'individual';

-- Indexes
create index if not exists idx_organizations_country   on public.organizations(country);
create index if not exists idx_organizations_type      on public.organizations(type);
create index if not exists idx_organizations_parent    on public.organizations(parent_id);
create index if not exists idx_org_members_org         on public.organization_members(organization_id);
create index if not exists idx_org_members_user        on public.organization_members(user_id);
create index if not exists idx_school_knowledge_org    on public.school_knowledge_items(organization_id);
create index if not exists idx_lesson_notes_org        on public.lesson_notes(organization_id);

-- RLS
alter table public.organizations           enable row level security;
alter table public.organization_members    enable row level security;
alter table public.school_knowledge_items  enable row level security;

-- Organizations: public read, authenticated create, admin update
create policy "Anyone can read organizations" on public.organizations
  for select using (true);

create policy "Authenticated users can create organizations" on public.organizations
  for insert to authenticated with check (true);

create policy "Org admins can update their organization" on public.organizations
  for update using (
    exists (
      select 1 from public.organization_members
      where organization_id = public.organizations.id
        and user_id = auth.uid()
        and role in ('school_admin', 'district_admin', 'ministry_admin')
    )
  );

-- Members: members can view fellow members; admins can manage
create policy "Members can view org members" on public.organization_members
  for select using (
    organization_id in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );

create policy "Users can join organizations" on public.organization_members
  for insert to authenticated with check (user_id = auth.uid());

create policy "Admins can manage members" on public.organization_members
  for all using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid()
        and role in ('school_admin', 'district_admin', 'ministry_admin')
    )
  );

-- School knowledge: org members can read/create; creators and admins can update
create policy "Org members can read school knowledge" on public.school_knowledge_items
  for select using (
    organization_id in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );

create policy "Org members can create school knowledge" on public.school_knowledge_items
  for insert to authenticated with check (
    organization_id in (
      select organization_id from public.organization_members where user_id = auth.uid()
    ) and created_by = auth.uid()
  );

create policy "Creators and admins can update school knowledge" on public.school_knowledge_items
  for update using (
    created_by = auth.uid()
    or organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid()
        and role in ('school_admin', 'district_admin', 'ministry_admin')
    )
  );

-- Seed example organizations
insert into public.organizations (name, country, type) values
  ('Ministry of Secondary Education', 'Cameroon', 'ministry'),
  ('Federal Ministry of Education', 'Nigeria', 'ministry'),
  ('Ministry of Education', 'Kenya', 'ministry'),
  ('Ghana Education Service', 'Ghana', 'ministry'),
  ('Ministry of Education', 'Tanzania', 'ministry')
on conflict do nothing;

-- Seed districts under Cameroon ministry
with cam_min as (select id from public.organizations where name = 'Ministry of Secondary Education' and country = 'Cameroon' limit 1)
insert into public.organizations (name, country, type, parent_id)
select 'Northwest Region District', 'Cameroon', 'district', id from cam_min
union all
select 'Centre Region District', 'Cameroon', 'district', id from cam_min
on conflict do nothing;

-- Seed a school under Northwest Region
with nw as (select id from public.organizations where name = 'Northwest Region District' and country = 'Cameroon' limit 1)
insert into public.organizations (name, country, type, parent_id)
select 'GBHS Bamenda', 'Cameroon', 'school', id from nw
on conflict do nothing;

-- Seed districts/schools for Nigeria
with ng_min as (select id from public.organizations where name = 'Federal Ministry of Education' and country = 'Nigeria' limit 1)
insert into public.organizations (name, country, type, parent_id)
select 'Lagos State District', 'Nigeria', 'district', id from ng_min
union all
select 'Kano State District', 'Nigeria', 'district', id from ng_min
on conflict do nothing;
