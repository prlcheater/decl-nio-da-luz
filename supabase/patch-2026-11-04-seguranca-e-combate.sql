-- ============================================================
-- PATCH 2026-11-04 — segurança das contas e combate para jogadores
-- ============================================================
-- Rodar DEPOIS de schema.sql. Pode ser executado mais de uma vez sem efeito
-- colateral. Vale tanto para projeto novo quanto para banco já em uso.
--
-- O que muda:
--   1. Jogador não consegue mais se promover a mestre.
--   2. Jogador só altera PV/PE atuais da própria ficha; o resto é do mestre.
--   3. Jogador enxerga quem está no combate ativo e consegue atingir os alvos.
--   4. As tabelas do combate passam a transmitir pelo Realtime.

-- ---------- Permissões básicas ----------
-- O acesso real continua decidido pelas policies (RLS) abaixo.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on lore_entries, book_chapters, story_arcs to anon;

-- search_path fixo: função security definer não pode depender do chamador.
create or replace function is_mestre()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'mestre'
  );
$$;

-- ============================================================
-- 1. PROFILES — fim da autopromoção a mestre
-- ============================================================
-- Antes: a policy de update não limitava colunas e a de insert aceitava qualquer
-- role, então qualquer conta podia gravar role = 'mestre' em si mesma.

drop policy if exists "profiles_insert_self_or_mestre" on profiles;
create policy "profiles_insert_self_or_mestre" on profiles
  for insert with check (is_mestre() or (auth.uid() = id and role = 'player'));

create or replace function protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() nulo = SQL Editor do painel ou service role, não um usuário do app.
  if auth.uid() is null or is_mestre() then
    return new;
  end if;
  if (to_jsonb(new) - 'avatar_url') is distinct from (to_jsonb(old) - 'avatar_url') then
    raise exception 'somente o mestre altera este campo do perfil';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_fields on profiles;
create trigger protect_profile_fields
  before update on profiles
  for each row execute function protect_profile_fields();

-- ============================================================
-- 2. FICHAS — jogador só mexe em PV/PE atuais
-- ============================================================
-- Regra do projeto: o mestre cria e evolui a ficha; o jogador ajusta PV/PE.
-- A comparação é pela linha inteira menos as colunas liberadas, então qualquer
-- coluna nova nasce protegida por padrão.

drop policy if exists "characters_insert_own" on characters;
drop policy if exists "characters_insert_own_or_mestre" on characters;
drop policy if exists "characters_insert_mestre" on characters;
create policy "characters_insert_mestre" on characters
  for insert with check (is_mestre());

create or replace function protect_character_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or is_mestre() then
    return new;
  end if;
  if (to_jsonb(new) - 'hp_current' - 'ep_current' - 'updated_at')
     is distinct from
     (to_jsonb(old) - 'hp_current' - 'ep_current' - 'updated_at') then
    raise exception 'jogador só altera PV e PE atuais; o resto da ficha é do mestre';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_character_fields on characters;
create trigger protect_character_fields
  before update on characters
  for each row execute function protect_character_fields();

-- Habilidades, perícias e equipamento: dono lê, só o mestre grava.
drop policy if exists "char_skills_owner_or_mestre" on character_skills_passive;
drop policy if exists "char_skills_select_owner_or_mestre" on character_skills_passive;
drop policy if exists "char_skills_write_mestre" on character_skills_passive;
create policy "char_skills_select_owner_or_mestre" on character_skills_passive
  for select using (
    exists (select 1 from characters c where c.id = character_id and (c.user_id = auth.uid() or is_mestre()))
  );
create policy "char_skills_write_mestre" on character_skills_passive
  for all using (is_mestre());

drop policy if exists "char_abilities_owner_or_mestre" on character_abilities;
drop policy if exists "char_abilities_select_owner_or_mestre" on character_abilities;
drop policy if exists "char_abilities_write_mestre" on character_abilities;
create policy "char_abilities_select_owner_or_mestre" on character_abilities
  for select using (
    exists (select 1 from characters c where c.id = character_id and (c.user_id = auth.uid() or is_mestre()))
  );
create policy "char_abilities_write_mestre" on character_abilities
  for all using (is_mestre());

drop policy if exists "char_equipment_owner_or_mestre" on character_equipment;
drop policy if exists "char_equipment_select_owner_or_mestre" on character_equipment;
drop policy if exists "char_equipment_write_mestre" on character_equipment;
create policy "char_equipment_select_owner_or_mestre" on character_equipment
  for select using (
    exists (select 1 from characters c where c.id = character_id and (c.user_id = auth.uid() or is_mestre()))
  );
create policy "char_equipment_write_mestre" on character_equipment
  for all using (is_mestre());

drop policy if exists "items_insert_own_character" on items;
drop policy if exists "items_write_mestre" on items;
create policy "items_write_mestre" on items
  for all using (is_mestre());

-- Apagar a ficha de quem é mestre não pode levar junto o login do mestre.
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

  if exists (select 1 from profiles where id = v_user_id and role = 'mestre') then
    delete from characters where id = p_character_id;
    return;
  end if;

  delete from auth.users where id = v_user_id;
end;
$$;

-- ============================================================
-- 3. COMBATE — jogador enxerga e atinge os participantes
-- ============================================================
-- Antes: o jogador só lia a própria ficha e inimigos eram exclusivos do mestre.
-- No combate a lista de alvos dele tinha só ele mesmo, e não havia como causar
-- dano. A leitura abre apenas enquanto a luta está ativa; o kit de habilidades
-- do inimigo (enemy_abilities) continua só do mestre.

drop policy if exists "characters_select_in_active_battle" on characters;
create policy "characters_select_in_active_battle" on characters
  for select to authenticated using (
    exists (
      select 1 from battle_participants p
      join battle_sessions s on s.id = p.battle_session_id
      where p.character_id = characters.id and s.status = 'active'
    )
  );

drop policy if exists "enemy_instances_select_in_active_battle" on enemy_instances;
create policy "enemy_instances_select_in_active_battle" on enemy_instances
  for select to authenticated using (
    exists (
      select 1 from battle_participants p
      join battle_sessions s on s.id = p.battle_session_id
      where p.enemy_instance_id = enemy_instances.id and s.status = 'active'
    )
  );

drop policy if exists "enemies_select_in_active_battle" on enemies;
create policy "enemies_select_in_active_battle" on enemies
  for select to authenticated using (
    exists (
      select 1 from enemy_instances i
      join battle_participants p on p.enemy_instance_id = i.id
      join battle_sessions s on s.id = p.battle_session_id
      where i.enemy_id = enemies.id and s.status = 'active'
    )
  );

-- Aplica dano (delta negativo) ou cura (delta positivo) em quem está na luta.
-- O ajuste é feito no próprio banco para dois golpes simultâneos não se
-- sobrescreverem. p_hp_max vem do front, onde ficam as fórmulas do jogo
-- (diceEngine.ts): as rolagens também acontecem lá, então o banco confere quem
-- age e em qual luta, mas não recalcula o valor nem confere de quem é a vez.
create or replace function combat_apply_hp(
  p_actor_participant_id uuid,
  p_target_participant_id uuid,
  p_delta int,
  p_hp_max int
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_battle_id uuid;
  v_actor_character_id uuid;
  v_target_battle_id uuid;
  v_target_character_id uuid;
  v_target_instance_id uuid;
  v_new_hp int;
begin
  select p.battle_session_id, p.character_id
    into v_battle_id, v_actor_character_id
    from battle_participants p
    join battle_sessions s on s.id = p.battle_session_id
   where p.id = p_actor_participant_id and s.status = 'active';

  if v_battle_id is null then
    raise exception 'combate não está ativo';
  end if;

  if not is_mestre() and not exists (
    select 1 from characters c
    where c.id = v_actor_character_id and c.user_id = auth.uid()
  ) then
    raise exception 'not authorized';
  end if;

  select battle_session_id, character_id, enemy_instance_id
    into v_target_battle_id, v_target_character_id, v_target_instance_id
    from battle_participants
   where id = p_target_participant_id;

  if v_target_battle_id is distinct from v_battle_id then
    raise exception 'alvo não está neste combate';
  end if;

  if v_target_character_id is not null then
    update characters
       set hp_current = least(greatest(p_hp_max, 0), greatest(0, hp_current + p_delta))
     where id = v_target_character_id
     returning hp_current into v_new_hp;
  else
    update enemy_instances
       set hp_current = least(greatest(p_hp_max, 0), greatest(0, hp_current + p_delta))
     where id = v_target_instance_id
     returning hp_current into v_new_hp;
  end if;

  return v_new_hp;
end;
$$;

revoke all on function combat_apply_hp(uuid, uuid, int, int) from public;
revoke all on function combat_apply_hp(uuid, uuid, int, int) from anon;
grant execute on function combat_apply_hp(uuid, uuid, int, int) to authenticated;

-- ============================================================
-- 4. REALTIME — o front assina estas tabelas em Combate e na Ficha
-- ============================================================
-- Sem isto as telas só atualizavam ao recarregar a página.

do $$
declare
  t text;
begin
  foreach t in array array[
    'battle_sessions', 'battle_participants', 'battle_ability_cooldowns',
    'characters', 'enemy_instances'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
