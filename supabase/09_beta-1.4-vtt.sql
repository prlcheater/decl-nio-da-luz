-- ============================================================
-- BETA 1.4 - VTT (mapa, tokens e desenho)
-- ============================================================
-- Aplicar depois de 01..07 (e 08, se existir). Pode rodar mais de uma vez.
-- Aditivo: nao apaga combates, fichas nem efeitos.
--
-- 1. battle_maps    - imagem de fundo + grid, uma por combate.
-- 2. battle_tokens  - posicao de cada participante sobre o mapa (x/y em 0..1).
-- 3. battle_strokes - camada de desenho livre por mapa.
-- 4. RLS: leitura para autenticados; mestre escreve tudo; o dono do personagem
--    move o proprio token (integrado ao login).
-- 5. vtt_move_token - move o token validando mestre ou dono.
-- 6. Realtime: battle_maps, battle_tokens e battle_strokes.

begin;

create table if not exists public.battle_maps (
  id uuid primary key default gen_random_uuid(),
  battle_session_id uuid not null unique references public.battle_sessions(id) on delete cascade,
  name text,
  image_url text,
  grid_cols int not null default 20 check (grid_cols between 1 and 200),
  grid_rows int not null default 12 check (grid_rows between 1 and 200),
  created_at timestamptz default now()
);

create table if not exists public.battle_tokens (
  id uuid primary key default gen_random_uuid(),
  battle_session_id uuid not null references public.battle_sessions(id) on delete cascade,
  map_id uuid not null references public.battle_maps(id) on delete cascade,
  participant_id uuid not null unique references public.battle_participants(id) on delete cascade,
  label text not null,
  x double precision not null default 0.5 check (x >= 0 and x <= 1),
  y double precision not null default 0.5 check (y >= 0 and y <= 1),
  color text,
  size double precision not null default 0.06 check (size > 0 and size <= 0.5),
  z int not null default 0,
  created_at timestamptz default now()
);

create table if not exists public.battle_strokes (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references public.battle_maps(id) on delete cascade,
  points jsonb not null,
  color text not null default '#e5e7eb',
  width double precision not null default 0.004,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- ---------- RLS ----------
alter table public.battle_maps enable row level security;
alter table public.battle_tokens enable row level security;
alter table public.battle_strokes enable row level security;

drop policy if exists battle_maps_select on public.battle_maps;
create policy battle_maps_select on public.battle_maps for select using (auth.role() = 'authenticated');
drop policy if exists battle_maps_write on public.battle_maps;
create policy battle_maps_write on public.battle_maps for all using (is_mestre()) with check (is_mestre());

drop policy if exists battle_tokens_select on public.battle_tokens;
create policy battle_tokens_select on public.battle_tokens for select using (auth.role() = 'authenticated');
drop policy if exists battle_tokens_write on public.battle_tokens;
create policy battle_tokens_write on public.battle_tokens for all
  using (is_mestre() or exists (
    select 1 from public.battle_participants p
    join public.characters c on c.id = p.character_id
    where p.id = participant_id and c.user_id = auth.uid()))
  with check (is_mestre() or exists (
    select 1 from public.battle_participants p
    join public.characters c on c.id = p.character_id
    where p.id = participant_id and c.user_id = auth.uid()));

drop policy if exists battle_strokes_select on public.battle_strokes;
create policy battle_strokes_select on public.battle_strokes for select using (auth.role() = 'authenticated');
drop policy if exists battle_strokes_write on public.battle_strokes;
create policy battle_strokes_write on public.battle_strokes for all using (is_mestre()) with check (is_mestre());

-- ---------- RPC: mover token ----------
create or replace function public.vtt_move_token(p_token_id uuid, p_x double precision, p_y double precision)
returns void language plpgsql security definer set search_path = public as $$
declare v_participant uuid;
begin
  select participant_id into v_participant from battle_tokens where id = p_token_id;
  if v_participant is null then raise exception 'Token inexistente.'; end if;
  if not (is_mestre() or exists (
    select 1 from battle_participants p join characters c on c.id = p.character_id
    where p.id = v_participant and c.user_id = auth.uid()
  )) then raise exception 'Sem permissao para mover este token.'; end if;
  update battle_tokens
     set x = least(1, greatest(0, p_x)), y = least(1, greatest(0, p_y))
   where id = p_token_id;
end;
$$;

revoke all on function public.vtt_move_token(uuid, double precision, double precision) from public, anon;
grant execute on function public.vtt_move_token(uuid, double precision, double precision) to authenticated;

-- ---------- Realtime ----------
do $$
declare t text;
begin
  foreach t in array array['battle_maps','battle_tokens','battle_strokes'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

commit;