# Memória do Projeto — Declínio da Luz

Fonte única sobre **o que o projeto é, o que existe hoje, quais regras valem e o que já aconteceu**.
O que ainda vamos fazer fica em [ROADMAP.md](ROADMAP.md). Configuração e deploy ficam no [README](../README.md).

> Consolida os antigos `docs/CONTEXTO-PROJETO.md`, `docs/PARECER-PROJETO.md`, `notas.md`, `próximos passos.md` e `updates.md` (06/11/2026).
> Regra de manutenção: ao implementar algo, atualize a seção "Estado atual" e acrescente uma entrada no "Histórico". Ao decidir uma regra, mova-a de "Decisões abertas" (no roadmap) para "Regras oficiais".

---

## 1. Visão geral

Site/app oficial do RPG de mesa **Declínio da Luz**, criado e mestrado por Paulo (**prlcheater**). O universo gira em torno dos **Vigias Elementalistas**. A Temporada 1 foi concluída (9 meses de mesa, sessões no Discord); a Temporada 2 está em andamento com os jogadores atuais.

Duas frentes:

1. **Pública** — lore (Home + Codex) e leitura do Livro por temporada.
2. **Logada** — ficha interativa, criação de ficha, painel do mestre e combate por turnos em tempo real.

Estética: **RPG futurista**, escuro, luminoso e animado (componentes React Bits copiados para `src/components`, customizáveis).

### Stack

| Camada | Tecnologia |
|---|---|
| Front | React 18 + Vite 5 + TypeScript + Tailwind 3 |
| Animação | GSAP + Lenis, Motion, Three.js + postprocessing, React Bits |
| Back | Supabase (Postgres + Auth + RLS + Realtime) |
| Deploy | Vercel (push na `main` publica na hora) + Supabase Cloud |

### Arquivos-chave

| Arquivo | Papel |
|---|---|
| `src/lib/diceEngine.ts` | Motor puro de dados e dano (sem React/Supabase) |
| `src/lib/gameData.ts` | Elementos, classes e roadmap do Expresso Astral (conteúdo fixo) |
| `src/pages/player/Combate.tsx` | Combate (~1.200 linhas) |
| `src/pages/player/MinhaFicha.tsx` | Ficha (~1.300 linhas) |
| `supabase/01_schema.sql` … `07_seed.sql` (índice em `00_LEIA-ME.md`) | Banco, RLS, funções e dados fixos |
| `docs/MANUAL DECLÍNIO.docx` | Manual de regras e lore escrito por Paulo |

---

## 2. Universo (resumo)

- A humanidade alcança uma **Era Dourada** de expansão pelo sistema solar.
- **Catástrofe de Pandora (2222)**: colapso, corrupção e **Matéria Negra**. Duzentos anos de recuo até a consolidação da **Última Cidade** — que volta a ficar instável.
- Pessoas com afinidade natural passam a controlar elementos, mediados por tecnologia: os **elementalistas**.
- **Nove elementos** (Aura é restrito) e **cinco classes**. Classe e elemento são eixos independentes de identidade.
- **Expresso Astral (T1)**: o grupo percorre o sistema solar até encontrar **O Observador**, entidade consciente movida pela corrupção, e o derrota. Ao voltar, os heróis são **caçados pela própria humanidade**. O motivo é o gatilho da T2 e **é um mistério que o site não deve resolver**.

### Roadmap do Expresso Astral (T1)

| # | Local | Antagonista / conflito |
|---|---|---|
| 1 | Terra | Rainha Bruxa Necrófoga **Nirlith** |
| 2 | Vênus | **Kayatl** e **Zephyra**, filhas do imperador profano |
| 3 | Lua | **Caronte**, experimento fractal/humano corrompido |
| 4 | Marte | **Dravarthum**, profano ancestral, em seu Mundo Trono |
| 5 | Saturno | O Imperador Profano e a **Mente Bélica** |
| 6 | Urano | **Maxmilian Gold** e o **Mundo dos Sonhos** |
| 7 | Europa | Luta final contra **O Observador** |

Conteúdo narrativo completo vem do manual de Paulo. Novas ideias não estabelecem fatos de lore sem ele.

---

## 3. Estado atual do app

| Área | Situação |
|---|---|
| Home | Pronta: hero animado, universo, temporadas, 9 elementos, 5 classes, roadmap do Expresso Astral, teaser do Livro, CTA |
| Codex | Pronto: abas Visão Geral, Elementos, Classes, Sistema e Ficha. Conteúdo fixo no código (não lê `lore_entries`/`story_arcs`) |
| Livro | **Só "Em breve"**. Tabela `book_chapters` existe, sem uso |
| Login | Nome do Elementalista + PIN de 4 dígitos. Sem cadastro público, sem Discord OAuth. Mestre vai ao painel; jogador vai à ficha |
| Ficha | Pronta (detalhes abaixo) |
| Criar Ficha | Só o mestre; cria login + ficha juntos |
| Inimigos | Cadastro por tier (Comum, Elite, Boss) com traços, habilidades e elemento |
| Combate | Iniciativa, turnos, alvos, energia, recarga, mitigação e números flutuantes em tempo real |
| Upload de item | Não implementado (itens têm nome e raridade, sem imagem) |
| Mapa de batalha | Não implementado |
| Testes / lint | `npm run lint` e `npm test` (Vitest) funcionam; cobertura inicial do motor `diceEngine` |

### Login e contas

- Nome vira e-mail fictício (`nome-sem-acento@example.com`); PIN vira senha com sufixo `-vigia-declinio`.
- Roles: **player** e **mestre**. Mestre cria, edita e remove qualquer ficha; player vê a própria e ajusta só PV/PE atuais (imposto pelo banco).
- Excluir uma ficha exclui o login do jogador (não o de um mestre).
- Logado, o menu mostra o nome do elementalista no lugar de "Área do Player".

### Ficha

Identidade (nome, título, retrato "Vulto" com recorte), nível com barra de XP visual, ícones de elemento e classe, Créditos e Cifras, PV e PE (máximo por fórmula, atual ajustável), traços (Ataque, Resistência, Agilidade, Intelecto, Carisma), habilidades (tier Comum/Especial/Suprema, efeito Dano/Cura/Escudo, botão de usar), dados (testes por dificuldade, rolagem livre `2d20kh1+3`, histórico), perícias passivas, equipamento (Armadura, Item de Classe, Arma), Bolsa.

Raridades: **Regular** (cinza), **Raro** (azul médio), **Lendário** (roxo), **Exótico** (dourado).

### Visual

Partículas Three.js no fundo, scroll suave (desligado com "reduzir movimento"), cards com borda que brilha no cursor, textos com gradiente animado, revelação letra a letra, seções com fade no scroll.

---

## 4. Regras oficiais (confirmadas)

- Uma ficha ativa por jogador (garantido pelo banco); ficha antiga é arquivada, não apagada.
- Nível máximo **125**. Máximo de **10** pontos base por traço.
- Elementos e classes são listas fixas (`07_seed.sql`).
- PV/PE atuais: jogador e mestre editam. Máximos saem de fórmula; só o mestre altera nível e traços.
- **Sistema Cardinal** (Cifras evoluem habilidades): só o campo existe; regras a definir.
- **Direção de Paulo (04/11/2026):** as diferenças entre código e manual **não significam que o código está errado** — Paulo adaptou a matemática de propósito. Alinhar significa avaliar as adaptações e atualizar a referência oficial, não restaurar o DOCX automaticamente.

### Matemática implementada hoje (`diceEngine.ts`)

| Parte | Comportamento |
|---|---|
| Dados de teste | `min(6, floor(traço/4) + 1)` d20; dificuldade soma/remove dados e aplica modificador (mínimo 1 dado; favorável pode passar de 6) |
| Resultado do teste | Maior d20 + traço + modificador |
| Dados de habilidade | `min(200, traço escalador × 10)` |
| Comum | d2, +3 × nível da habilidade, custo 10% do PE máx., recarga 0 |
| Especial | d4, +15 × nível, custo 25%, recarga 1 rodada |
| Suprema | d8, +75 × nível, custo 50%, recarga 3 rodadas |
| Crítico | d20 separado; 20 dobra o resultado |
| Ponto vital | Dobra o resultado; acumula com crítico; é uma caixa de seleção sem custo |
| Mitigação | Soma de d10 (conjunto de Resistência) + Resistência |
| PV máx. | 500 + Resistência × 150 + nível × 10 |
| PE máx. | 300 + Intelecto × 100 + nível × 8 |
| Iniciativa | 1d20 + nível |
| Regeneração | 15% do PE máx. existe como função, **não é aplicada** em combate |

Observação: muitos dados somados ficam estáveis. 100d2+3 tem média 153 e desvio de só 5 — a variação real vem dos multiplicadores (crítico, ponto vital). Animar mais dados não cria mais decisão.

---

## 5. Problemas conhecidos (encontrados lendo o código, não reproduzidos em partida)

**Divergências de regra/texto**
- Codex/manual: 2d20 com 3 pontos e 3d20 com 6. Código: 4 e 8. Manual não cobre 10–11 pontos.
- Ano da trama: contexto antigo diz 2422; Home diz 2446.
- Home diz "Crie sua ficha", mas só o mestre cria.
- Comentários em `diceEngine.ts` e `schema.sql` citam `roadmap-sistema-rpg.md`, que não existe; `gameData.ts` cita `docs/CONTEXTO-PROJETO.md` (agora consolidado aqui).

**Combate**
- Ações por turno sem limite (só PE e recarga limitam).
- Habilidades sempre acertam; não há esquiva.
- Escudo é cura limitada ao PV máximo (inútil com vida cheia).
- Ponto vital sem custo e válido também para cura/escudo.
- Turno não pula quem tem 0 PV; inimigo não é marcado derrotado.
- Só o mestre passa turno; jogador fora do turno não vê PV dos participantes.
- Cada ficha de inimigo só entra uma vez por combate; instâncias criadas ficam listadas depois da luta; botão "instanciar" do Painel de Inimigos é inútil.
- `startBattle` falha em silêncio (luta ativa e vazia).
- Efeito, custo de PE e recarga são gravados separadamente (ação parcial em caso de falha).
- **Resultados calculados no navegador**: `combat_apply_hp` recebe `p_hp_max` do front; o banco valida autoria e combate, mas não valor nem turno.
- Coluna de iniciativa oculta no celular.

**Fichas e contas**
- Criação em etapas (login, perfil, ficha) pode deixar cadastro incompleto.
- Sem `07_seed.sql`, ficha é salva sem classe/elemento e sem aviso.
- PV/PE atuais não acompanham novo máximo ao mudar traços.
- Não existe NPC aliado (toda ficha aliada exige login).
- Jogador sem ficha cai numa tela sem orientação.

**Segurança**
- Cadastro aberto via chave anon (vira no máximo `player`). Fechar exige Edge Function.
- PIN de 4 dígitos (10.000 combinações); sufixo da senha é público.
- Rolagem livre não limita a quantidade de dados (pode travar a página).

**Desempenho e qualidade**
- Retrato salvo como data URL em `portrait_url`, trafegando em toda consulta.
- Qualquer mudança em `characters`/`enemy_instances` recarrega tudo no combate para todos.
- Bundle JS único de ~1,3 MB; Home espera ~3,7 s para liberar as revelações.
- `npm audit`: 8 vulnerabilidades (4 moderadas, 4 altas) na última checagem.

---

## 6. Pareceres e direção de produto

### Parecer inicial (04/11/2026, Codex)

Projeto com público claro, gancho narrativo forte (vencer a ameaça externa não resolve a relação com a humanidade — preservar o mistério) e ferramentas úteis à mesa. Ganho seguinte: **coerência e confiabilidade** antes de ampliar. Ordem sugerida: regras oficiais → sessão completa validada → entrada para novos jogadores e Livro → mobile, lint e testes → mapa.

Sugestão editorial para a Home: *"Um RPG de mesa de ficção científica em que Vigias Elementalistas enfrentam a corrupção do sistema solar e as consequências das próprias escolhas."*

### Direção de evolução (04/11/2026, conversa com Paulo)

**Princípio:** automatizar a contabilidade e tornar visíveis as escolhas. O jogador decide intenção, risco, alvo e combinação; o app conta recursos, aplica regras e explica o resultado. Mais cliques não resolvem repetição; mais decisões relevantes sim.

Metas:
- **Modo simples**: a facilidade atual, com resultado mais legível ("ver cálculo").
- **Modo de combos**: poucos dados de decisão alocados em módulos (preparar → transformar → finalizar), sem liberar várias habilidades pelo preço de uma.
- Habilidades como **composição de comportamentos**: identidade + elemento + entrega + escalamento + comportamentos + condições + custo + restrições.
- **Estados** (lentidão, veneno, corrosão, resfriamento/congelamento, condutividade, queimadura, foco, barreira, interferência), com origem, duração, acúmulo e regra de reaplicação explícita. Atributos base preservados; valores efetivos calculados (inspiração: Active Effects do Foundry VTT).
- **Reações elementais** por *estado presente + elemento recebido + comportamento*, ex.: Molhado + Élix = Condução; Resfriado + Ignis = Choque térmico. Poucas reações, consumo explícito, no máximo uma reação derivada por resolução no início.
- Referências: Dicey Dungeons (identidade por manipulação de dados — ex.: cada classe manipula dados de um jeito), Foundry VTT (efeitos rastreáveis), Lancer/COMP-CON (laboratório de habilidades).
- Ideias autorais para depois: sobrecarga elemental, dissipação térmica, interferência, telemetria dos Vigias, assinatura energética, objetivos de combate, simulador de treino.

Tudo acima é **hipótese de protótipo**; nenhum número vira regra sem Paulo e teste de mesa.

---

## 7. Histórico

### 06/11/2026 — Organização da documentação
- Documentação consolidada em `MEMORIA.md` (este arquivo) e `ROADMAP.md`.

### 04/11/2026 — Direção de evolução
- Registrada a direção de produto para regras, combos, estados, reações e UX (ex-`updates.md`).
- Removidos os botões de criar ficha da Área do Mestre; correção de corte de letras em textos com gradiente.

### 04/11/2026 — Login
- Depois do login, mestre vai ao painel e jogador à ficha (substitui a decisão de 16/08).

### 04/11/2026 — Segurança, combate e telas
Requer `supabase/02_seguranca-e-combate.sql`.
- Segurança: conta não se promove mais a mestre; jogador só altera PV/PE atuais pela API; excluir ficha de mestre não apaga o login.
- Combate: jogador enxerga os participantes; PV ajustado no banco (golpes simultâneos não se sobrescrevem); falha no efeito aborta antes de gastar PE/recarga; tabelas no Realtime.
- Telas: fim das telas em branco (sem perfil, banco fora, ficha de inimigo); login distingue PIN errado de servidor fora; aviso de alteração não salva; PV/PE por teclado salvos; nível limitado a 125; confirmação ao excluir inimigo.
- Projeto: `README.md`, `07_seed.sql` e `vercel.json`.

### 16/08/2026
- Login e F5 levavam à Home (revertido em 04/11).
- Menu mostra "Seja bem-vindo, {nome}".
- Ícones de elemento/classe maiores; nível +2px.
- Raridades corrigidas: Regular, Raro, Lendário, Exótico.

### Antes
- Rolagem de dados no estilo Rollem Rocks (Discord), cálculo automático de dano e combate por turnos em tempo real sem mapa.


## Direção aprovada — Beta 1.1 (08/11/2026)

Planejamento registrado no documento Beta 1.1 (arquivado no histórico do Git), sem alteração de código ou banco nesta rodada. Paulo aprovou criação por campos estruturados, habilidades compostas, atributo escalador separado do atributo modificado, ausência de fogo amigo e movimentação ativa somente própria. Intelecto deve participar da execução da maioria das habilidades energéticas; Carisma pode escalar habilidades e receber modificadores. Reações devem acrescentar benefícios à estratégia, sem cancelamentos.

O CSV original de reações foi substituído pelo catálogo em `src/lib/reactions.ts`; conflitos com a orientação verbal e adaptações estão explícitos no plano. Valores, dificuldades, durações e regras de resistência ainda exigem calibração. Estas diretrizes de evolução não substituem a descrição do motor atualmente implementado.


### 08/11/2026 — Beta 1.1, fase 1 implementada localmente

Criador compartilhado com escalador configurável, definição estruturada e rascunhos bloqueados na UI. Habilidades antigas preservadas. Patch SQL preparado, ainda não aplicado nesta sessão. Banco real/publicação pendentes. Próxima etapa: buffs, debuffs e barreiras.

### 09/11/2026 — Beta 1.1, fases 2 e 3 implementadas localmente

Buffs, debuffs e barreira (escudo deixou de curar) com atributos efetivos e expiração por turno do alvo. Ação de habilidade e passagem de turno resolvidas no servidor numa transação, com log persistido e idempotência. Rascunhos antigos exigem habilitação explícita do mestre. Patch `05_combate-servidor.sql` testado em Postgres local, ainda não aplicado no Supabase. Regras provisórias e checklist de publicação da época ficaram arquivados no histórico do Git.

### 10/11/2026 — Beta 1.1, fases 4 e 5 implementadas localmente

Marcas elementais com origem e duração, e o primeiro lote de reações: Vaporização, Derretimento, Congelamento, Condução, Alastramento e Germinação. Os valores são provisórios. Patch `06_elementos-e-reacoes.sql` testado em Postgres local, ainda não aplicado no Supabase (ordem: 05 → 06 → frontend). Detalhes arquivados no histórico do Git.

### 13/11/2026 — Beta 1.2, rodada 1: limpeza e consolidação

Removidos artefatos que só serviam de orientação: notas de rodada Beta 1.0, fichas de mestre/NPCs, plano Beta 1.1 e checklist de fases, além do CSV original de reações e dos prints locais de `beta-check.local/`. O conteúdo relevante foi consolidado em `MEMORIA.md` e `ROADMAP.md`; o texto original continua acessível no histórico do Git. Roadmap reposicionado para o ciclo Beta 1.2 → 1.4, com o VTT como alvo da 1.4.

### 13/11/2026 — Beta 1.2, rodada 2: scripts SQL numerados

Os scripts do banco passaram a ter prefixo numérico, na ordem de execução: `01_schema.sql`, `02_seguranca-e-combate.sql`, `03_fichas-mestre-npcs.sql`, `04_habilidades-estruturadas.sql`, `05_combate-servidor.sql`, `06_elementos-e-reacoes.sql` e `07_seed.sql`. Criado o índice `supabase/00_LEIA-ME.md` (o que rodar em banco novo e em banco já em uso) e reservados `08_beta-1.3-estados.sql` e `09_beta-1.4-vtt.sql`. Referências atualizadas no `README.md`, no teste `tests/combat-sql.mjs` e nos cabeçalhos dos próprios SQL. Nenhuma mudança de conteúdo no banco: apenas renomeação (o histórico do Git preserva os nomes antigos).

### 13/11/2026 — Beta 1.2, rodada 3: lint, Vitest e RNG injetável

Restaurado o lint com config flat (`eslint.config.js`): `typescript-eslint` + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh`. `npm run lint` volta a funcionar (o wrapper `@typescript-eslint/no-unused-expressions` crasha com a versão de ESLint em uso e ficou desligado; o `tsc` cobre esse caso). Adicionado Vitest (`npm test` / `npm run test:watch`) com a primeira cobertura do motor `src/lib/diceEngine.test.ts` (17 testes: pool, teste de dificuldade, notação de dados, dano/crítico/ponto vital, mitigação, PV/PE, custo de energia, recarga e severidade). O motor ganhou RNG injetável (`setRandomSource`, `resetRandomSource`, `createSeededRandom` — mulberry32) para testes e simulações reproduzíveis, mantendo `Math.random` como padrão.

### 13/11/2026 — Beta 1.2, rodada 4: code splitting, limites e correção do lint/build

`App.tsx` passou a carregar todas as rotas com `React.lazy` + `Suspense` (só a Home fica no bundle inicial). O `vite.config.ts` ganhou `manualChunks` para separar `three`, `gsap`, `motion` e `supabase`, eliminando o aviso de chunk grande (maior chunk agora: `three` ~506 kB; o `index` caiu de ~1.220 kB para ~318 kB). A rolagem livre foi limitada no motor (`FREE_ROLL_MAX_DICE = 200`, `FREE_ROLL_MAX_SIDES = 1000`) com aviso na ficha, e a cobertura subiu para 19 testes. Corrigidos os erros que apareciam nas verificações: o bloco JS/JSX do ESLint não registrava o plugin `react-hooks` (causava "Definition for rule not found" no `TextType.jsx`), removidas duas diretivas `eslint-disable` sem uso (`Combate.tsx`, `PainelInimigos.tsx`) e ajustados comentários que citavam arquivos inexistentes (`roadmap-sistema-rpg.md`, `docs/CONTEXTO-PROJETO.md`). Verificação final: `npm run lint` (exit 0), `npm test` (19/19) e `npm run build` (exit 0).
