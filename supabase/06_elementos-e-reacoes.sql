-- Beta 1.1 — Fases 4 e 5: marcas elementais e primeiras reações.
-- Aplicar DEPOIS do patch de 09/11 (fases 2 e 3). Pode rodar mais de uma vez.
-- Não reaplicar o patch de 09/11 depois deste: ele recolocaria a versão antiga de combat_use_ability.
--
-- Fase 4 — marcas elementais
--   - Efeito com "aplicar estado elemental" deixa uma MARCA do elemento no destinatário,
--     com origem (quem aplicou) e duração em turnos do alvo. Afinidade da ficha não aplica marca.
--   - Mesmo elemento reaplicado renova (maior duração). Elementos diferentes sem reação coexistem.
--
-- Fase 5 — reações (primeiro lote). Disparam quando um efeito com aplicação elemental atinge
-- um alvo que já tem marca de OUTRO elemento colocada pela MESMA equipe do executor.
--   Vaporização   (Marine + Ignis)   dano: +50% no dano bruto do golpe.
--   Derretimento  (Ignis + Glácis)   dano: +50% no dano bruto do golpe.
--   Congelamento  (Marine + Glácis)  dano/debuff: "Congelado" — Agilidade −3 por 1 turno do alvo.
--   Condução      (Marine + Élix)    dano: choque salta para até 2 outros adversários com marca Marine
--                                    da sua equipe, 50% do dano bruto cada (consome a marca deles).
--   Alastramento  (Ignis + Galeo)    dano: fogo se espalha para até 2 outros adversários, 25% do dano bruto.
--   Germinação    (Marine + Gaia)    cura em aliado: +50% na cura.
-- Valores PROVISÓRIOS (a calibrar com Paulo). Demais pares do catálogo: sem reação por enquanto.
--
-- Limites: uma reação por alvo por ação; reação consome a marca preparada e o golpe que reage não
-- deixa marca nova; danos secundários não disparam reações; marca do adversário nunca beneficia
-- quem a recebeu (sem fogo amigo, sem curar o inimigo).

begin;

-- ---------- Suporte: aplicação elemental deixa de ser rascunho ----------
create or replace function public.combat_ability_supported(d jsonb)
returns boolean language plpgsql immutable set search_path = public as $$
declare e jsonb;
begin
  if d is null then return true; end if;
  if not public.valid_ability_definition(d) then return false; end if;
  for e in select value from jsonb_array_elements(d->'effects') loop
    if e->>'kind' not in ('dano','cura','escudo','buff','debuff') then return false; end if;
  end loop;
  return true;
exception when others then return false;
end;
$$;
-- Rascunhos elementais antigos continuam com combat_enabled = false até o mestre revisar.

-- ---------- battle_effects: marcas ----------
alter table public.battle_effects add column if not exists element text;
alter table public.battle_effects add column if not exists label text;

do $$
declare c record;
begin
  for c in select conname from pg_constraint where conrelid = 'public.battle_effects'::regclass and contype in ('c','u') loop
    execute format('alter table public.battle_effects drop constraint %I', c.conname);
  end loop;
end;
$$;
alter table public.battle_effects
  add constraint battle_effects_kind_ok check (kind in ('buff','debuff','barreira','marca')),
  add constraint battle_effects_attribute_ok check (attribute in ('','attack','resistance','agility','intellect','charisma')),
  add constraint battle_effects_amount_ok check (amount > 0),
  add constraint battle_effects_turns_ok check (remaining_turns is null or remaining_turns > 0),
  add constraint battle_effects_modifier_has_attribute check ((kind in ('buff','debuff')) = (attribute <> '')),
  add constraint battle_effects_barrier_no_turns check ((kind = 'barreira') = (remaining_turns is null)),
  add constraint battle_effects_mark_element check ((kind = 'marca') = (element is not null)),
  add constraint battle_effects_element_ok check (element is null or element in ('Élix','Gaia','Galeo','Glácis','Granite','Ignis','Marine','Umbra','Aura'));
create unique index if not exists battle_effects_slot on public.battle_effects (target_participant_id, kind, attribute, (coalesce(element, '')));

-- ---------- Catálogo de reações habilitadas (simétrico) ----------
create or replace function public.combat_reaction(a text, b text)
returns text language sql immutable as $$
  select case
    when (a, b) in (('Marine','Ignis'), ('Ignis','Marine')) then 'vaporizacao'
    when (a, b) in (('Ignis','Glácis'), ('Glácis','Ignis')) then 'derretimento'
    when (a, b) in (('Marine','Glácis'), ('Glácis','Marine')) then 'congelamento'
    when (a, b) in (('Marine','Élix'), ('Élix','Marine')) then 'conducao'
    when (a, b) in (('Ignis','Galeo'), ('Galeo','Ignis')) then 'alastramento'
    when (a, b) in (('Marine','Gaia'), ('Gaia','Marine')) then 'germinacao'
  end
$$;

-- Efeito exigido por reação: ofensivas reagem a golpe em adversário; Germinação, a cura em aliado.
create or replace function public.combat_reaction_fits(p_reaction text, p_kind text)
returns boolean language sql immutable as $$
  select case p_reaction
    when 'germinacao' then p_kind = 'cura'
    when 'congelamento' then p_kind in ('dano','debuff')
    else p_kind = 'dano'
  end
$$;

-- Dano já calculado (bruto) → mitigação do alvo → barreira → PV.
create or replace function public.combat_apply_damage(p_recipient uuid, p_raw int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_rec jsonb; v_res int; v_mit int; v_after int; v_absorbed int; v_loss int;
  v_barrier battle_effects;
begin
  v_rec := public.combat_participant_base(p_recipient);
  v_res := public.combat_effective_attr(p_recipient, 'resistance');
  v_mit := public.combat_roll_sum(public.combat_pool_size(v_res), 10) + v_res;
  v_after := greatest(0, p_raw - v_mit);
  select * into v_barrier from battle_effects where target_participant_id = p_recipient and kind = 'barreira' for update;
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
  return jsonb_build_object('kind','dano','target',p_recipient,'target_name',v_rec->>'name','raw',p_raw,
    'mitigation',v_mit,'absorbed',v_absorbed,'hp_loss',v_loss,
    'hp_after',greatest(0,(v_rec->>'hp')::int - v_loss),'hp_max',(v_rec->>'hp_max')::int);
end;
$$;

-- ---------- Ação de habilidade (substitui a versão do patch de 09/11) ----------
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
  v_scaler int; v_n int; v_raw int; v_gain int;
  v_item jsonb;
  v_mark battle_effects;
  v_reaction text;
  v_reacted uuid[] := '{}';
  v_secondary jsonb;
  v_sec record;
  v_out jsonb := '[]'::jsonb;
  v_result jsonb;
begin
  if p_action_id is null then raise exception 'Ação sem identificador.'; end if;

  select s.* into v_battle from battle_sessions s join battle_participants p on p.battle_session_id = s.id
   where p.id = p_actor_participant_id and s.status = 'active' for update of s;
  if v_battle.id is null then raise exception 'Combate não está ativo.'; end if;

  select * into v_existing from battle_actions where id = p_action_id;
  if found then
    if v_existing.actor_participant_id is distinct from p_actor_participant_id then raise exception 'Identificador de ação já usado.'; end if;
    return v_existing.result;
  end if;

  if not public.combat_controls(p_actor_participant_id) then raise exception 'Você não controla este participante.'; end if;
  if public.combat_current_participant(v_battle.id) is distinct from p_actor_participant_id then raise exception 'Não é o turno deste participante.'; end if;

  v_actor := public.combat_participant_base(p_actor_participant_id);
  -- Regra de 0 PV ainda pendente com Paulo: não bloqueia aqui (mesmo comportamento anterior).

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
      'target', case v_ability.tipo_efeito when 'dano' then 'enemy' else 'ally' end,
      'element', null, 'appliesElement', false));
  else
    v_effects := v_ability.definition->'effects';
  end if;
  v_has_hostile := exists (select 1 from jsonb_array_elements(v_effects) x where x->>'kind' in ('dano','debuff'));

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

  if v_battle.execution_test then
    v_int := public.combat_effective_attr(p_actor_participant_id, 'intellect');
    v_roll := public.combat_roll_max(public.combat_pool_size(v_int), 20);
    v_exec := jsonb_build_object('roll', v_roll, 'intellect', v_int, 'total', v_roll + v_int, 'dc', v_dc, 'success', v_roll + v_int >= v_dc);
    if not (v_exec->>'success')::boolean then v_cost := round(v_cost / 2.0); end if;
  end if;

  if v_exec is null or (v_exec->>'success')::boolean then
    v_crit := floor(random() * 20) = 19;
    for e in select value from jsonb_array_elements(v_effects) loop
      v_recipient := case e->>'target' when 'enemy' then p_target_participant_id when 'self' then p_actor_participant_id else v_ally end;
      v_rec := public.combat_participant_base(v_recipient);
      v_reaction := null;
      v_mark := null;
      v_secondary := '[]'::jsonb;

      -- Fase 5: procura uma marca de outro elemento, posta pela mesma equipe, que reaja com este efeito.
      if coalesce((e->>'appliesElement')::boolean, false) and not (v_recipient = any(v_reacted)) then
        select m.* into v_mark
          from battle_effects m join battle_participants sp on sp.id = m.source_participant_id
         where m.target_participant_id = v_recipient and m.kind = 'marca'
           and m.element <> e->>'element' and sp.side = v_actor->>'side'
           and public.combat_reaction(m.element, e->>'element') is not null
           and public.combat_reaction_fits(public.combat_reaction(m.element, e->>'element'), e->>'kind')
         order by m.updated_at, m.id
         limit 1
         for update of m;
        if v_mark.id is not null then
          v_reaction := public.combat_reaction(v_mark.element, e->>'element');
          v_reacted := v_reacted || v_recipient;
          delete from battle_effects where id = v_mark.id;
        end if;
      end if;

      if e->>'kind' in ('dano','cura','escudo') then
        v_scaler := public.combat_effective_attr(p_actor_participant_id, e->>'scaler');
        v_n := least(200, v_scaler * 10);
        v_raw := (v_cfg_inc * v_level + public.combat_roll_sum(v_n, v_cfg_die)) * (case when v_crit then 2 else 1 end);
      end if;

      if e->>'kind' = 'dano' then
        v_raw := round(v_raw * (case when p_ponto_vital then 2 else 1 end) * v_dano_mult);
        if v_reaction in ('vaporizacao','derretimento') then v_raw := round(v_raw * 1.5); end if;
        v_item := public.combat_apply_damage(v_recipient, v_raw) || jsonb_build_object('scaler', e->>'scaler');

      elsif e->>'kind' = 'cura' then
        if v_reaction = 'germinacao' then v_raw := round(v_raw * 1.5); end if;
        v_gain := greatest(0, least((v_rec->>'hp_max')::int, (v_rec->>'hp')::int + v_raw) - (v_rec->>'hp')::int);
        if v_rec->>'kind' = 'character' then
          update characters set hp_current = least(500 + resistance*150 + level*10, hp_current + v_raw) where id = (v_rec->>'ref')::uuid;
        else
          update enemy_instances set hp_current = least((v_rec->>'hp_max')::int, hp_current + v_raw) where id = (v_rec->>'ref')::uuid;
        end if;
        v_item := jsonb_build_object('kind','cura','target',v_recipient,'target_name',v_rec->>'name','scaler',e->>'scaler',
          'raw',v_raw,'healed',v_gain,'hp_after',(v_rec->>'hp')::int + v_gain,'hp_max',(v_rec->>'hp_max')::int);

      elsif e->>'kind' = 'escudo' then
        insert into battle_effects(battle_session_id, target_participant_id, source_participant_id, ability_id, kind, attribute, amount)
          values (v_battle.id, v_recipient, p_actor_participant_id, p_ability_id, 'barreira', '', greatest(1, v_raw))
          on conflict (target_participant_id, kind, attribute, (coalesce(element, ''))) do update
            set amount = greatest(battle_effects.amount, excluded.amount),
                source_participant_id = case when excluded.amount > battle_effects.amount then excluded.source_participant_id else battle_effects.source_participant_id end,
                ability_id = case when excluded.amount > battle_effects.amount then excluded.ability_id else battle_effects.ability_id end,
                updated_at = now();
        v_item := jsonb_build_object('kind','escudo','target',v_recipient,'target_name',v_rec->>'name','scaler',e->>'scaler','raw',v_raw,
          'barrier',(select amount from battle_effects where target_participant_id = v_recipient and kind = 'barreira'));

      else -- buff / debuff
        insert into battle_effects(battle_session_id, target_participant_id, source_participant_id, ability_id, kind, attribute, amount, remaining_turns, skip_next_tick)
          values (v_battle.id, v_recipient, p_actor_participant_id, p_ability_id, e->>'kind', e->>'attribute', (e->>'amount')::int, (e->>'duration')::int,
                  v_recipient = p_actor_participant_id)
          on conflict (target_participant_id, kind, attribute, (coalesce(element, ''))) do update
            set amount = greatest(battle_effects.amount, excluded.amount),
                remaining_turns = greatest(battle_effects.remaining_turns, excluded.remaining_turns),
                skip_next_tick = battle_effects.skip_next_tick or excluded.skip_next_tick,
                source_participant_id = excluded.source_participant_id, ability_id = excluded.ability_id,
                label = null, updated_at = now();
        v_item := jsonb_build_object('kind',e->>'kind','target',v_recipient,'target_name',v_rec->>'name',
          'attribute',e->>'attribute','amount',(e->>'amount')::int,'duration',(e->>'duration')::int);
      end if;

      -- Consequências da reação.
      if v_reaction = 'congelamento' then
        insert into battle_effects(battle_session_id, target_participant_id, source_participant_id, ability_id, kind, attribute, amount, remaining_turns, label)
          values (v_battle.id, v_recipient, p_actor_participant_id, p_ability_id, 'debuff', 'agility', 3, 1, 'Congelado')
          on conflict (target_participant_id, kind, attribute, (coalesce(element, ''))) do update
            set amount = greatest(battle_effects.amount, excluded.amount),
                remaining_turns = greatest(battle_effects.remaining_turns, excluded.remaining_turns),
                label = 'Congelado', updated_at = now();
      elsif v_reaction = 'conducao' then
        for v_sec in
          select m2.id as mark_id, m2.target_participant_id as pid
            from battle_effects m2
            join battle_participants sp on sp.id = m2.source_participant_id
            join battle_participants tp on tp.id = m2.target_participant_id
           where m2.battle_session_id = v_battle.id and m2.kind = 'marca' and m2.element = 'Marine'
             and sp.side = v_actor->>'side' and tp.side = v_rec->>'side' and m2.target_participant_id <> v_recipient
             and (public.combat_participant_base(m2.target_participant_id)->>'hp')::int > 0
           order by tp.initiative_total desc, tp.name collate "C", tp.id
           limit 2
        loop
          delete from battle_effects where id = v_sec.mark_id;
          v_secondary := v_secondary || public.combat_apply_damage(v_sec.pid, round(v_raw * 0.5)::int);
        end loop;
      elsif v_reaction = 'alastramento' then
        for v_sec in
          select tp.id as pid from battle_participants tp
           where tp.battle_session_id = v_battle.id and tp.side = v_rec->>'side' and tp.id <> v_recipient
             and (public.combat_participant_base(tp.id)->>'hp')::int > 0
           order by tp.initiative_total desc, tp.name collate "C", tp.id
           limit 2
        loop
          v_secondary := v_secondary || public.combat_apply_damage(v_sec.pid, round(v_raw * 0.25)::int);
        end loop;
      end if;

      if v_reaction is not null then
        v_item := v_item || jsonb_build_object('reaction', jsonb_build_object(
          'name', v_reaction, 'consumed', v_mark.element, 'element', e->>'element', 'secondary', v_secondary));
      elsif coalesce((e->>'appliesElement')::boolean, false) then
        -- Fase 4: deixa a marca do elemento no destinatário.
        insert into battle_effects(battle_session_id, target_participant_id, source_participant_id, ability_id, kind, attribute, amount, remaining_turns, skip_next_tick, element)
          values (v_battle.id, v_recipient, p_actor_participant_id, p_ability_id, 'marca', '', 1, (e->>'duration')::int,
                  v_recipient = p_actor_participant_id, e->>'element')
          on conflict (target_participant_id, kind, attribute, (coalesce(element, ''))) do update
            set remaining_turns = greatest(battle_effects.remaining_turns, excluded.remaining_turns),
                skip_next_tick = battle_effects.skip_next_tick or excluded.skip_next_tick,
                source_participant_id = excluded.source_participant_id, ability_id = excluded.ability_id, updated_at = now();
        v_item := v_item || jsonb_build_object('mark', e->>'element', 'mark_turns', (e->>'duration')::int);
      end if;

      v_out := v_out || v_item;
    end loop;

    insert into battle_ability_cooldowns(battle_session_id, participant_id, ability_id, last_used_round)
      values (v_battle.id, p_actor_participant_id, p_ability_id, v_battle.round_number)
      on conflict (participant_id, ability_id) do update set last_used_round = excluded.last_used_round;
  end if;

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

-- ---------- Turno: expiração também informa elemento e rótulo ----------
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

  with expired as (
    delete from battle_effects
     where target_participant_id = v_current and remaining_turns = 1 and not skip_next_tick
     returning kind, attribute, element, label
  ) select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'attribute',attribute,'element',element,'label',label)), '[]'::jsonb)
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
revoke all on function public.combat_apply_damage(uuid,int) from public, anon, authenticated;

commit;
