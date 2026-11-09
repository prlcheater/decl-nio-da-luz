# Roadmap — Declínio da Luz

## Prioridade atual — Beta 1.1

**Acompanhamento:** [checklist das seis fases](BETA-1.1-FASES.md). Fase 1 implementada localmente; migração e publicação pendentes. Próxima: fase 2, buffs/debuffs e barreiras.

O plano ativo é [Beta 1.1 — Reestruturação do combate e criação de habilidades](BETA-1.1-COMBATE.md), consolidado em 08/11/2026. Ele detalha o criador estruturado, alvos sem fogo amigo, atributos, teste de Intelecto, estados e os 36 pares do CSV. As etapas sobrepostas abaixo passam a ser orientadas por esse plano; itens fora do combate continuam preservados. O plano ainda não representa implementação.

O que vamos fazer, em que ordem e com quais ferramentas. O que já existe e as regras valendo estão em [MEMORIA.md](MEMORIA.md).

**Atenção:** push na `main` vai ao ar na hora. Mudanças de regra e de banco passam por branch/teste antes. Patches SQL precisam ser executados manualmente no Supabase.

Legenda: `[ ]` a fazer · `[~]` em andamento · `[x]` feito · **(Paulo)** depende de decisão do Paulo.

---

## Visão em uma linha

Primeiro tornar o que existe **confiável e coerente** (regras, combate atômico, testes); depois **legível** (UX do modo simples, mobile); só então **mais profundo** (estados → reações → combos → cooperação) e, por fim, **mais amplo** (Livro completo, arena).

---

## Fase 0 — Fundação técnica (rápido, sem mudar regra)

Objetivo: poder mudar o motor com segurança.

- [ ] Restaurar lint: criar `eslint.config.js` com `typescript-eslint` + `eslint-plugin-react-hooks`.
- [ ] Testes do `diceEngine.ts` com **Vitest**: limites de dados, arredondamento, crítico, ponto vital, mitigação, extremos de traço.
- [ ] RNG injetável no motor (hoje usa `Math.random`) para testes e simulações reproduzíveis.
- [ ] Limitar quantidade de dados na rolagem livre (evita travar a página).
- [ ] Code splitting por rota (`React.lazy`) para reduzir o bundle de 1,3 MB.
- [ ] `npm audit` e atualização de dependências.
- [ ] Corrigir referências quebradas em comentários (`roadmap-sistema-rpg.md`, `docs/CONTEXTO-PROJETO.md`).

## Fase 1 — Regras oficiais (Paulo)

Objetivo: manual, Codex e código dizem a mesma coisa.

- [ ] Inventário: regra do manual × regra implementada × motivo da adaptação.
- [ ] Simulador de números (script com o motor + RNG semeado): dano médio, variância, duração esperada de encontros por nível.
- [ ] Centralizar parâmetros (tiers, custos, fórmulas) num catálogo tipado; motor e Codex leem do mesmo lugar.
- [ ] Codex gera as tabelas de regra a partir desse catálogo.
- [ ] Corrigir textos: ano da trama, chamada "Crie sua ficha" da Home.

Decisões **(Paulo)** desta fase:
1. Degraus de dados de teste: 3/6 (manual) ou 4/8 (código)? Faixa de 10–11 pontos.
2. Escudo vira barreira separada do PV?
3. Regeneração de PE por turno entra?
4. Orçamento de ações por turno.
5. Ponto vital: custo/teste? vale para cura?
6. Acerto/esquiva existem?
7. Personagem a 0 PV: pula turno, cai, morre?

## Fase 2 — Combate confiável

Objetivo: nenhuma ação parcial, duplicada ou forjada.

- [ ] Resolução da ação em **uma função no servidor** (RPC Postgres ou Edge Function): valida turno, autoria, recursos e alvo; rola; aplica efeito, PE, recarga e log numa transação.
- [ ] Identificador único por ação (idempotência contra clique duplo e reconexão).
- [ ] Log de combate persistido (autor, alvo, valores antes/depois, regra aplicada) e correção pelo mestre sem apagar histórico.
- [ ] Pular participante a 0 PV; marcar inimigo derrotado.
- [ ] Jogador encerra o próprio turno.
- [ ] Realtime granular (atualizar só a linha alterada, não refazer todas as consultas).
- [ ] `startBattle` com erro visível e rollback; permitir o mesmo inimigo várias vezes; limpar instâncias ao encerrar; remover botão "instanciar".
- [ ] Criação de conta + perfil + ficha numa Edge Function (fecha cadastro público e cadastro pela metade).

## Fase 3 — Modo simples aprimorado (UX)

Objetivo: o jogador entende o que fez e por quê.

- [ ] Fluxo curto: habilidade → alvo → prévia (custo, faixa de resultado) → confirmar → resultado.
- [ ] "Ver cálculo": dano bruto → crítico/vital → mitigação → barreira → PV perdido.
- [ ] Motivo de ação indisponível ("falta 40 PE", "recarga: 2 rodadas").
- [ ] Iniciativa e PV de todos visíveis no celular e fora do próprio turno.
- [ ] Toasts de erro/reconexão; nunca anunciar sucesso antes da confirmação.
- [ ] Animações rápidas, velocidade configurável, respeito a "reduzir movimento" em todos os componentes; sons opcionais.
- [ ] Revisão mobile da ficha; PV/PE atuais acompanham novo máximo.
- [ ] Home: frase de entrada clara, guia "como entrar na campanha", encurtar a espera de 3,7 s em visitas recorrentes.
- [ ] Retratos no Supabase Storage com compressão (sai do data URL).

## Fase 4 — Estados (buffs/debuffs)

- [ ] Modelo de efeito: definição, origem, alvo, intensidade, acúmulos, duração, gatilho, expiração, regra de reaplicação.
- [ ] Valores efetivos calculados sobre atributos base preservados.
- [ ] Primeiro lote pequeno **(Paulo)**: ex. Barreira, Queimadura, Resfriamento → Congelamento, Condutividade.
- [ ] Ícone + nome + duração na UI (não só cor).
- [ ] Ordem de resolução fixada e testada.

## Fase 5 — Reações elementais

- [ ] Catálogo de receitas: gatilho (estado + elemento + comportamento), consumo, prioridade, efeito, limite.
- [ ] Primeiro lote **(Paulo)**: Molhado + Élix (Condução), Molhado + Glácis (gelo), Resfriado + Ignis (choque térmico).
- [ ] Máximo de uma reação derivada por resolução; sem ciclos.

## Fase 6 — Modo de combos

- [ ] Dados de decisão (poucos, ex. 3d6) persistidos ao revelar — F5 não rerrola.
- [ ] Bandeja de dados: alocar em módulos preparar/transformar/finalizar; desfazer antes de confirmar; teclado e toque além de arrastar.
- [ ] Orçamento único de potência por ação; custo equivalente ao modo simples.
- [ ] Identidade por classe na manipulação de dados (Velocista, Sentinela, Marionetista, Suporte, Arcano) **(Paulo)**.
- [ ] Modo escolhido por jogador, habilitado por campanha; testar em encontros separados primeiro.
- [ ] Tutorial curto e simulador de treino.

## Fase 7 — Cooperação e expansão

- [ ] Combos entre aliados usando preparações persistentes.
- [ ] Laboratório de habilidades do mestre (composição estruturada + prévia; nada de fórmula livre executada como código).
- [ ] Ideias autorais: sobrecarga elemental, telemetria dos Vigias, objetivos de combate, assinatura energética.
- [ ] NPC aliado sem login.
- [ ] Sistema Cardinal (Cifras) **(Paulo)**.

## Trilha paralela — Conteúdo

- [ ] **Livro**: leitura de capítulos de `book_chapters` em Markdown, por temporada; editor simples para o mestre publicar. Começar com 1 capítulo ou resumo da T1.
- [ ] Codex lendo `lore_entries`/glossário do banco (opcional).
- [ ] Upload de arte de item (Storage).

## Trilha posterior — Arena

- [ ] Mapa com fundo, tokens arrastáveis e desenho, sincronizado por Realtime (`battle_tokens`, `battle_strokes`). Só depois das fases 2–3.

---

## Bibliotecas que ajudam

Versões a confirmar na instalação. Preferir poucas dependências; cada uma resolve um item concreto acima.

| Fase | Biblioteca | Para quê | Observação |
|---|---|---|---|
| 0 | `vitest` | Testes do motor | Integra nativo com Vite; zero config |
| 0 | `fast-check` | Testes de propriedade (ex.: "dano nunca negativo", "nunca mais de 200 dados") | Ótimo para regras com muitos extremos |
| 0 | `typescript-eslint` + `eslint-plugin-react-hooks` | Restaurar o lint | Config flat em `eslint.config.js` |
| 0–1 | `pure-rand` (ou `seedrandom`) | RNG semeado e injetável | Simulações reproduzíveis; mesmo seed = mesma luta |
| 1 | `zod` | Validar catálogos de regras, habilidades, estados e reações | Tipos TS derivados do schema; reaproveitável na Edge Function |
| 1 | `@dice-roller/rpg-dice-roller` | Notação de dados completa (`kh`, `dl`, explosão, rerrolagem) com resultado detalhado | Opcional: só se o parser próprio ficar limitado |
| 1 | `recharts` | Gráficos do simulador (distribuição de dano por nível) | Pode ficar fora do bundle público (rota do mestre) |
| 2 | Supabase Edge Functions (Deno) ou RPC `plpgsql` | Resolução autoritativa e criação de contas | Motor TS puro roda na Edge Function sem reescrever |
| 2–3 | `@tanstack/react-query` | Cache, estados de carregando/erro e invalidação granular via Realtime | Resolve "recarga completa no combate" |
| 2 | `xstate` | Máquina de estados do turno/ação (intenção → prévia → confirmar → resolvido) | Torna o fluxo de combos verificável; adotar quando os combos começarem |
| 3 | `sonner` | Toasts de erro, reconexão e confirmação | Leve, acessível |
| 3 | `browser-image-compression` | Comprimir retrato antes do Storage | Junto da migração do data URL |
| 4–6 | `@dnd-kit/core` | Bandeja de dados arrastável | Suporte a teclado e toque — atende o requisito "arrastar é opção" |
| 6 | `@3d-dice/dice-box` | Dados 3D opcionais para momentos de revelação | Só cosmético; desligável e respeitando "reduzir movimento" |
| Livro | `react-markdown` + `remark-gfm` | Renderizar capítulos | Capítulos guardados como Markdown no banco |
| Arena | `konva` + `react-konva` | Canvas com tokens e desenho | Alternativa mais pesada: `pixi.js` |

Já instaladas e suficientes: `motion` e `gsap` (animação de números e resultados), `lucide-react` (ícones de estados), `three` (fundo).

---

## Critérios de sucesso

- Jogador consegue explicar o que fez, por que funcionou e o que faria diferente.
- Nenhum gasto ou efeito duplicado em repetição, F5 ou reconexão.
- Manual, Codex e motor concordam (tabelas geradas da mesma fonte).
- Medir em sessão: tempo de turno, cliques, erros e pedidos de ajuda.
