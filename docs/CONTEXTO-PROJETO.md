# Declínio da Luz — App Web do RPG

## Estado atual (04/11/2026)

Este documento nasceu como especificação, então parte dele descreve planos. O que vale hoje:

| Área | Situação |
|---|---|
| Home e Codex | Prontos, com conteúdo fixo em `src/lib/gameData.ts` e nas páginas (não leem `lore_entries` nem `story_arcs`) |
| Livro | Só a tela "Em breve"; a tabela `book_chapters` existe, sem uso |
| Login | Nome do Elementalista + PIN de 4 dígitos; sem Discord OAuth e sem cadastro público; depois de entrar, leva à área do player |
| Ficha | Pronta; PV e PE máximos são calculados por fórmula, e `hp_base`/`ep_base` não são mais usados |
| Criar Ficha | Só o mestre usa; cria login e ficha juntos |
| Upload de item | Não implementado; itens têm nome e raridade, sem imagem |
| Inimigos e Combate | Prontos: cadastro de inimigos, iniciativa, turnos e recarga, em tempo real |
| Mapa de batalha | Não implementado |

Configuração do banco e permissões: ver [README.md](../README.md). Pontos a melhorar: ver [próximos passos](../notas%20de%20atualização/próximos%20passos.md).

### Decisões pendentes com o Paulo

- **Dados de teste:** o Codex mostra a regra do manual (3 pontos dá 2d20, 6 pontos dá 3d20), mas `poolSizeForStatus` em `diceEngine.ts` usa outra (`floor(status/4) + 1`: 4 pontos dá 2d20, 8 pontos dá 3d20). O código cita um `roadmap-sistema-rpg.md` que não está no projeto.
- **Escudo:** hoje funciona como cura limitada ao PV máximo, então não faz efeito em quem está com a vida cheia.
- **Regeneração de energia:** `regenPerTurn` (15% por turno) existe, mas não é aplicada em combate.
- **Personagem com 0 PV:** o turno não é pulado, e o inimigo não é marcado como derrotado sozinho.
- **Instâncias de inimigo:** cada combate cria novas, que continuam listadas no Painel de Inimigos depois que a luta termina.
- **Ano da trama:** este documento diz meados de 2422; a Home diz 2446.
- **Chamada da Home:** o texto "Crie sua ficha" não corresponde ao fluxo atual, em que só o mestre cria fichas.

## Visão geral

Site/app web oficial do RPG de mesa **Declínio da Luz**, criado e mestrado por Paulo (**prlcheater**). O universo gira em torno de **elementalistas**. A Temporada 1 já foi concluída (9 meses de mesa); a Temporada 2 está em desenvolvimento com os players atuais.

**Autoria do projeto:** prlcheater

O app tem duas frentes:
1. **Pública** — lore (Home + Codex), leitura do livro (T1 finalizada, T2 em andamento).
2. **Logada (área do player)** — ficha de personagem interativa, criação de ficha, upload de itens/artes recebidas no Discord (onde ocorrem as sessões).

> **Importante para o Claude Code:** este documento cobre a estrutura técnica e funcional do app. O conteúdo narrativo completo do universo (cosmologia, raças, elementalistas, facções, locais, linha do tempo, glossário) será entregue via um **manual/documento à parte, produzido diretamente pelo Paulo**, contendo todo o conteúdo do Codex já pronto para uso — este não depende mais de um arquivo de lore intermediário gerado nesta conversa.

Estética desejada: **RPG futurista**, tudo animado, visual imersivo — usar a lib **React Bits** (reactbits.dev) para os efeitos (text animations, backgrounds com partículas/energia, hover effects, transições). Componentes são copiados via CLI (jsrepo) ou shadcn, então cada efeito é customizável no código, não é uma dependência de peso.

## Stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS
- **Animações/UI:** React Bits (reactbits.dev) — instalar componentes sob demanda via CLI conforme necessidade de cada tela
- **Backend/Auth/DB/Storage:** Supabase (Postgres + Auth + Storage + RLS)
- **Deploy sugerido:** Vercel (frontend) + Supabase Cloud

## Papéis de usuário

- **player** — jogador autenticado, dono de uma ficha ativa por vez, edita PV/PE atual da própria ficha e age em combate com o próprio personagem
- **mestre/admin** — Paulo (prlcheater). Acesso total: aprova/cria fichas, edita atributos de qualquer personagem, publica capítulos do livro e entradas do codex/lore

## Contexto histórico (resumo, ver manual do Codex para o conteúdo completo)

O conflito e recuo da humanidade após a Catástrofe de Pandora durou **200 anos**, até a
última cidade se consolidar — e voltar a ficar instável. O presente da trama se passa em
meados de **2422**. Nesse meio-tempo, pesquisas resultaram no controle dos elementos por
pessoas com afinidade natural, mediada por tecnologia (os elementalistas). Os elementos
têm nomes próprios no universo — nomenclatura completa vem no manual do Codex.

Um grupo se uniu para explorar o sistema solar em busca de salvar a humanidade e trazer a
paz de volta: o **Expresso Astral**. Eles percorreram planetas do sistema solar até
encontrar a causa da matéria negra que se alastrava: **O Observador**, uma entidade que
desenvolveu consciência própria e, assim como a matéria negra, era movida pela corrupção.
Os elementalistas do Expresso Astral derrotaram a entidade — mas, ao retornar para casa,
foram caçados pela própria humanidade. O motivo desse conflito é o gatilho da Temporada 2
e **permanece em aberto** (mistério não resolvido na mesa, não deve ser resolvido no site).

### Roadmap do Expresso Astral (Temporada 1)

Nova seção visual para a **Home**: uma linha do tempo/roadmap com o ícone de cada planeta
visitado e um resumo curto ao lado, na ordem em que o grupo percorreu o sistema solar.
Cada parada linka para os capítulos correspondentes no **Livro**. Estrutura por arco:

| Ordem | Planeta/Local | Antagonista / conflito central |
|---|---|---|
| 1 | Terra | Rainha Bruxa Necrófoga: **Nirlith** |
| 2 | Vênus | As filhas do imperador profano: **Kayatl** e **Zephyra** |
| 3 | Lua | **Caronte**, experimento fractal/humano corrompido |
| 4 | Marte | **Dravarthum**, profano ancestral bruxo, em seu Mundo Trono |
| 5 | Saturno | O Imperador Profano e seu exército ameaçam a humanidade com a **Mente Bélica** |
| 6 | Urano | A própria humanidade — a ganância de **Maxmilian Gold** cria o **Mundo dos Sonhos**, local para mentes cativas |
| 7 | Europa (lua de Júpiter) | Lua devastada, ex-centro tecnológico avançado; palco da luta final contra **O Observador** |

Requisitos de UI para essa seção: ícone/ilustração por planeta (React Bits pode entrar
aqui com hover effects e transições entre os cards), resumo curto por parada, ordem
sequencial clara (visual de "trilha"/linha do tempo horizontal ou vertical), e link de
cada parada para o trecho correspondente do Livro.



Menu principal: **Home · Codex · Livro · Área do Player** (esta última visualmente destacada/"iluminada" — clicar nela solicita login se o usuário não estiver autenticado).

### Área pública

- **Home** — porta de entrada narrativa do universo. Hero animado (React Bits background de partículas/energia) seguido de blocos resumidos: cosmologia do universo, origem dos elementalistas, raças, facções e organizações, e linha do tempo de eventos principais. Inclui também o **Roadmap do Expresso Astral** (ver seção própria abaixo) — a jornada da T1 planeta a planeta, com ícone e resumo. Tudo em versão **resumida/essencial** — só o que já é conhecido/estabelecido na fic, sem se aprofundar. Cada bloco linka para a entrada completa no Codex e, quando fizer sentido, para o capítulo correspondente no Livro (quem quiser densidade total vai ler lá)
- **Codex** — enciclopédia navegável do universo, com as mesmas categorias da Home mas em profundidade: Cosmologia, Elementalistas, Raças, Classes, Facções e Organizações, Locais (planetas), Linha do Tempo. Inclui também um **Glossário** (termos próprios do universo, tipo "Vulto", "Cifras") acessível como aba/filtro interno do Codex, não como seção separada do menu. Cada entrada com imagem, categoria e texto
- **Livro** — leitura por temporada/capítulo. T1 completa (todos os capítulos publicados), T2 com capítulos liberados conforme forem escritos pelos players
- **Login / Cadastro** — Supabase Auth (email/senha; considerar OAuth Discord já que é onde a comunidade vive e onde rolam as sessões)

### Área do player (autenticada)
- **Minha Ficha** — visual da ficha interativa: informações (nome, classe, nível, título, vulto), PV/PE base vs atual (barras animadas), elemento (ícone), traços (ataque/resistência/agilidade/intelecto/carisma), economia (créditos/cifras), perícias, habilidades (bases/elementais e sintéticas com nível e descrição), equipamento (armadura/item de classe/arma) e inventário/bolsa
- **Criar Ficha** — formulário guiado: escolhe classe e elemento entre listas pré-definidas, preenche informações iniciais; fica pendente de validação do mestre se necessário
- **Upload de Item** — jogador sobe a arte do item recebida no Discord e associa a um slot de equipamento ou ao inventário; aparece renderizado na ficha
- **Painel do Mestre** (visível só para admin) — gerenciar fichas, elementos, classes, habilidades, itens, capítulos do livro, entradas do Codex

## Módulo futuro (engavetado por ora — não implementar agora)

O combate por turnos já existe (`battle_sessions`, `battle_participants`, `battle_ability_cooldowns`). O que segue engavetado é só o mapa:

**Mapa de batalha (mini VTT).** Canvas interativo com imagem de cenário (fundo gerado por IA), tokens circulares arrastáveis por personagem, ferramentas de desenho (risco livre, marcação, seta, borracha), sincronização em tempo real via Supabase Realtime. Cada jogador só move o próprio token; o mestre move adversários e qualquer coisa. Provável modelagem futura: `battle_tokens` (x/y, character_id), `battle_strokes`. Tratar como módulo independente a ser iniciado só depois que Home + Codex + Livro + Área do Player estiverem consolidados.

## Regras de negócio confirmadas

- Elemento e classe são **listas fixas** (carregadas por `supabase/seed.sql`); hoje é o **mestre** quem escolhe ao criar a ficha
- PV/PE **atual** pode ser editado tanto pelo **jogador** quanto pelo **mestre** (ex: dano em combate), e o banco impõe essa regra; os máximos saem de fórmula, a partir de nível, Resistência e Intelecto, que só o mestre altera
- Cada jogador tem **uma ficha ativa por vez** — ao trocar de temporada/personagem, a ficha antiga é arquivada (não apagada, para manter histórico)
- Sistema Cardinal (uso de Cifras para evoluir habilidades) — **detalhar depois**, já reservado campo `cifras` e tabela de habilidades preparada para receber regras de custo/evolução

## Pendências / a definir com Paulo

- Regras exatas do Sistema Cardinal (como cifras evoluem habilidades)
- Estrutura de capítulos do livro T2 conforme forem escritos pelos players
