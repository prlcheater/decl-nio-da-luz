-- ============================================================
-- SEED — classes e elementos
-- ============================================================
-- Rodar depois dos scripts 01 a 06. Pode ser executado mais de uma vez.
-- Sem estes dados, o formulário "Criar Ficha" não oferece classe nem elemento.
-- Os nomes precisam ser iguais aos de src/lib/gameData.ts: é por eles que a ficha
-- encontra o ícone e as cores de cada elemento e classe.

insert into classes (name, description) values
  ('Velocista', 'Assassino especializado em ataques rápidos e eliminação de alvos específicos.'),
  ('Sentinela', 'Tanque defensivo, focado em proteção e resistência.'),
  ('Marionetista', 'Manipulador que controla o campo de batalha e adversários.'),
  ('Suporte', 'Especialista em apoio tático e fortalecimento de aliados.'),
  ('Arcano', 'Mago tecnológico que combina ciência avançada com manipulação elemental.')
on conflict (name) do update set description = excluded.description;

insert into elements (name, color_hex, description) values
  ('Élix', '#8B5CF6', 'O raio. Poder e velocidade elétrica.'),
  ('Gaia', '#22C55E', 'A natureza. Preservação e crescimento.'),
  ('Galeo', '#06B6D4', 'O vento. Liberdade e movimento.'),
  ('Glácis', '#7DD3FC', 'O gelo. Estabilidade e controle.'),
  ('Granite', '#E3C88A', 'A terra. Solidez e resistência.'),
  ('Ignis', '#E34234', 'O fogo. Poder bruto e transformação.'),
  ('Marine', '#3B82F6', 'A água. Fluidez e adaptação.'),
  ('Umbra', '#C0C0C0', 'A escuridão. Mistério e ocultação.'),
  ('Aura', '#D4AF37', 'A luz. Elemento restrito, de potencial supremo, disponível apenas para pouquíssimos usuários.')
on conflict (name) do update set
  color_hex = excluded.color_hex,
  description = excluded.description;
