-- ESCALA DE VOLUNTÁRIOS
-- Execute este arquivo no SQL Editor do seu projeto Supabase.
-- Depois, configure o PIN inicial na seção "CONFIGURAÇÃO INICIAL".

create extension if not exists pgcrypto;

create table if not exists public.volunteers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  year integer not null,
  month integer not null check (month between 1 and 12),
  status text not null default 'open' check (status in ('open','closed')),
  min_slots integer not null default 2 check (min_slots >= 1),
  created_at timestamptz not null default now()
);

create table if not exists public.slots (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  service_date date not null,
  period text not null check (period in ('morning','evening')),
  created_at timestamptz not null default now(),
  unique(schedule_id, service_date, period)
);

create table if not exists public.signups (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.slots(id) on delete cascade,
  volunteer_id uuid not null references public.volunteers(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(slot_id, volunteer_id)
);

create table if not exists public.admin_config (
  id integer primary key default 1,
  pin_hash text not null,
  team_name text not null default 'Equipe',
  updated_at timestamptz not null default now()
);

alter table public.volunteers enable row level security;
alter table public.schedules enable row level security;
alter table public.slots enable row level security;
alter table public.signups enable row level security;
alter table public.admin_config enable row level security;

drop policy if exists "public read volunteers" on public.volunteers;
create policy "public read volunteers" on public.volunteers for select using (true);

drop policy if exists "public admin insert volunteers" on public.volunteers;
create policy "public admin insert volunteers" on public.volunteers for insert with check (true);

drop policy if exists "public admin update volunteers" on public.volunteers;
create policy "public admin update volunteers" on public.volunteers for update using (true) with check (true);

drop policy if exists "public read schedules" on public.schedules;
create policy "public read schedules" on public.schedules for select using (true);

drop policy if exists "public insert schedules" on public.schedules;
create policy "public insert schedules" on public.schedules for insert with check (true);

drop policy if exists "public update schedules" on public.schedules;
create policy "public update schedules" on public.schedules for update using (true) with check (true);

drop policy if exists "public read slots" on public.slots;
create policy "public read slots" on public.slots for select using (true);

drop policy if exists "public insert slots" on public.slots;
create policy "public insert slots" on public.slots for insert with check (true);

drop policy if exists "public read signups" on public.signups;
create policy "public read signups" on public.signups for select using (true);

drop policy if exists "public insert signups while open" on public.signups;
create policy "public insert signups while open" on public.signups
for insert with check (
  exists (
    select 1 from public.slots s
    join public.schedules sc on sc.id = s.schedule_id
    where s.id = slot_id and sc.status = 'open'
  )
);

drop policy if exists "public delete signups while open" on public.signups;
create policy "public delete signups while open" on public.signups
for delete using (
  exists (
    select 1 from public.slots s
    join public.schedules sc on sc.id = s.schedule_id
    where s.id = slot_id and sc.status = 'open'
  )
);

-- Não existe SELECT público em admin_config: o hash do PIN nunca deve ser enviado ao navegador.
drop policy if exists "read admin config" on public.admin_config;

-- Função usada pelo painel para verificar o PIN sem expor o hash.
create or replace function public.verify_admin_pin(p_pin text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_config
    where id = 1
      and pin_hash = crypt(p_pin, pin_hash)
  );
$$;

revoke all on function public.verify_admin_pin(text) from public;
grant execute on function public.verify_admin_pin(text) to anon, authenticated;

-- Detecta se o primeiro acesso ainda precisa configurar o PIN.
create or replace function public.is_admin_configured()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_config where id = 1);
$$;

revoke all on function public.is_admin_configured() from public;
grant execute on function public.is_admin_configured() to anon, authenticated;

-- No primeiro acesso, permite criar o PIN apenas se ainda não houver configuração.
create or replace function public.setup_admin_pin(p_pin text, p_team_name text default 'Minha Equipe')
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if length(p_pin) < 4 or p_pin !~ '^[0-9]+$' then
    raise exception 'PIN inválido. Use pelo menos 4 números.';
  end if;

  if exists (select 1 from public.admin_config where id = 1) then
    raise exception 'O PIN já foi configurado.';
  end if;

  insert into public.admin_config (id, pin_hash, team_name)
  values (1, crypt(p_pin, gen_salt('bf')), coalesce(nullif(trim(p_team_name), ''), 'Minha Equipe'));

  return true;
end;
$$;

revoke all on function public.setup_admin_pin(text, text) from public;
grant execute on function public.setup_admin_pin(text, text) to anon, authenticated;

-- Realtime para atualizações instantâneas.
alter table public.signups replica identity full;
alter table public.slots replica identity full;
alter table public.schedules replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'signups'
  ) then
    alter publication supabase_realtime add table public.signups;
  end if;
exception when undefined_object then
  null;
end $$;

-- CONFIGURAÇÃO INICIAL
-- 1) Gere o hash de um PIN no SQL Editor:
--    select crypt('1234', gen_salt('bf'));
-- 2) Copie o resultado e execute:
--    insert into public.admin_config (id, pin_hash, team_name)
--    values (1, 'COLE_O_HASH_AQUI', 'Minha Equipe')
--    on conflict (id) do update
--      set pin_hash = excluded.pin_hash,
--          team_name = excluded.team_name,
--          updated_at = now();

-- Exemplo de equipe inicial (opcional):
-- insert into public.volunteers (name, sort_order) values
-- ('Voluntário 1', 1),
-- ('Voluntário 2', 2);
