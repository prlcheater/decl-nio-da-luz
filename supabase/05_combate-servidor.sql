-- Beta 1.1 — Fases 2 e 3: buffs/debuffs, barreira e execução confiável no servidor.
-- Aplicar DEPOIS dos patches de 04, 07 e 08/11/2026. Pode rodar mais de uma vez.
-- Aditivo: não apaga fichas, habilidades, vínculos nem combates.
--
-- O que muda:
--   1. battle_effects: buffs, debuffs e barreira por participante (inimigos repetidos têm estados próprios).
--   2. battle_actions: log de cada ação com ID idempotente (repetir a requisição não repete efeito/custo).
--   3. combat_use_ability: valida turno, autoria, alvo, lado, recursos, recarga e habilitação;
--      rola, aplica efeitos, gasta PE, grava recarga e log numa única transação.
--   4. combat_next_turn: passa o turno (mestre ou dono do participante atual) e expira efeitos.
--   5. Teste de execução por Intelecto, opcional por combate (desligado por padrão).
--   6. abilities.combat_enabled: rascunhos antigos só ficam utilizáveis quando o mestre habilita.
--   7. Fecha caminhos antigos: combat_apply_hp e gravação de recarga pelo jogador.
--
-- Regras PROVISÓRIAS (a calibrar com Paulo; ver notas BETA-1.1-FASES.md):
--   - Buff/debuff: mesmo alvo+tipo+atributo mantém a MAIOR magnitude e a MAIOR duração restante (sem soma).
--   - Duração conta turnos do alvo: decrementa ao fim de cada turno dele. Se aplicado durante o próprio
--     turno do alvo, esse turno não conta.
--   - Atributo efetivo = base + buff − debuff, mínimo 0. Não altera PV/PE máximos nem custos.
--   - Barreira (escudo): reserva separada do PV, absorve dano depois da mitigação. Não acumula: fica a maior.
--     Dura até ser consumida ou o combate acabar.
--   - Ponto vital só dobra efeitos de dano. Crítico (d20 = 20) dobra dano, cura e barreira.
--   - Teste de execução: maior d20 do conjunto de Intelecto + Intelecto ≥ 10/15/20 (Comum/Especial/Suprema).
--     Falha gasta metade do PE, não aplica efeitos nem recarga.

begin;

-- ---------- Habilitação explícita ----------
create or replace function public.combat_ability_supported(d jsonb)
returns boolean language plpgsql immutable set search_path = public as $$
declare e jsonb;
begin
  if d is null then return true; end if;
  if not public.valid_ability_definition(d) then return false; end if;
  for e in select value from jsonb_array_elements(d->'effects') loop
    if e->>'kind' not in ('dano','cura','escudo','buff','debuff') then return false; end if;
    if (e->>'appliesElement')::boolean then return false; end if;
  end loop;
  return true;
exception when others then return false;
end;
$$;

alter table public.abilities add column if not exists combat_enabled boolean not null default false;
-- Mantém utilizável o que já era utilizável na fase 1; rascunhos continuam rascunhos.
update public.abilities a set combat_enabled = true
 where not a.combat_enabled and (
   a.definition is null or (
     public.valid_ability_definition(a.definition)
     and jsonb_array_length(a.definition->'effects') = 1
     and a.definition->'effects'->0->>'kind' in ('dano','cura','escudo')
     and a.definition->'effects'->0->>'kind' = a.tipo_efeito
     and not (a.definition->'effects'->0->>'appliesElement')::boolean
     and a.definition->'effects'->0->>'target' <> 'self'));
alter table public.abilities drop constraint if exists abilities_combat_enabled_supported;
alter table public.abilities add constraint abilities_combat_enabled_supported
  check (not combat_enabled or public.combat_ability_supported(definition));

-- Habilidades novas nascem habilitadas quando o motor suporta todos os efeitos.
create or replace function public.create_structured_ability(
  p_owner_type text, p_owner_id uuid, p_name text, p_description text,
  p_tier text, p_level integer, p_definition jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_kind text;
begin
  if not coalesce(is_mestre(), false) then raise exception 'Apenas mestres podem criar habilidades.'; end if;
  if p_owner_type is null or p_owner_type not in ('character','enemy') then raise exception 'Destino inválido.'; end if;
  if p_name is null or length(trim(p_name)) not between 1 and 100 or length(coalesce(p_description,'')) > 2000 then raise exception 'Nome ou descrição inválidos.'; end if;
  if p_tier is null or p_tier not in ('comum','especial','suprema') or p_level is null or p_level not between 1 and 10 then raise exception 'Tier ou nível inválidos.'; end if;
  if p_definition is null or not public.valid_ability_definition(p_definition) then raise exception 'Definição de habilidade inválida.'; end if;
  v_kind := p_definition->'effects'->0->>'kind';
  insert into abilities(name, description, type, tipo_efeito, definition, combat_enabled)
    values(trim(p_name), nullif(trim(p_description),''), p_tier,
      case when v_kind in ('dano','cura','escudo') then v_kind else 'dano' end, p_definition,
      public.combat_ability_supported(p_definition))
    returning id into v_id;
  if p_owner_type = 'character' then
    insert into character_abilities(character_id, ability_id, level) values(p_owner_id, v_id, p_level);
  else
    insert into enemy_abilities(enemy_id, ability_id, level) values(p_owner_id, v_id, p_level);
  end if;
  return v_id;
end;
$$;
revoke all on function public.create_structured_ability(text,uuid,text,text,text,integer,jsonb) from public, anon;
grant execute on function public.create_structured_ability(text,uuid,text,text,text,integer,jsonb) to authenticated;

-- ---------- Tabelas ----------
alter table public.battle_sessions add column if not exists execution_test boolean not null default false;

create table if not exists public.battle_effects (
  id uuid primary key default gen_random_uuid(),
  battle_session_id uuid not null references public.battle_sessions(id) on delete cascade,
  target_participant_id uuid not null references public.battle_participants(id) on delete cascade,
  source_participant_id uuid references public.battle_participants(id) on delete set null,
  ability_id uuid references public.abilities(id) on delete set null,
  kind text not null check (kind in ('buff','debuff','barreira')),
  attribute text not null default '' check (attribute in ('','attack','resistance','agility','intellect','charisma')),
  amount int not null check (amount > 0),
  remaining_turns int check (remaining_turns is null or remaining_turns > 0),
  skip_next_tick boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (target_participant_id, kind, attribute),
  check ((kind = 'barreira') = (attribute = '')),
  check ((kind = 'barreira') = (remaining_turns is null))
);

create table if not exists public.battle_actions (
  id uuid primary key,
  battle_session_id uuid not null references public.battle_sessions(id) on delete cascade,
  actor_participant_id uuid references public.battle_participants(id) on delete set null,
  ability_id uuid references public.abilities(id) on delete set null,
  kind text not null check (kind in ('ability','turn')),
  round_number int not null,
  result jsonb not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists battle_actions_session_idx on public.battle_actions(battle_session_id, created_at);

alter table public.battle_effects enable row level security;
alter table public.battle_actions enable row level security;
grant select, insert, update, delete on public.battle_effects, public.battle_actions to authenticated;
drop policy if exists "battle_effects_select" on public.battle_effects;
create policy "battle_effects_select" on public.battle_effects for select to authenticated using (true);
drop policy if exists "battle_effects_write_mestre" on public.battle_effects;
create policy "battle_effects_write_mestre" on public.battle_effects for all to authenticated using (is_mestre()) with check (is_mestre());
drop policy if exists "battle_actions_select" on public.battle_actions;
create policy "battle_actions_select" on public.battle_actions for select to authenticated using (true);
-- Log só é escrito pelas funções abaixo (security definer). Nem o mestre edita o histórico.

-- Recarga passa a ser escrita só pelo servidor (ou pelo mestre, para correção).
drop policy if exists "battle_cooldowns_write_owner_or_mestre" on public.battle_ability_cooldowns;
drop policy if exists "battle_cooldowns_write_mestre" on public.battle_ability_cooldowns;
create policy "battle_cooldowns_write_mestre" on public.battle_ability_cooldowns for all to authenticated using (is_mestre()) with check (is_mestre());

-- Caminho antigo: valor e PV máximo vinham do navegador.
revoke execute on function public.combat_apply_hp(uuid, uuid, int, int) from authenticated;

-- ---------- Funções auxiliares ----------
create or replace function public.combat_roll_sum(p_count int, p_sides int)
returns int language plpgsql volatile set search_path = public as $$
declare v int := 0; i int;
begin
  for i in 1..greatest(0, p_count) loop v := v + 1 + floor(random() * p_sides)::int; end loop;
  return v;
end;
$$;

create or replace function public.combat_roll_max(p_count int, p_sides int)
returns int language plpgsql volatile set search_path = public as $$
declare v int := 0; i int;
begin
  for i in 1..greatest(1, p_count) loop v := greatest(v, 1 + floor(random() * p_sides)::int); end loop;
  return v;
end;
$$;

create or replace function public.combat_pool_size(p_status int)
returns int language sql immutable as $$ select least(6, greatest(0, p_status) / 4 + 1) $$;

-- Ficha base do participante: atributos, nível, tier (inimigo) e recursos atuais.
create or replace function public.combat_participant_base(p_participant uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when p.character_id is not null then (
    select jsonb_build_object('kind','character','ref',c.id,'user_id',c.user_id,'name',p.name,'side',p.side,
      'level',c.level,'attack',c.attack,'resistance',c.resistance,'agility',c.agility,'intellect',c.intellect,'charisma',c.charisma,
      'hp',c.hp_current,'ep',c.ep_current,'tier',null,
      'hp_max',500 + c.resistance*150 + c.level*10,'ep_max',300 + c.intellect*100 + c.level*8)
    from characters c where c.id = p.character_id)
  else (
    select jsonb_build_object('kind','enemy','ref',i.id,'enemy_id',e.id,'user_id',null,'name',p.name,'side',p.side,
      'level',e.level,'attack',e.attack,'resistance',e.resistance,'agility',e.agility,'intellect',e.intellect,'charisma',e.charisma,
      'hp',i.hp_current,'ep',i.ep_current,'tier',e.tier,
      'hp_max',round((500 + e.resistance*150 + e.level*10) * (case e.tier when 'elite' then 1.5 when 'boss' then 3.0 else 1.0 end)),
      'ep_max',round((300 + e.intellect*100 + e.level*8) * (case e.tier when 'elite' then 1.5 when 'boss' then 3.0 else 1.0 end)))
    from enemy_instances i join enemies e on e.id = i.enemy_id where i.id = p.enemy_instance_id)
  end
  from battle_participants p where p.id = p_participant;
$$;

create or replace function public.combat_effective_attr(p_participant uuid, p_attr text)
returns int language sql stable security definer set search_path = public as $$
  select greatest(0, coalesce((public.combat_participant_base(p_participant)->>p_attr)::int, 0)
    + coalesce((select sum(case kind when 'buff' then amount else -amount end)
                  from battle_effects where target_participant_id = p_participant and attribute = p_attr), 0))::int;
$$;

-- Ordem: iniciativa desc, nome (bytes) e id. O front usa a mesma ordem.
create or replace function public.combat_current_participant(p_battle uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select p.id from battle_participants p, battle_sessions s
   where s.id = p_battle and p.battle_session_id = s.id
   order by p.initiative_total desc, p.name collate "C", p.id
   offset (select s2.current_turn_index % greatest(1, (select count(*) from battle_participants where battle_session_id = p_battle))
             from battle_sessions s2 where s2.id = p_battle)
   limit 1;
$$;

create or replace function public.combat_controls(p_participant uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(is_mestre(), false) or exists (
    select 1 from battle_participants p join characters c on c.id = p.character_id
     where p.id = p_participant and c.user_id = auth.uid());
$$;

-- ---------- Ação de habilidade ----------
create or replace function public.combat_use_ability(
  p_action_id uuid,
  p_actor_participant_id uuid,
  p_ability_id uuid,
  p_target_participant_id uuid,
  p_ally_target_participant_id uuid default null,
  p_ponto_vital boolean default false
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_existing battle_actions;
  v_battle battle_sessions;
  v_actor jsonb;
  v_target_side text;
  v_ally uuid;
  v_ability abilities;
  v_level int;
  v_effects jsonb;
  v_has_hostile boolean;
  v_last_round int;
  v_cd int;
  v_cost int;
  v_tier text;
  v_cfg_die int; v_cfg_inc int; v_pct numeric; v_dc int;
  v_exec jsonb := null;
  v_roll int; v_int int;
  v_crit boolean;
  v_dano_mult numeric := 1;
  e jsonb;
  v_recipient uuid;
  v_rec jsonb;
  v_scaler int; v_n int; v_raw int; v_res int; v_mit int; v_after int; v_absorbed int; v_loss int; v_gain int;
  v_barrier battle_effects;
  v_out jsonb := '[]'::jsonb;
  v_result jsonb;
begin
  if p_action_id is null then raise exception 'Ação sem identificador.'; end if;

  -- Trava a sessão: ações do mesmo combate são resolvidas uma de cada vez.
  select s.* into v_battle from battle_sessions s join battle_participants p on p.battle_session_id = s.id
   where p.id = p_actor_participant_id and s.status = 'active' for update of s;
  if v_battle.id is null then raise exception 'Combate não está ativo.'; end if;

  -- Idempotência: a mesma ação devolve o mesmo resultado, sem repetir efeito ou custo.
  select * into v_existing from battle_actions where id = p_action_id;
  if found then
    if v_existing.actor_participant_id is distinct from p_actor_participant_id then raise exception 'Identificador de ação já usado.'; end if;
    return v_existing.result;
  end if;

  if not public.combat_controls(p_actor_participant_id) then raise exception 'Você não controla este participante.'; end if;
  if public.combat_current_participant(v_battle.id) is distinct from p_actor_participant_id then raise exception 'Não é o turno deste participante.'; end if;

  v_actor := public.combat_participant_base(p_actor_participant_id);
  -- Regra de 0 PV ainda pendente com Paulo: não bloqueia aqui (mesmo comportamento anterior).

  -- Habilidade pertence ao participante?
  if v_actor->>'kind' = 'character' then
    select ca.level into v_level from character_abilities ca where ca.character_id = (v_actor->>'ref')::uuid and ca.ability_id = p_ability_id;
  else
    select ea.level into v_level from enemy_abilities ea where ea.enemy_id = (v_actor->>'enemy_id')::uuid and ea.ability_id = p_ability_id;
    v_dano_mult := case v_actor->>'tier' when 'elite' then 0.9 when 'boss' then 1.1 else 0.7 end;
  end if;
  if v_level is null then raise exception 'Habilidade não pertence a este participante.'; end if;
  select * into v_ability from abilities where id = p_ability_id;
  if not v_ability.combat_enabled or not public.combat_ability_supported(v_ability.definition) then
    raise exception 'Habilidade em rascunho ou não habilitada para combate.';
  end if;

  if v_ability.definition is null then
    v_effects := jsonb_build_array(jsonb_build_object('kind', v_ability.tipo_efeito,
      'scaler', case v_ability.tipo_efeito when 'cura' then 'intellect' when 'escudo' then 'resistance' else 'attack' end,
      'target', case v_ability.tipo_efeito when 'dano' then 'enemy' else 'ally' end));
  else
    v_effects := v_ability.definition->'effects';
  end if;
  v_has_hostile := exists (select 1 from jsonb_array_elements(v_effects) x where x->>'kind' in ('dano','debuff'));

  -- Alvos: efeitos hostis vão ao alvo principal (adversário); de apoio, ao aliado escolhido.
  select side into v_target_side from battle_participants where id = p_target_participant_id and battle_session_id = v_battle.id;
  if v_target_side is null then raise exception 'Alvo não está neste combate.'; end if;
  if v_has_hostile then
    if v_target_side = v_actor->>'side' then raise exception 'Sem fogo amigo: escolha um adversário.'; end if;
    v_ally := coalesce(p_ally_target_participant_id, p_actor_participant_id);
    if (select side from battle_participants where id = v_ally and battle_session_id = v_battle.id) is distinct from v_actor->>'side' then
      raise exception 'O alvo de apoio precisa ser aliado.';
    end if;
  else
    if v_target_side <> v_actor->>'side' then raise exception 'Habilidade de apoio só afeta aliados.'; end if;
    v_ally := p_target_participant_id;
  end if;

  -- Recarga e custo.
  v_tier := v_ability.type;
  v_cfg_die := case v_tier when 'especial' then 4 when 'suprema' then 8 else 2 end;
  v_cfg_inc := case v_tier when 'especial' then 15 when 'suprema' then 75 else 3 end;
  v_pct := case v_tier when 'especial' then 0.25 when 'suprema' then 0.5 else 0.1 end;
  v_cd := case v_tier when 'especial' then 1 when 'suprema' then 3 else 0 end;
  v_dc := case v_tier when 'especial' then 15 when 'suprema' then 20 else 10 end;
  select last_used_round into v_last_round from battle_ability_cooldowns where participant_id = p_actor_participant_id and ability_id = p_ability_id;
  if v_last_round is not null and v_battle.round_number - v_last_round < v_cd then raise exception 'Habilidade em recarga.'; end if;
  v_cost := round(v_pct * (v_actor->>'ep_max')::numeric);
  if (v_actor->>'ep')::int < v_cost then raise exception 'Energia insuficiente.'; end if;

  -- Teste de execução (opcional por combate).
  if v_battle.execution_test then
    v_int := public.combat_effective_attr(p_actor_participant_id, 'intellect');
    v_roll := public.combat_roll_max(public.combat_pool_size(v_int), 20);
    v_exec := jsonb_build_object('roll', v_roll, 'intellect', v_int, 'total', v_roll + v_int, 'dc', v_dc, 'success', v_roll + v_int >= v_dc);
    if not (v_exec->>'success')::boolean then
      v_cost := round(v_cost / 2.0);
    end if;
  end if;

  if v_exec is null or (v_exec->>'success')::boolean then
    v_crit := floor(random() * 20) = 19;
    for e in select value from jsonb_array_elements(v_effects) loop
      v_recipient := case e->>'target' when 'enemy' then p_target_participant_id when 'self' then p_actor_participant_id else v_ally end;
      v_rec := public.combat_participant_base(v_recipient);
      if e->>'kind' in ('dano','cura','escudo') then
        v_scaler := public.combat_effective_attr(p_actor_participant_id, e->>'scaler');
        v_n := least(200, v_scaler * 10);
        v_raw := (v_cfg_inc * v_level + public.combat_roll_sum(v_n, v_cfg_die)) * (case when v_crit then 2 else 1 end);
      end if;

      if e->>'kind' = 'dano' then
        v_raw := round(v_raw * (case when p_ponto_vital then 2 else 1 end) * v_dano_mult);
        v_res := public.combat_effective_attr(v_recipient, 'resistance');
        v_mit := public.combat_roll_sum(public.combat_pool_size(v_res), 10) + v_res;
        v_after := greatest(0, v_raw - v_mit);
        select * into v_barrier from battle_effects where target_participant_id = v_recipient and kind = 'barreira' for update;
        v_absorbed := least(coalesce(v_barrier.amount, 0), v_after);
        if v_absorbed > 0 then
          if v_barrier.amount - v_absorbed > 0 then
            update battle_effects set amount = amount - v_absorbed, updated_at = now() where id = v_barrier.id;
          else
            delete from battle_effects where id = v_barrier.id;
          end if;
        end if;
        v_loss := v_after - v_absorbed;
        if v_rec->>'kind' = 'character' then
          update characters set hp_current = greatest(0, hp_current - v_loss) where id = (v_rec->>'ref')::uuid;
        else
          update enemy_instances set hp_current = greatest(0, hp_current - v_loss) where id = (v_rec->>'ref')::uuid;
        end if;
        v_out := v_out || jsonb_build_object('kind','dano','target',v_recipient,'target_name',v_rec->>'name','scaler',e->>'scaler',
          'raw',v_raw,'mitigation',v_mit,'absorbed',v_absorbed,'hp_loss',v_loss,
          'hp_after',greatest(0,(v_rec->>'hp')::int - v_loss),'hp_max',(v_rec->>'hp_max')::int);

      elsif e->>'kind' = 'cura' then
        v_gain := greatest(0, least((v_rec->>'hp_max')::int, (v_rec->>'hp')::int + v_raw) - (v_rec->>'hp')::int);
        if v_rec->>'kind' = 'character' then
          update characters set hp_current = least(500 + resistance*150 + level*10, hp_current + v_raw) where id = (v_rec->>'ref')::uuid;
        else
          update enemy_instances set hp_current = least((v_rec->>'hp_max')::int, hp_current + v_raw) where id = (v_rec->>'ref')::uuid;
        end if;
        v_out := v_out || jsonb_build_object('kind','cura','target',v_recipient,'target_name',v_rec->>'name','scaler',e->>'scaler',
          'raw',v_raw,'healed',v_gain,'hp_after',(v_rec->>'hp')::int + v_gain,'hp_max',(v_rec->>'hp_max')::int);

      elsif e->>'kind' = 'escudo' then
        insert into battle_effects(battle_session_id, target_participant_id, source_participant_id, ability_id, kind, attribute, amount)
          values (v_battle.id, v_recipient, p_actor_participant_id, p_ability_id, 'barreira', '', greatest(1, v_raw))
          on conflict (target_participant_id, kind, attribute) do update
            set amount = greatest(battle_effects.amount, excluded.amount),
                source_participant_id = case when excluded.amount > battle_effects.amount then excluded.source_participant_id else battle_effects.source_participant_id end,
                ability_id = case when excluded.amount > battle_effects.amount then excluded.ability_id else battle_effects.ability_id end,
                updated_at = now();
        v_out := v_out || jsonb_build_object('kind','escudo','target',v_recipient,'target_name',v_rec->>'name','scaler',e->>'scaler','raw',v_raw,
          'barrier',(select amount from battle_effects where target_participant_id = v_recipient and kind = 'barreira'));

      else -- buff / debuff
        insert into battle_effects(battle_session_id, target_participant_id, source_participant_id, ability_id, kind, attribute, amount, remaining_turns, skip_next_tick)
          values (v_battle.id, v_recipient, p_actor_participant_id, p_ability_id, e->>'kind', e->>'attribute', (e->>'amount')::int, (e->>'duration')::int,
                  v_recipient = p_actor_participant_id)
          on conflict (target_participant_id, kind, attribute) do update
            set amount = greatest(battle_effects.amount, excluded.amount),
                remaining_turns = greatest(battle_effects.remaining_turns, excluded.remaining_turns),
                skip_next_tick = battle_effects.skip_next_tick or excluded.skip_next_tick,
                source_participant_id = excluded.source_participant_id, ability_id = excluded.ability_id, updated_at = now();
        v_out := v_out || jsonb_build_object('kind',e->>'kind','target',v_recipient,'target_name',v_rec->>'name',
          'attribute',e->>'attribute','amount',(e->>'amount')::int,'duration',(e->>'duration')::int);
      end if;
    end loop;

    insert into battle_ability_cooldowns(battle_session_id, participant_id, ability_id, last_used_round)
      values (v_battle.id, p_actor_participant_id, p_ability_id, v_battle.round_number)
      on conflict (participant_id, ability_id) do update set last_used_round = excluded.last_used_round;
  end if;

  -- Custo (re-lê o PE: um efeito acima pode ter alterado o próprio executor).
  if v_actor->>'kind' = 'character' then
    update characters set ep_current = greatest(0, ep_current - v_cost) where id = (v_actor->>'ref')::uuid;
  else
    update enemy_instances set ep_current = greatest(0, ep_current - v_cost) where id = (v_actor->>'ref')::uuid;
  end if;

  v_result := jsonb_build_object(
    'action_id', p_action_id, 'actor', p_actor_participant_id, 'actor_name', v_actor->>'name',
    'ability_id', p_ability_id, 'ability_name', v_ability.name, 'tier', v_tier,
    'cost', v_cost, 'critico', coalesce(v_crit, false), 'ponto_vital', p_ponto_vital,
    'execution', v_exec, 'effects', v_out);
  insert into battle_actions(id, battle_session_id, actor_participant_id, ability_id, kind, round_number, result)
    values (p_action_id, v_battle.id, p_actor_participant_id, p_ability_id, 'ability', v_battle.round_number, v_result);
  return v_result;
end;
$$;

-- ---------- Turno ----------
-- p_expected_index evita que dois cliques (ou dois dispositivos) passem dois turnos.
create or replace function public.combat_next_turn(p_battle_id uuid, p_expected_index int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_battle battle_sessions;
  v_current uuid;
  v_count int;
  v_next int;
  v_expired jsonb;
begin
  select * into v_battle from battle_sessions where id = p_battle_id and status = 'active' for update;
  if v_battle.id is null then raise exception 'Combate não está ativo.'; end if;
  if v_battle.current_turn_index <> p_expected_index then
    return jsonb_build_object('index', v_battle.current_turn_index, 'round', v_battle.round_number, 'skipped', true);
  end if;
  v_current := public.combat_current_participant(p_battle_id);
  if not public.combat_controls(v_current) then raise exception 'Só o mestre ou o dono do turno pode encerrá-lo.'; end if;

  -- Fim do turno do participante atual: conta um turno nos efeitos dele.
  -- Efeito aplicado durante o próprio turno do alvo não conta este turno.
  with expired as (
    delete from battle_effects
     where target_participant_id = v_current and remaining_turns = 1 and not skip_next_tick
     returning kind, attribute
  ) select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'attribute',attribute)), '[]'::jsonb)
      into v_expired from expired;
  update battle_effects set remaining_turns = remaining_turns - 1, updated_at = now()
   where target_participant_id = v_current and remaining_turns > 1 and not skip_next_tick;
  update battle_effects set skip_next_tick = false where target_participant_id = v_current and skip_next_tick;

  select count(*) into v_count from battle_participants where battle_session_id = p_battle_id;
  v_next := (v_battle.current_turn_index + 1) % greatest(1, v_count);
  update battle_sessions set current_turn_index = v_next,
         round_number = case when v_next = 0 then round_number + 1 else round_number end
   where id = p_battle_id;
  insert into battle_actions(id, battle_session_id, actor_participant_id, kind, round_number, result)
    values (gen_random_uuid(), p_battle_id, v_current, 'turn', v_battle.round_number,
            jsonb_build_object('ended', v_current, 'expired', v_expired));
  return jsonb_build_object('index', v_next, 'expired', v_expired);
end;
$$;

revoke all on function public.combat_use_ability(uuid,uuid,uuid,uuid,uuid,boolean) from public, anon;
revoke all on function public.combat_next_turn(uuid,int) from public, anon;
grant execute on function public.combat_use_ability(uuid,uuid,uuid,uuid,uuid,boolean) to authenticated;
grant execute on function public.combat_next_turn(uuid,int) to authenticated;
-- Auxiliares internos: não expor como API.
revoke all on function public.combat_participant_base(uuid) from public, anon, authenticated;
revoke all on function public.combat_effective_attr(uuid,text) from public, anon, authenticated;
revoke all on function public.combat_current_participant(uuid) from public, anon, authenticated;
revoke all on function public.combat_controls(uuid) from public, anon, authenticated;
revoke all on function public.combat_roll_sum(int,int) from public, anon, authenticated;
revoke all on function public.combat_roll_max(int,int) from public, anon, authenticated;

-- ---------- Realtime ----------
do $$
declare t text;
begin
  foreach t in array array['battle_effects','battle_actions'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

commit;
