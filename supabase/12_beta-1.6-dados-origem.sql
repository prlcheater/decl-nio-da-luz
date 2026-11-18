-- ============================================================
-- BETA 1.6 - Central de Dados: autor = ficha e origem
-- ============================================================
-- Aplicar depois de 11. Pode rodar mais de uma vez.

begin;

alter table public.dice_rolls add column if not exists character_name text;
alter table public.dice_rolls add column if not exists source text not null default 'player';
alter table public.dice_rolls add column if not exists enemy_id uuid references public.enemies(id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'dice_rolls_source_ok') then
    alter table public.dice_rolls add constraint dice_rolls_source_ok check (source in ('player','npc','enemy'));
  end if;
end $$;

commit;