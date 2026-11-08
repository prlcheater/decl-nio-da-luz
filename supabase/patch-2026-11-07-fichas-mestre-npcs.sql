-- Aplicar após patch-2026-11-04-seguranca-e-combate.sql e antes de publicar o frontend.
-- NPC = ficha sem dono/login. As políticas existentes mantêm a escrita exclusiva do mestre.
begin;

alter table public.characters alter column user_id drop not null;

create or replace function public.delete_character_with_login(p_character_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if not is_mestre() then raise exception 'not authorized'; end if;
  select user_id into v_user_id from characters where id = p_character_id for update;
  if not found then return; end if;

  if v_user_id is null or exists (
    select 1 from profiles where id = v_user_id and role = 'mestre'
  ) then
    delete from characters where id = p_character_id;
  else
    -- Preserva o comportamento existente de exclusão do jogador com seu login.
    delete from auth.users where id = v_user_id;
  end if;
end;
$$;

-- Compatibilidade com clientes antigos: nunca apagar uma conta para liberar um nome.
create or replace function public.free_up_username_if_orphaned(p_username text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_mestre() then raise exception 'not authorized'; end if;
  return not exists (select 1 from profiles where username = p_username);
end;
$$;

revoke all on function public.delete_character_with_login(uuid) from public, anon;
revoke all on function public.free_up_username_if_orphaned(text) from public, anon;
grant execute on function public.delete_character_with_login(uuid) to authenticated;
grant execute on function public.free_up_username_if_orphaned(text) to authenticated;

commit;
