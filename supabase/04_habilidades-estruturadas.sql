-- Fase 1 da Beta 1.1. Aplicar após os patches de 04 e 07/11/2026.
-- Aditivo: definições NULL preservam o comportamento de habilidades antigas.
begin;
alter table public.abilities add column if not exists definition jsonb;

create or replace function public.valid_ability_definition(d jsonb)
returns boolean language plpgsql immutable set search_path = public as $$
declare
  e jsonb;
  k text;
  attrs text[] := array['attack','resistance','agility','intellect','charisma'];
  timed boolean;
begin
  if d is null then return true; end if;
  if jsonb_typeof(d) <> 'object' or d->>'version' is distinct from '1'
     or jsonb_typeof(d->'effects') is distinct from 'array' then return false; end if;
  if jsonb_array_length(d->'effects') not between 1 and 8 then return false; end if;
  for e in select value from jsonb_array_elements(d->'effects') loop
    if jsonb_typeof(e) <> 'object' or not (e ?& array['kind','scaler','element','appliesElement','target','attribute','amount','duration','state']) then return false; end if;
    k := e->>'kind';
    if k is null or not (k = any(array['dano','cura','escudo','buff','debuff','controle','purificacao','preparacao','movimento']))
      or e->>'scaler' is null or not (e->>'scaler' = any(attrs)) then return false; end if;
    if e->'element' <> 'null'::jsonb and not (e->>'element' = any(array['Élix','Gaia','Galeo','Glácis','Granite','Ignis','Marine','Umbra','Aura'])) then return false; end if;
    if jsonb_typeof(e->'appliesElement') <> 'boolean' then return false; end if;
    if (e->>'appliesElement')::boolean and e->'element' = 'null'::jsonb then return false; end if;
    if k in ('dano','debuff','controle') then
      if e->>'target' is distinct from 'enemy' then return false; end if;
    elsif k = 'movimento' then
      if e->>'target' is distinct from 'self' then return false; end if;
    elsif e->>'target' is null or e->>'target' not in ('ally','self') then return false;
    end if;
    if d->'effects'->0->>'kind' = 'movimento' and e->>'target' <> 'self' then return false; end if;
    if k in ('buff','debuff') then
      if e->>'attribute' is null or not (e->>'attribute' = any(attrs))
        or jsonb_typeof(e->'amount') <> 'number' then return false; end if;
      if (e->>'amount')::numeric <> trunc((e->>'amount')::numeric) or (e->>'amount')::numeric not between 1 and 10 then return false; end if;
    elsif e->'attribute' <> 'null'::jsonb or e->'amount' <> 'null'::jsonb then return false;
    end if;
    timed := (e->>'appliesElement')::boolean or k in ('buff','debuff','controle','preparacao');
    if timed then
      if jsonb_typeof(e->'duration') <> 'number' then return false; end if;
      if (e->>'duration')::numeric <> trunc((e->>'duration')::numeric) or (e->>'duration')::numeric not between 1 and 20 then return false; end if;
    elsif e->'duration' <> 'null'::jsonb then return false;
    end if;
    if k = 'controle' then
      if e->>'state' is null or e->>'state' not in ('medo','imobilizacao','silencio') then return false; end if;
    elsif k = 'preparacao' then
      if e->>'state' is distinct from 'marca' then return false; end if;
    elsif k = 'purificacao' then
      if e->>'state' is distinct from 'remover_penalidade' then return false; end if;
    elsif e->'state' <> 'null'::jsonb then return false;
    end if;
  end loop;
  return true;
exception when others then return false;
end;
$$;
alter table public.abilities drop constraint if exists abilities_definition_valid;
alter table public.abilities add constraint abilities_definition_valid check (public.valid_ability_definition(definition));

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
  -- O FK valida o destino; qualquer falha desfaz também a criação da habilidade.
  v_kind := p_definition->'effects'->0->>'kind';
  insert into abilities(name, description, type, tipo_efeito, definition)
    values(trim(p_name), nullif(trim(p_description),''), p_tier,
      case when v_kind in ('dano','cura','escudo') then v_kind else 'dano' end, p_definition)
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
commit;
