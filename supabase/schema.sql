-- MedOra care circle schema for Supabase.
-- Paste this whole file into Supabase → SQL Editor → New query, then click Run.
-- A "care circle" belongs to one patient (the owner). Caregivers join with an invite code
-- and only see what the patient allows.


create table if not exists public.circles (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  patient_name text not null default '',
  profile jsonb not null default '{}'::jsonb,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.circle_members (
  circle_id uuid not null references public.circles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default '',
  relation text not null default '',
  can_view_meds boolean not null default true,
  can_mark boolean not null default false,
  can_alerts boolean not null default false,
  can_docs boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);

create table if not exists public.medications (
  id uuid primary key,
  circle_id uuid not null references public.circles(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.dose_events (
  id uuid primary key,
  circle_id uuid not null references public.circles(id) on delete cascade,
  med_id uuid not null,
  date text not null,
  time text not null,
  status text not null check (status in ('taken', 'skipped')),
  reason text,
  by_name text not null default '',
  by_user uuid default auth.uid(),
  at timestamptz not null default now()
);
create index if not exists dose_events_circle_date on public.dose_events (circle_id, date);

create table if not exists public.activity (
  id uuid primary key,
  circle_id uuid not null references public.circles(id) on delete cascade,
  who text not null,
  text text not null,
  by_user uuid default auth.uid(),
  at timestamptz not null default now()
);
create index if not exists activity_circle_at on public.activity (circle_id, at desc);

-- Helper checks (security definer so policies can look across tables without recursion)
create or replace function public.is_owner(cid uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.circles where id = cid and owner = auth.uid());
$$;

create or replace function public.is_member(cid uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select public.is_owner(cid)
      or exists (select 1 from public.circle_members where circle_id = cid and user_id = auth.uid());
$$;

create or replace function public.member_can(cid uuid, perm text) returns boolean
language sql security definer set search_path = public stable as $$
  select public.is_owner(cid) or exists (
    select 1 from public.circle_members m
    where m.circle_id = cid and m.user_id = auth.uid()
      and case perm
            when 'meds' then m.can_view_meds
            when 'mark' then m.can_view_meds and m.can_mark
            when 'docs' then m.can_docs
            else false
          end
  );
$$;

alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.medications enable row level security;
alter table public.dose_events enable row level security;
alter table public.activity enable row level security;

-- circles: members can read, only the owner can change
drop policy if exists circles_select on public.circles;
create policy circles_select on public.circles for select using (owner = auth.uid() or public.is_member(id));
drop policy if exists circles_insert on public.circles;
create policy circles_insert on public.circles for insert with check (owner = auth.uid());
drop policy if exists circles_update on public.circles;
create policy circles_update on public.circles for update using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists circles_delete on public.circles;
create policy circles_delete on public.circles for delete using (owner = auth.uid());

-- members: everyone in the circle can see who is in it; the owner sets permissions;
-- members can leave. Joining happens only through join_circle() below.
drop policy if exists members_select on public.circle_members;
create policy members_select on public.circle_members for select using (public.is_member(circle_id));
drop policy if exists members_update on public.circle_members;
create policy members_update on public.circle_members for update using (public.is_owner(circle_id)) with check (public.is_owner(circle_id));
drop policy if exists members_delete on public.circle_members;
create policy members_delete on public.circle_members for delete using (public.is_owner(circle_id) or user_id = auth.uid());

-- medications: readable by people allowed to view medicines, writable by the owner
drop policy if exists meds_select on public.medications;
create policy meds_select on public.medications for select using (public.member_can(circle_id, 'meds'));
drop policy if exists meds_insert on public.medications;
create policy meds_insert on public.medications for insert with check (public.is_owner(circle_id));
drop policy if exists meds_update on public.medications;
create policy meds_update on public.medications for update using (public.is_owner(circle_id)) with check (public.is_owner(circle_id));
drop policy if exists meds_delete on public.medications;
create policy meds_delete on public.medications for delete using (public.is_owner(circle_id));

-- dose events: readable with medicine access; caregivers need "mark doses" to add one
drop policy if exists doses_select on public.dose_events;
create policy doses_select on public.dose_events for select using (public.member_can(circle_id, 'meds'));
drop policy if exists doses_insert on public.dose_events;
create policy doses_insert on public.dose_events for insert with check (public.member_can(circle_id, 'mark'));
drop policy if exists doses_update on public.dose_events;
create policy doses_update on public.dose_events for update
  using (public.is_owner(circle_id) or by_user = auth.uid())
  with check (public.member_can(circle_id, 'mark'));
drop policy if exists doses_delete on public.dose_events;
create policy doses_delete on public.dose_events for delete using (public.is_owner(circle_id) or by_user = auth.uid());

-- activity: the shared timeline everyone in the circle can read and add to
drop policy if exists activity_select on public.activity;
create policy activity_select on public.activity for select using (public.is_member(circle_id));
drop policy if exists activity_insert on public.activity;
create policy activity_insert on public.activity for insert with check (public.is_member(circle_id));
drop policy if exists activity_delete on public.activity;
create policy activity_delete on public.activity for delete using (public.is_owner(circle_id));

-- Join a circle with its invite code. Returns {circle_id, patient_name}.
create or replace function public.join_circle(code text, name text, rel text) returns json
language plpgsql security definer set search_path = public as $$
declare
  c public.circles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Please sign in first.';
  end if;
  select * into c from public.circles where invite_code = upper(trim(code));
  if not found then
    raise exception 'No care circle matches that code.';
  end if;
  if c.owner = auth.uid() then
    raise exception 'This is your own care circle.';
  end if;
  insert into public.circle_members (circle_id, user_id, display_name, relation)
  values (c.id, auth.uid(), coalesce(nullif(trim(name), ''), 'Caregiver'), coalesce(rel, ''))
  on conflict on constraint circle_members_pkey
  do update set display_name = excluded.display_name, relation = excluded.relation;
  insert into public.activity (id, circle_id, who, text, by_user)
  values (gen_random_uuid(), c.id, coalesce(nullif(trim(name), ''), 'Caregiver'), 'joined the care circle', auth.uid());
  return json_build_object('circle_id', c.id, 'patient_name', c.patient_name);
end;
$$;

revoke all on function public.join_circle(text, text, text) from public;
grant execute on function public.join_circle(text, text, text) to authenticated;

-- Live updates for the caregiver view
do $$
begin
  begin alter publication supabase_realtime add table public.dose_events; exception when others then null; end;
  begin alter publication supabase_realtime add table public.medications; exception when others then null; end;
  begin alter publication supabase_realtime add table public.activity; exception when others then null; end;
  begin alter publication supabase_realtime add table public.circle_members; exception when others then null; end;
end $$;
