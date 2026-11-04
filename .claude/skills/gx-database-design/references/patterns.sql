-- GX database patterns (Postgres / Supabase). Adapt names to the project's schema skill.

-- Tenancy -------------------------------------------------------------------
create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table memberships (
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null,                       -- auth.users(id) on Supabase
  role text not null check (role in ('owner','admin','manager','staff','viewer')),
  primary key (tenant_id, user_id)
);

-- helper: tenants the current user belongs to (security definer, stable, fixed search_path)
create or replace function current_tenant_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select tenant_id from memberships where user_id = auth.uid()
$$;

create or replace function has_role(t uuid, roles text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships where tenant_id = t and user_id = auth.uid() and role = any(roles))
$$;

-- A tenant-owned table ------------------------------------------------------
create table jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  code text not null,
  title text not null check (length(title) between 1 and 200),
  stage_code text not null,
  contract_value_paise bigint not null default 0 check (contract_value_paise >= 0),
  currency char(3) not null default 'INR',
  due_date date,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  unique (tenant_id, code)
);
create index jobs_tenant_stage_due on jobs (tenant_id, stage_code, due_date) where deleted_at is null;

alter table jobs enable row level security;
alter table jobs force row level security;

create policy jobs_select on jobs for select using (tenant_id in (select current_tenant_ids()) and deleted_at is null);
create policy jobs_insert on jobs for insert with check (has_role(tenant_id, array['owner','admin','manager']));
create policy jobs_update on jobs for update using (has_role(tenant_id, array['owner','admin','manager','staff']))
  with check (tenant_id in (select current_tenant_ids()));
create policy jobs_delete on jobs for delete using (has_role(tenant_id, array['owner','admin']));

-- updated_at + version bump
create or replace function touch_row() returns trigger language plpgsql as $$
begin new.updated_at = now(); new.version = old.version + 1; return new; end $$;
create trigger jobs_touch before update on jobs for each row execute function touch_row();

-- Optimistic concurrency from the app:
--   update jobs set stage_code = $3 where id = $1 and version = $2 returning version;
--   zero rows → conflict: reload and tell the user.

-- Audit (append-only) -------------------------------------------------------
create table audit_log (
  id bigint generated always as identity primary key,
  tenant_id uuid not null,
  actor uuid,
  table_name text not null,
  row_id uuid not null,
  action text not null check (action in ('insert','update','delete')),
  before jsonb,
  after jsonb,
  at timestamptz not null default now()
);
revoke update, delete on audit_log from public;

create or replace function audit_row() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log (tenant_id, actor, table_name, row_id, action, before, after)
  values (coalesce(new.tenant_id, old.tenant_id), auth.uid(), tg_table_name, coalesce(new.id, old.id),
          lower(tg_op), case when tg_op <> 'INSERT' then to_jsonb(old) end, case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;
create trigger jobs_audit after insert or update or delete on jobs for each row execute function audit_row();

-- Idempotency ---------------------------------------------------------------
create table idempotency_keys (
  tenant_id uuid not null,
  key text not null,
  response jsonb,
  created_at timestamptz not null default now(),
  primary key (tenant_id, key)
);

-- Configurable workflow (industry pack as data) -----------------------------
create table stage_definitions (
  pack text not null,                 -- 'solar', 'ev', 'core'
  code text not null,
  label text not null,
  position int not null,
  sla_days int check (sla_days is null or sla_days > 0),
  required_documents text[] not null default '{}',
  primary key (pack, code)
);

-- Outbox --------------------------------------------------------------------
create table outbox (
  id bigint generated always as identity primary key,
  tenant_id uuid not null,
  topic text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  attempts int not null default 0,
  last_error text
);
create index outbox_unsent on outbox (created_at) where sent_at is null;

-- Cross-tenant negative test (pgTAP sketch) ---------------------------------
-- set local role authenticated; set local request.jwt.claims = '{"sub":"<user-of-tenant-B>"}';
-- select is_empty($$ select * from jobs where tenant_id = '<tenant-A>' $$, 'tenant B cannot read tenant A');
