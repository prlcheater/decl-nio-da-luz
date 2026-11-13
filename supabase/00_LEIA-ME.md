# Scripts do banco — ordem de execução

Execute **na ordem numérica**. Cada arquivo é autocontido e os patches/seed podem
rodar mais de uma vez (idempotentes). Só o `01_schema.sql` exige banco vazio.

| # | Arquivo | O que faz | Rodar quando |
|---|---|---|---|
| — | `00_LEIA-ME.md` | Este índice | — |
| 01 | `01_schema.sql` | Tabelas, RLS e funções base | **Só em banco vazio** |
| 02 | `02_seguranca-e-combate.sql` | Correções de segurança e de combate | Reaplicável |
| 03 | `03_fichas-mestre-npcs.sql` | Ficha pessoal do mestre e NPCs sem login | Reaplicável |
| 04 | `04_habilidades-estruturadas.sql` | Criador estruturado de habilidades (coluna `definition` + validador) | Reaplicável |
| 05 | `05_combate-servidor.sql` | Buffs/debuffs/barreira, execução no servidor e log idempotente | Reaplicável |
| 06 | `06_elementos-e-reacoes.sql` | Marcas elementais e o primeiro lote de reações | Reaplicável |
| 07 | `07_seed.sql` | Classes e elementos fixos | Reaplicável |
| 08 | `08_beta-1.3-estados.sql` | *(previsto)* Estados/condições — Beta 1.3 | Nova |
| 09 | `09_beta-1.4-vtt.sql` | *(previsto)* Mapa, tokens e desenho — Beta 1.4 (VTT) | Nova |

## Banco novo

`01` → `02` → `03` → `04` → `05` → `06` → `07`.

## Banco que já está em uso

Aplicado até `06` + `07`, normalmente **não rode nada de novo**. Cada beta nova traz
um patch novo (ex.: `08_beta-1.3-estados.sql`) e, nesse caso, **rode só o patch novo**.

> Não reaplique `05_combate-servidor.sql` depois do `06_elementos-e-reacoes.sql`:
> o `05` recolocaria versões antigas das funções de combate que o `06` já substituiu.

Ordem de referência histórica (nomes antigos): `schema.sql`, `patch-2026-11-04-*`,
`patch-2026-11-07-*`, `patch-2026-11-08-*`, `patch-2026-11-09-*`, `patch-2026-11-10-*`, `seed.sql`.
