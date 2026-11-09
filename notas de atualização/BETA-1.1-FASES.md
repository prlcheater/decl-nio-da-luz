# Beta 1.1 — Faseamento de implementação

Atualizado em 08/11/2026. Este checklist é o acompanhamento operacional do [plano detalhado](BETA-1.1-COMBATE.md).

**Rotina:** ao concluir uma implementação e seus testes, marcar o item, registrar evidências e indicar a próxima etapa. Publicação e validação no Supabase são acompanhadas separadamente: check de código não significa disponível no site. Continuar pela próxima fase nas próximas rodadas, sem misturar mudanças ainda não validadas.

## Etapas

- [x] **Fase 1 — Criador estruturado (implementação local).** Formulário compartilhado em jogadores/NPCs/inimigos; categoria, escalador, elemento opcional, blocos adicionais e rascunhos; compatibilidade com habilidades antigas.
- [x] **Fase 2 — Buffs, debuffs e barreiras (implementação local, 09/11).** Atributos efetivos, duração em turnos do alvo, expiração e barreira separada do PV.
- [x] **Fase 3 — Execução confiável (implementação local, 09/11).** Turno, autoria, alvo, efeito, gasto, recarga e log no servidor; teste de execução por Intelecto opcional por combate.
- [ ] **Fase 4 — Estados elementais.** Aplicação, origem, duração e ícones no combate.
- [ ] **Fase 5 — Primeiras reações.** Vaporização e Congelamento; depois Alastramento e Condução.
- [ ] **Fase 6 — Ensaio de combate.** Habilidades reais da party, ajustes matemáticos e encontro completo.

Esse faseamento substitui a ordem operacional A–F do plano inicial; o conteúdo e os requisitos do plano detalhado continuam como referência.

## Fase 1 — Entrega

Branch: `feat/beta-1.1-abilities`.

- Formulário único `AbilityBuilder` substitui os dois cadastros duplicados.
- Dano, cura e escudo no comportamento legado aceitam Ataque, Resistência, Agilidade, Intelecto ou Carisma.
- Habilidades antigas sem `definition` preservam o escalamento padrão.
- Campo `definition` versionado armazena efeitos estruturados; nome/descrição não são interpretados.
- Um efeito atual, sem aplicação de estado e com alvo padrão, pode ser usado. Combinações e efeitos não implementados ficam como rascunho.
- Rascunhos são exibidos na ficha e bloqueados na seleção/execução da UI de combate.
- Elemento sem aplicação de estado é identificação apenas. Aplicar elemento exige duração e torna a habilidade rascunho nesta fase.
- Controle, purificação, preparação, movimento, buffs/debuffs e combinações podem ser registrados como rascunhos completos.
- Buff/debuff registra pontos fixos; o campo de escalador desses rascunhos é preparação para a fase 2 e ainda não calcula a magnitude.
- “Somente você” também fica como rascunho até o combate suportar esse filtro. Cura/escudo atuais usam “Aliado (incluindo você)”.
- Resumo legível e indicação de rascunho; falha ao salvar mantém campos abertos.
- Categoria alterada limpa campos incompatíveis; nenhum texto descrevendo medo altera regras implicitamente.
- Limites de cadastro: até 8 efeitos, magnitude de 1–10 pontos e duração de 1–20 turnos. São limites provisórios do editor de rascunhos, não aprovação de balanceamento.
- Sem edição de definições já salvas nesta entrega; a evolução do editor/migração dos rascunhos será tratada antes de habilitar seus efeitos.
- Escudo ainda cura PV, conforme aviso no formulário; não chamar isso de barreira real.
- Não foi implementado teste obrigatório de Intelecto nem reações elementais.

### Banco e publicação

- [x] Preparar `supabase/patch-2026-11-08-habilidades-fase-1.sql`.
- [x] Aplicado no Supabase por Paulo (confirmado em 09/11: coluna `definition` e validador respondem).
- [ ] Validar RPC real, rollback por destino inválido e bloqueio de usuário não mestre.
- [ ] Aplicar no projeto de produção e publicar a branch validada.
- [ ] Confirmar criação e uso reais, incluindo atualização das sessões abertas do app.

O patch é aditivo e não apaga habilidades/vínculos. Criação de habilidade + vínculo acontece numa RPC transacional com validação e permissão de mestre. O validador também é constraint da tabela.

**Limite desta fase:** a resolução do combate continua sendo a atual, no cliente; o bloqueio de rascunhos vale para a UI atualizada e não substitui validação autoritativa do combate. Clientes antigos não entendem definições estruturadas; atualizar sessões abertas antes de usar o novo catálogo. A fase 3 fecha esse contrato no servidor.

Rollback: evitar voltar a um frontend antigo depois de cadastrar rascunhos, pois ele não conhece essa distinção. Antes disso, manter a branch anterior em produção e aplicar somente o patch aditivo é compatível com habilidades legadas. Em caso de incidente após publicação, desabilitar criação/uso de novas definições e corrigir a versão, preservando registros; não apagar a coluna ou fichas.

### Verificações locais

- `node tests/ability-definition.cjs`: padrões legados, cinco escaladores, quantidade de dados, rascunhos híbridos, elementos e rejeição de alvo/campos inválidos.
- `tests/ability-builder-smoke.cjs`: navegador com Supabase simulado; jogador/NPC/inimigo, escalador Agilidade, recarga da página, erro preservando formulário, rascunho de dano + redução de Carisma e largura de 320 px.
- `npm.cmd run build`: verificação TypeScript e bundle. Aviso preexistente de tamanho do bundle permanece.
- Testes simulados não certificam execução de SQL, RLS ou gravação no banco real.

## Fases 2 e 3 — Entrega (09/11/2026)

Branch: `feat/beta-1.1-abilities` (sem commit nem publicação nesta rodada).
Patch: `supabase/patch-2026-11-09-combate-fases-2-3.sql` — aplicar **depois** do de 08/11 e **antes** de publicar o frontend.

**Fase 2 — estados e barreira**
- Tabela `battle_effects`: buff, debuff e barreira por participante; inimigos repetidos têm estados próprios.
- Atributo efetivo = base + buff − debuff (mínimo 0). A base da ficha nunca é alterada; remover o efeito restaura o valor.
- Atributos efetivos valem para escalador de potência, mitigação (Resistência), teste de execução e testes de traço no combate. Não mudam PV/PE máximos nem custos.
- Escudo agora é **barreira**: reserva separada do PV que absorve dano depois da mitigação. **Mudança de regra**: escudo deixou de curar.
- Combate mostra estados na ordem de iniciativa (nome, valor e turnos restantes; não depende de cor).
- Criador: dano/cura/escudo/buff/debuff com alvo padrão, aliado ou próprio usuário passam a ser utilizáveis. Controle, purificação, preparação, movimentação e aplicação elemental continuam rascunho.
- Habilitação explícita: `abilities.combat_enabled`. Habilidades novas suportadas nascem habilitadas; **rascunhos antigos** que o motor já suporta exigem o botão “Revisei — habilitar no combate” na ficha (só mestre). A constraint do banco impede habilitar efeito não suportado.
- Fora do combate, a ficha só rola habilidades simples de dano/cura; barreira e modificadores existem apenas no combate.

**Fase 3 — execução no servidor**
- `combat_use_ability`: valida combate ativo, autoria (mestre ou dono), turno atual, posse da habilidade, habilitação, lados (sem fogo amigo), alvo de apoio aliado, recarga e PE; rola e aplica todos os efeitos, gasta PE, grava recarga e log **numa transação**. O navegador só envia a intenção.
- Idempotência: cada ação tem um UUID; repetir a requisição (clique duplo, rede, F5) devolve o mesmo resultado sem repetir efeito ou custo. A sessão do combate é travada durante a resolução.
- `combat_next_turn`: passa o turno (mestre **ou o dono do turno atual** — jogador pode encerrar o próprio turno), expira efeitos e registra no log. Índice esperado impede passar dois turnos com dois cliques.
- `battle_actions`: registro persistido e visível a todos, com cálculo completo (bruto → mitigação → barreira → PV). Números flutuantes aparecem só após a gravação no servidor.
- Habilidade híbrida (dano + cura) pede o aliado que recebe o apoio (padrão: você).
- Caminhos antigos fechados: `combat_apply_hp` revogado; recarga só gravada pelo servidor ou pelo mestre.
- Ordem de turnos agora é idêntica entre servidor e cliente (iniciativa, nome por código, id).

**Regras provisórias — a calibrar com Paulo** (decisões técnicas para destravar a implementação; não são balanceamento aprovado)
1. Acúmulo: mesmo alvo + tipo + atributo mantém a **maior** magnitude e a **maior** duração restante; sem soma. Buff e debuff do mesmo atributo coexistem.
2. Duração: conta turnos do alvo, ao fim de cada turno dele. Efeito aplicado durante o próprio turno do alvo não conta esse turno.
3. Barreira: não acumula (fica a maior); dura até ser consumida ou o combate terminar.
4. Crítico (d20 = 20) dobra dano, cura e barreira. Ponto vital só vale para dano.
5. Teste de execução: maior d20 do conjunto de Intelecto + Intelecto ≥ 10 / 15 / 20 (Comum / Especial / Suprema). Falha gasta metade do PE, sem efeito e sem recarga. **Desligado por padrão**; o mestre liga por combate.
6. Personagem com 0 PV continua podendo agir (comportamento anterior), até a decisão de Paulo.

### Banco e publicação — fases 2 e 3

- [x] Patch preparado e testado em Postgres local (schema + patches de 04/07/08/09; reaplicação do 09 sem erro).
- [ ] Aplicar `patch-2026-11-09-combate-fases-2-3.sql` no Supabase.
- [ ] Publicar o frontend **logo depois** do patch: o frontend antigo usa `combat_apply_hp`, que o patch revoga; o novo depende das RPCs do patch.
- [ ] Ensaiar um combate real: dano + debuff, barreira, buff próprio, cura em aliado, passagem de turno pelo jogador, F5 durante a ação, dois dispositivos.
- [ ] Revisar rascunhos antigos na ficha e habilitar os que fizerem sentido.

Encerrar combates em andamento antes de aplicar. Rollback: o patch é aditivo; para voltar ao frontend antigo seria preciso reconceder `combat_apply_hp` (`grant execute on function combat_apply_hp(uuid,uuid,int,int) to authenticated`) e a política de recarga do patch de 04/11. Não apagar `battle_effects`/`battle_actions`.

### Verificações locais — fases 2 e 3

- `node tests/combat-sql.mjs . <pasta-do-pglite>`: Postgres em memória; autoria, turno, posse, fogo amigo, alvo de apoio, dano + debuff atômico, cópias independentes, idempotência, buff próprio que sobrevive ao turno de aplicação, expiração, barreira após mitigação, cura em aliado escolhido, recarga, falha no teste de execução, constraint de habilitação e revogação de `combat_apply_hp`. Pegou e corrigiu um erro real de expiração antes da entrega.
- `node tests/ability-definition.cjs`: suporte do motor, habilitação explícita, lados das habilidades híbridas e efeitos ainda não suportados.
- `tests/ability-builder-smoke.cjs`, `tests/beta-1.0-smoke.cjs` e `tests/master-npcs-smoke.cjs` (navegador, Supabase simulado): passam; o combate envia só a intenção e mostra o registro.
- `npm.cmd run build`: passa (aviso de tamanho do bundle preexistente).
- Não testado: RLS e Realtime no Supabase real (PGlite roda como superusuário).

## Próxima etapa — Fase 4

Estados elementais (marca aplicada, origem, duração e ícone), reaproveitando `battle_effects` e a mesma resolução no servidor. Antes, Paulo confirmar as regras provisórias acima.
