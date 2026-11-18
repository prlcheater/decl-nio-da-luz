-- ============================================================
-- BETA 1.5 - Central de Dados (historico de rolagens)
-- ============================================================
-- Aplicar depois de 10. Pode rodar mais de uma vez.
-- Guarda as rolagens por ~2 dias (limpeza via purge_old_dice_rolls).

begin;

create table if not exists public.dice_rolls (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  username text not null,
  character_id uuid references public.characters(id) on delete set null,
  battle_session_id uuid references public.battle_sessions(id) on delete set null,
  kind text not null default 'teste' check (kind in ('teste','livre')),
  label text not null,
  difficulty text check (difficulty in ('favoravel','regular','dificil','severa')),
  rolls jsonb not null default '[]'::jsonb,
  kept int,
  modifier int not null default 0,
  total int not null,
  critico boolean not null default false,
  falha_critica boolean not null default false
);

create index if not exists dice_rolls_created_idx on public.dice_rolls (created_at desc);

alter table public.dice_rolls enable row level security;

drop policy if exists dice_rolls_select on public.dice_rolls;
create policy dice_rolls_select on public.dice_rolls
  for select to authenticated
  using (user_id = auth.uid() or public.is_mestre());

drop policy if exists dice_rolls_insert on public.dice_rolls;
create policy dice_rolls_insert on public.dice_rolls
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists dice_rolls_delete on public.dice_rolls;
create policy dice_rolls_delete on public.dice_rolls
  for delete to authenticated
  using (public.is_mestre() or user_id = auth.uid());

create or replace function public.purge_old_dice_rolls()
returns void language sql security definer set search_path = public as $$
  delete from public.dice_rolls where created_at < now() - interval '2 days';
$$;

revoke all on function public.purge_old_dice_rolls() from public, anon;
grant execute on function public.purge_old_dice_rolls() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['dice_rolls'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

commit;