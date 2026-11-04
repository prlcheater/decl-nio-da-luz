-- ============================================================
-- DECLÍNIO DA LUZ — SCHEMA SUPABASE
-- ============================================================
-- Só roda em banco vazio. Depois dele, execute
-- patch-2026-11-04-seguranca-e-combate.sql e seed.sql. As policies abaixo não
-- são as finais: o patch substitui parte delas. Passo a passo no README.md.

-- ---------- PERFIS ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  avatar_url text,
  role text not null default 'player' check (role in ('player','mestre')),
  created_at timestamptz default now()
);

-- ---------- TABELAS DE REFERÊNCIA (cadastradas pelo mestre) ----------
create table elements (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  icon_url text,
  color_hex text,
  description text
);

create table classes (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  description text
);

-- ---------- PERSONAGENS / FICHA ----------
create table characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  title text,
  class_id uuid references classes(id),
  element_id uuid references elements(id),
  level int not null default 1,
  portrait_url text, -- "vulto"

  hp_base int not null default 0,
  hp_current int not null default 0,
  ep_base int not null default 0,
  ep_current int not null default 0,

  credits int not null default 0,
  cifras int not null default 0,

  attack int not null default 0,
  resistance int not null default 0,
  agility int not null default 0,
  intellect int not null default 0,
  charisma int not null default 0,

  season int not null default 1,
  status text not null default 'active' check (status in ('active','archived','pending_review')),

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- garante 1 ficha ativa por jogador
create unique index one_active_character_per_user
  on characters(user_id)
  where status = 'active';

-- ---------- PERÍCIAS (passivas) ----------
create table skills_passive (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text
);

create table character_skills_passive (
  character_id uuid references characters(id) on delete cascade,
  skill_id uuid references skills_passive(id) on delete cascade,
  primary key (character_id, skill_id)
);

-- ---------- HABILIDADES (bases/elementais e sintéticas) ----------
create table abilities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  type text not null check (type in ('base','sintetica')),
  cifras_cost int default 0 -- custo de evolução no Sistema Cardinal (a detalhar)
);

create table character_abilities (
  character_id uuid references characters(id) on delete cascade,
  ability_id uuid references abilities(id) on delete cascade,
  level int not null default 1,
  primary key (character_id, ability_id)
);

-- ---------- EQUIPAMENTO / INVENTÁRIO ----------
create table items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  image_url text, -- arte do item (upload feito pelo player)
  slot text not null check (slot in ('armadura','item_classe','arma','bolsa'))
);

create table character_equipment (
  id uuid primary key default gen_random_uuid(),
  character_id uuid references characters(id) on delete cascade,
  item_id uuid references items(id) on delete cascade,
  slot text not null check (slot in ('armadura','item_classe','arma','bolsa')),
  quantity int not null default 1,
  level int default 1
);

-- ---------- CODEX / LORE ----------
-- 'glossario' cobre termos próprios do universo (Vulto, Cifras, etc), exibido como
-- aba/filtro interno do Codex, não como item de menu separado.
create table lore_entries (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  type text not null check (type in (
    'cosmologia','elementalistas','raca','classe',
    'faccao','local','evento','glossario','personagem'
  )),
  summary text, -- versão resumida usada na Home
  content text not null, -- versão completa exibida no Codex
  image_url text,
  related_character_id uuid references characters(id),
  published boolean not null default false,
  created_at timestamptz default now()
);

-- ---------- ROADMAP EXPRESSO ASTRAL (Temporada 1) ----------
-- Linha do tempo visual da Home: cada parada do grupo pelo sistema solar.
create table story_arcs (
  id uuid primary key default gen_random_uuid(),
  order_index int not null unique,
  planet_name text not null,
  planet_icon_url text,
  summary text not null, -- resumo curto exibido ao lado do ícone na Home
  antagonist_name text,
  antagonist_description text,
  book_chapter_start int, -- referência ao capítulo inicial no book_chapters (season 1)
  book_chapter_end int
);

-- ---------- LIVRO ----------
create table book_chapters (
  id uuid primary key default gen_random_uuid(),
  season int not null,
  chapter_number int not null,
  title text not null,
  content text not null,
  cover_image text,
  published boolean not null default false,
  published_at timestamptz,
  unique (season, chapter_number)
);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================

alter table profiles enable row level security;
alter table characters enable row level security;
alter table character_skills_passive enable row level security;
alter table character_abilities enable row level security;
alter table character_equipment enable row level security;
alter table items enable row level security;
alter table lore_entries enable row level security;
alter table book_chapters enable row level security;
alter table story_arcs enable row level security;
alter table elements enable row level security;
alter table classes enable row level security;
alter table skills_passive enable row level security;
alter table abilities enable row level security;

-- função auxiliar: é mestre?
create or replace function is_mestre()
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'mestre'
  );
$$ language sql security definer stable;

-- PROFILES: cada um vê/edita o próprio; mestre vê todos
create policy "profiles_select_own_or_mestre" on profiles
  for select using (auth.uid() = id or is_mestre());
create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

-- CHARACTERS: dono ou mestre podem ver/editar; criação pelo próprio dono
create policy "characters_select_own_or_mestre" on characters
  for select using (auth.uid() = user_id or is_mestre());
create policy "characters_insert_own" on characters
  for insert with check (auth.uid() = user_id);
create policy "characters_update_own_or_mestre" on characters
  for update using (auth.uid() = user_id or is_mestre());
create policy "characters_delete_mestre" on characters
  for delete using (is_mestre());

-- Tabelas de referência (elements, classes, skills_passive, abilities, items):
-- leitura pública (autenticado), escrita só mestre
create policy "ref_select_authenticated" on elements for select using (auth.role() = 'authenticated');
create policy "ref_write_mestre" on elements for all using (is_mestre());

create policy "ref_select_authenticated" on classes for select using (auth.role() = 'authenticated');
create policy "ref_write_mestre" on classes for all using (is_mestre());

create policy "ref_select_authenticated" on skills_passive for select using (auth.role() = 'authenticated');
create policy "ref_write_mestre" on skills_passive for all using (is_mestre());

create policy "ref_select_authenticated" on abilities for select using (auth.role() = 'authenticated');
create policy "ref_write_mestre" on abilities for all using (is_mestre());

create policy "ref_select_authenticated" on items for select using (auth.role() = 'authenticated');
create policy "items_insert_own_character" on items for insert with check (auth.role() = 'authenticated');

-- Vínculos de personagem: dono ou mestre
create policy "char_skills_owner_or_mestre" on character_skills_passive
  for all using (
    exists (select 1 from characters c where c.id = character_id and (c.user_id = auth.uid() or is_mestre()))
  );

create policy "char_abilities_owner_or_mestre" on character_abilities
  for all using (
    exists (select 1 from characters c where c.id = character_id and (c.user_id = auth.uid() or is_mestre()))
  );

create policy "char_equipment_owner_or_mestre" on character_equipment
  for all using (
    exists (select 1 from characters c where c.id = character_id and (c.user_id = auth.uid() or is_mestre()))
  );

-- CODEX / LIVRO: leitura pública se publicado; escrita só mestre
create policy "lore_select_published_or_mestre" on lore_entries
  for select using (published = true or is_mestre());
create policy "lore_write_mestre" on lore_entries for all using (is_mestre());

create policy "book_select_published_or_mestre" on book_chapters
  for select using (published = true or is_mestre());
create policy "book_write_mestre" on book_chapters for all using (is_mestre());

-- STORY ARCS (Roadmap Expresso Astral): leitura pública, escrita só mestre
create policy "arcs_select_public" on story_arcs
  for select using (true);
create policy "arcs_write_mestre" on story_arcs for all using (is_mestre());

-- ============================================================
-- PATCH — CRUD real de fichas (mestre cria/edita/apaga)
-- ============================================================

drop policy if exists "characters_insert_own" on characters;
create policy "characters_insert_own_or_mestre" on characters
  for insert with check (auth.uid() = user_id or is_mestre());

create policy "profiles_insert_self_or_mestre" on profiles
  for insert with check (auth.uid() = id or is_mestre());

alter table abilities drop constraint abilities_type_check;
alter table abilities add constraint abilities_type_check
  check (type in ('base','sintetica','suprema'));

alter table items add column category text not null default 'comum'
  check (category in ('comum','raro','epico','lendario'));

-- ============================================================
-- PATCH — apagar ficha também apaga o login (nome fica livre de novo)
-- ============================================================
-- Cada ficha nasce com um login dedicado (signUp na criação). Sem isso,
-- excluir a ficha deixava profiles.username e o e-mail sintético "presos",
-- bloqueando recriar uma ficha com o mesmo nome de elementalista depois.
-- Apagar auth.users cai em cascata por profiles -> characters (on delete
-- cascade), então uma função só é necessária porque a role authenticated
-- não tem permissão de escrita no schema auth.

create or replace function delete_character_with_login(p_character_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if not is_mestre() then
    raise exception 'not authorized';
  end if;

  select user_id into v_user_id from characters where id = p_character_id;
  if v_user_id is null then
    return;
  end if;

  delete from auth.users where id = v_user_id;
end;
$$;

grant execute on function delete_character_with_login(uuid) to authenticated;

-- ============================================================
-- PATCH — liberar nome de elementalista órfão na criação
-- ============================================================
-- Cobre logins que ficaram presos por qualquer motivo anterior a este patch
-- (ex.: fichas apagadas antes de delete_character_with_login existir). Só
-- libera o nome se NÃO houver ficha de verdade vinculada — nunca apaga um
-- login com personagem ativo.

create or replace function free_up_username_if_orphaned(p_username text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_has_character boolean;
begin
  if not is_mestre() then
    raise exception 'not authorized';
  end if;

  select id into v_user_id from profiles where username = p_username;
  if v_user_id is null then
    return true; -- nome livre
  end if;

  select exists(select 1 from characters where user_id = v_user_id) into v_has_character;
  if v_has_character then
    return false; -- já existe ficha de verdade com esse nome
  end if;

  delete from auth.users where id = v_user_id;
  return true;
end;
$$;

grant execute on function free_up_username_if_orphaned(text) to authenticated;

-- ============================================================
-- PATCH — progresso de XP separado do nível
-- ============================================================
-- A barra abaixo do nível é só visual (progresso até o próximo nível), não
-- deve alterar characters.level. O nível em si passa a ser ajustado pelos
-- direcionais (como nos Traços).

alter table characters add column xp_progress int not null default 0
  check (xp_progress >= 0 and xp_progress <= 100);

-- ============================================================
-- PATCH — motor de rolagem e cálculo de dano (roadmap-sistema-rpg.md)
-- ============================================================
-- Tiers de habilidade renomeados pra bater com o sistema de dados por tier
-- (comum=d2, especial=d4, suprema=d8). PV/PE base saem de uso (viram
-- calculados por fórmula no front, hp_base/ep_base ficam sem leitura/escrita
-- ativa — não foram dropados pra não ser uma migração destrutiva à toa).

alter table abilities drop constraint abilities_type_check;

update abilities set type = 'comum' where type = 'base';
update abilities set type = 'especial' where type = 'sintetica';

alter table abilities add constraint abilities_type_check
  check (type in ('comum','especial','suprema'));

alter table abilities add column tipo_efeito text not null default 'dano'
  check (tipo_efeito in ('dano','cura','escudo'));

-- ---------- INIMIGOS (ficha-template + instância em combate) ----------
-- Fase 2 é só o schema; uso real (spawn na arena) fica pra Fase 3. Por ora
-- serve pro Painel de Inimigos: cadastro + rastreio simples de PV/PE atual.
create table enemies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  portrait_url text,
  tier text not null default 'comum' check (tier in ('comum','elite','boss')),
  level int not null default 1,
  attack int not null default 0,
  resistance int not null default 0,
  agility int not null default 0,
  intellect int not null default 0,
  charisma int not null default 0,
  description text,
  created_at timestamptz default now()
);

create table enemy_instances (
  id uuid primary key default gen_random_uuid(),
  enemy_id uuid not null references enemies(id) on delete cascade,
  label text,
  hp_current int not null default 0,
  ep_current int not null default 0,
  status text not null default 'active' check (status in ('active','defeated')),
  created_at timestamptz default now()
);

alter table enemies enable row level security;
alter table enemy_instances enable row level security;

create policy "enemies_mestre_only" on enemies for all using (is_mestre());
create policy "enemy_instances_mestre_only" on enemy_instances for all using (is_mestre());

-- ============================================================
-- PATCH — motor de turnos/iniciativa/cooldown (arena, Fase 3 sem mapa)
-- ============================================================
-- Sem mapa/tokens ainda (isso fica pra um plano futuro à parte) — aqui é só o
-- motor de combate por turnos: quem participa, ordem de iniciativa, de quem é
-- a vez, e recarga de habilidade contada em rodadas. PV/PE não são duplicados
-- aqui — continuam vivendo em characters/enemy_instances, já com RLS própria.

create table battle_sessions (
  id uuid primary key default gen_random_uuid(),
  name text,
  status text not null default 'setup' check (status in ('setup','active','ended')),
  round_number int not null default 1,
  current_turn_index int not null default 0,
  created_at timestamptz default now()
);

create table battle_participants (
  id uuid primary key default gen_random_uuid(),
  battle_session_id uuid not null references battle_sessions(id) on delete cascade,
  character_id uuid references characters(id) on delete cascade,
  enemy_instance_id uuid references enemy_instances(id) on delete cascade,
  name text not null, -- snapshot do nome, pro desempate alfabético e pro histórico
  side text not null check (side in ('aliado','inimigo')),
  initiative_roll int not null,
  initiative_bonus int not null,
  initiative_total int not null,
  created_at timestamptz default now(),
  constraint battle_participants_one_owner check ((character_id is not null) <> (enemy_instance_id is not null))
);

create table battle_ability_cooldowns (
  id uuid primary key default gen_random_uuid(),
  battle_session_id uuid not null references battle_sessions(id) on delete cascade,
  participant_id uuid not null references battle_participants(id) on delete cascade,
  ability_id uuid not null references abilities(id) on delete cascade,
  last_used_round int not null,
  unique (participant_id, ability_id)
);

alter table battle_sessions enable row level security;
alter table battle_participants enable row level security;
alter table battle_ability_cooldowns enable row level security;

-- Leitura liberada pra qualquer autenticado (todo mundo acompanha o combate ao
-- vivo); escrita de sessão/participantes é só do mestre (ele monta a luta e
-- controla o Next).
create policy "battle_sessions_select_authenticated" on battle_sessions
  for select using (auth.role() = 'authenticated');
create policy "battle_sessions_write_mestre" on battle_sessions
  for all using (is_mestre());

create policy "battle_participants_select_authenticated" on battle_participants
  for select using (auth.role() = 'authenticated');
create policy "battle_participants_write_mestre" on battle_participants
  for all using (is_mestre());

-- Cooldown pode ser gravado pelo mestre ou pelo dono do personagem dono do
-- participante (mesmo padrão owner-or-mestre já usado em character_abilities).
create policy "battle_cooldowns_select_authenticated" on battle_ability_cooldowns
  for select using (auth.role() = 'authenticated');
create policy "battle_cooldowns_write_owner_or_mestre" on battle_ability_cooldowns
  for all using (
    is_mestre() or exists (
      select 1 from battle_participants p
      join characters c on c.id = p.character_id
      where p.id = participant_id and c.user_id = auth.uid()
    )
  );

-- ============================================================
-- PATCH — habilidades de inimigo
-- ============================================================
-- Mesma tabela abilities de sempre (dano/cura/escudo, tier comum/especial/suprema),
-- só um vínculo novo pro lado do inimigo. Mestre-only de propósito: jogador não vê o
-- kit do monstro antes da hora. battle_ability_cooldowns não precisa mudar — já
-- referencia participant_id, então já cobre cooldown de habilidade de inimigo.

create table enemy_abilities (
  enemy_id uuid not null references enemies(id) on delete cascade,
  ability_id uuid not null references abilities(id) on delete cascade,
  level int not null default 1,
  primary key (enemy_id, ability_id)
);

alter table enemy_abilities enable row level security;
create policy "enemy_abilities_mestre_only" on enemy_abilities for all using (is_mestre());

-- ============================================================
-- PATCH — elemento opcional do inimigo
-- ============================================================
-- Inimigo nunca tem classe, mas pode ter elemento (nem todo tem). Reaproveita a
-- mesma tabela elements que o personagem já usa.

alter table enemies add column element_id uuid references elements(id);
