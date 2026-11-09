# Beta 1.1 — Reestruturação do combate e criação de habilidades

Data: 08/11/2026. Estado: planejamento; nenhuma regra deste documento foi implementada nesta rodada.
Responsáveis pelas habilidades: mestres. Consumidores do mesmo sistema: jogadores, NPCs e inimigos.

## 1. Direção aprovada e limites

Decisões de Paulo nesta conversa:
- Criação por seletores, caixas de seleção e campos numéricos. Nome e descrição são narrativos; o motor não interpreta texto livre.
- Habilidades compostas: dano pode também aplicar penalidade, elemento ou outro efeito autorizado.
- Atributo escalador, atributo alterado e elemento são escolhas independentes.
- Preservação/buffs beneficiam aliados; dano/debuffs prejudicam adversários. Não existe fogo amigo, inclusive em reações, propagação e áreas.
- Movimentação como habilidade ativa afeta somente o próprio usuário. Pode incluir buffs pessoais.
- Intelecto participa da execução da maioria das habilidades por representar manipulação de energia. Isso não substitui o atributo que escala a potência.
- Carisma pode escalar encantamento/persuasão e receber penalidades. Seus efeitos devem existir na ficha.
- Reações surgem de aplicações elementais encadeadas por participantes. Alguns pares não reagem.
- Reações devem acrescentar vantagens à estratégia, sem cancelamento mútuo nem prejudicar o lado que as preparou.
- Construir em etapas para permitir o primeiro combate real.

Distinção de status:
- **Aprovado:** diretrizes acima.
- **Base de implementação proposta:** padrões abaixo, definidos para tornar o planejamento executável.
- **A calibrar:** números e escolhas de regras ainda não determinados por Paulo. Não assumir que sugestões numéricas anteriores foram aprovadas.

## 2. Situação atual conferida

O motor usa dano/Ataque, cura/Intelecto e escudo/Resistência fixos; não existe escolha de escalador por habilidade. Escudo ainda é aplicado como recuperação de PV. Agilidade não participa da iniciativa atual (1d20 + nível). Não há motor persistente de estados elementais e reações.

Os ícones de afinidade da ficha não provam aplicação temporária de elemento no combate: é preciso registrar e exibir esse estado, separado do elemento natal.

Reaproveitar ficha, cadastro de habilidades, seleção de participantes/alvos, tiers, custos, recargas e animações. Centralizar as regras para remover a duplicação entre execução de habilidades de inimigos e personagens. Não substituir a matemática atual por regras do manual sem decisão explícita.

## 3. Padrão do criador de habilidades

Uma habilidade possui identidade, execução e uma lista ordenada de efeitos. Uma categoria principal organiza o formulário, mas não limita a habilidade a um único efeito.

| Campo | Controle | Valor ausente / validação |
|---|---|---|
| Nome | Texto curto | Obrigatório |
| Descrição narrativa | Texto livre | Opcional; nunca executável |
| Categoria principal | Seletor | Obrigatória; sem inferência por palavras |
| Tier e nível | Seletor e número | Preservar faixas vigentes; validar no servidor |
| Efeitos | Lista de blocos com botão Adicionar efeito | Pelo menos um efeito válido |
| Tipo do efeito | Seletor de catálogo | Obrigatório por bloco |
| Potência | Fixa ou escalada | Fixa exige número; escalada exige atributo e modelo de fórmula |
| Atributo escalador | Ataque, Resistência, Agilidade, Intelecto, Carisma | Nenhum somente para potência fixa/não numérica |
| Atributo alterado | Nenhum ou um dos cinco atributos | Nenhum não cria modificador; buff/debuff de atributo exige seleção |
| Operação | Aumentar/reduzir; pontos ou percentual | Magnitude positiva, direção definida pelo efeito; nunca sinal livre que contorne o alvo |
| Elemento do efeito | Nenhum ou um dos nove | Nenhum = efeito não elemental |
| Aplicar estado elemental | Sim/não | Sim exige elemento e duração; UI sugere sim ao selecionar elemento, mas salva escolha explícita |
| Destinatário do efeito | Alvo principal, próprio usuário ou aliado secundário | Opções filtradas pela natureza benéfica/hostil |
| Alcance e quantidade | Um alvo, grupo limitado, próprio usuário | Quantidade inteira e limite; geometria só quando houver suporte |
| Momento | Imediato, periódico, ao ocorrer um evento | Periódico exige intervalo e duração |
| Duração | Instantânea, N turnos do alvo, até evento | Ausência não significa infinito; exigir valor quando aplicável |
| Acúmulo | Renovar, substituir pelo maior, acumular limitado | Proposta padrão: maior intensidade, duração renovada, sem soma |
| Gatilho/condição | Catálogo de eventos e estados | Nenhum = execução normal; sem expressões livres |
| Teste de execução | Intelecto ou dispensa explícita do mestre | Padrão proposto: Intelecto para manipulação energética |
| Defesa contra efeito | Nenhuma ou teste definido por modelo | Independente do teste de execução |
| PE, recarga e ações | Presets por tier com ajustes limitados | Não deduzir automaticamente zero por campo vazio |
| Restrição de aprendizado | Elemento, classe ou livre | Separada do efeito; regras de desbloqueio pendentes |

Omissão opcional deve virar um valor explícito (nenhum, lista vazia ou falso). Campo obrigatório incompleto bloqueia salvar, com mensagem junto do campo. Trocar categoria limpa ou solicita revisão de campos incompatíveis; dados ocultos não continuam produzindo efeitos.

Prévia automática: “Causa dano baseado em Ataque a um adversário e reduz seu Carisma por N turnos”. Essa frase vem dos campos, não é a fonte da regra. Salvar rascunho incompleto é permitido, publicar/usar não.

Não prometer uma contagem de combinações antes de validar compatibilidades: diversidade vem da composição, mas nem todo produto cartesiano é uma habilidade válida ou equilibrada.

## 4. Catálogo de famílias

| Família | Efeitos possíveis | Destino permitido |
|---|---|---|
| Dano | Direto, periódico, condicionado | Adversários |
| Restauração | PV, PE, regeneração | Aliados, incluindo o usuário |
| Proteção | Barreira separada, mitigação, proteção contra condição | Aliados, incluindo o usuário |
| Fortalecimento | Atributos, potência, precisão ou outros parâmetros declarados | Aliados, incluindo o usuário |
| Enfraquecimento | Penalidades de atributo, vulnerabilidade, redução de cura | Adversários |
| Controle | Imobilização, silêncio, medo, congelamento | Adversários |
| Purificação/dissipação | Remover penalidade de aliado ou benefício adversário | Conforme a operação; dois modelos separados |
| Preparação | Marca, carga, condição de combo | Conforme o benefício/prejuízo declarado |
| Movimentação | Deslocamento próprio e buffs pessoais | Somente o usuário |

Invocação, reposicionamento forçado e campos geométricos ficam como extensões posteriores. Empurrão do CSV é controle sobre adversário, não permissão de usar a categoria Movimentação em terceiros. Até haver regra de posição, não inventar alcance/cone/linha a partir da UI.

Preservação é agrupamento de restauração/proteção/fortalecimento, não fórmula única.

### Alvos e híbridas

Validar o lado por efeito, relativo à equipe do executor; não por tipo de entidade nem pelo papel mestre/jogador.
- Dano + redução de Ataque: ambos no adversário.
- Movimento + Agilidade: ambos no usuário.
- Dano + cura: dano no adversário; cura no usuário ou aliado selecionado separadamente.
- Preservação + buff: somente aliados.
- Mestre não contorna fogo amigo ao usar uma habilidade; ajustes administrativos são uma ação separada e auditada.
- Não inverter lado automaticamente por encantamento na primeira versão.

Uma habilidade não pode ganhar dano por ter escolhido redução de atributo, nem aplicar buff ofensivo em adversário por campos inválidos. O servidor repete a validação do formulário.

## 5. Atributos, execução e efeitos

| Atributo | Papel planejado |
|---|---|
| Ataque | Impacto, golpes, disparos, destruição |
| Resistência | Mitigação, proteção e potência de barreiras |
| Agilidade | Mobilidade, precisão cinética, reação e esquiva quando houver essa regra |
| Intelecto | Manipulação energética e teste de execução; pode escalar cura/hacks/energia |
| Carisma | Persuasão, encantamento, influência e habilidades compatíveis |

Separar três etapas: **conseguir executar**, **calcular potência**, **verificar defesa do alvo**.
Um ataque energético pode exigir Intelecto para execução, escalar Ataque para dano e enfrentar a defesa prevista no seu modelo. Não fazer três rolagens obrigatórias para toda habilidade sem avaliar o tempo de turno.

A calibrar: dado e dificuldade do teste de Intelecto, exceções, custo em falha, recarga em falha, crítico e diferença entre falha de execução e esquiva. Ponto vital não se aplica automaticamente a cura/buff/controle.

Base proposta:
- Um escalador por efeito; fórmulas híbridas ponderadas ficam para depois.
- Atributo base não é sobrescrito por buffs. Exibir base, modificadores e efetivo.
- Intelecto/Resistência temporários não mudam PE/PV máximos nem custos percentuais automaticamente; alteração de máximo requer efeito próprio.
- Modificadores percentuais somados numa camada antes de multiplicar, com limite e arredondamento únicos a calibrar.
- Potência de efeito periódico registrada na aplicação; não recalcular retroativamente a cada buff futuro. Nova ação usa atributos efetivos atuais.
- Regras de resistência, dano e custo compartilham catálogo versionado com manual/Codex.

Exemplo ilustrativo: +2 Agilidade leva 4 para 6; pela fórmula atual uma Especial que escale Agilidade passa de 40d4 para 60d4, média dos dados de 100 para 150, antes de outros fatores. Isso não aprova +2 como valor equilibrado.

Reduzir Carisma diminui testes/habilidades que usam Carisma. Não obriga o inimigo a hesitar. Para isso, anexar também o efeito Medo, com teste, duração e restrição claramente definidos. Não inferir comportamento psicológico da descrição.

## 6. Estados, marcas e combos

Cada instância de efeito registra definição/versão, executor, equipe de origem, alvo, habilidade, potência, cargas, aplicação, expiração e regra de reaplicação. Inimigos repetidos usam seu ID de instância, mantendo estados independentes.

Distinguir:
- Afinidade do personagem (permanente).
- Marca elemental aplicada (ex.: Umidade de Marine).
- Condição mecânica (ex.: Queimadura, Imobilizado, Medo).
- Barreira (reserva separada dos PV).

Ter marca Ignis não causa queimadura automaticamente: a habilidade declara dano periódico se quiser esse comportamento. Ter Glácis não significa congelamento automático.

Combos previstos: buff que melhora outro escalador; preparação consumida por finalização; reação elemental. Todos usam o mesmo motor. Combinar dados manualmente fica para uma etapa posterior.

Base proposta de execução:
1. Validar executor, turno, autoria, alvos e recursos.
2. Fixar versão e valores da ação; resolver teste de execução e defesa conforme modelo.
3. Consultar marcas anteriores do alvo e selecionar reação elegível.
4. Resolver efeitos da habilidade e reação numa ordem declarada; amplificação entra antes da mitigação.
5. Aplicar mitigação, barreira e PV; depois demais alterações na ordem do catálogo.
6. Gravar custos, recargas, marcas e log no mesmo resultado atômico.

Bloquear ciclos: reação não dispara outra reação nesta primeira versão; limitar a uma reação por alvo por ação e limitar alvos secundários. Com várias marcas elegíveis, proposta: jogador escolhe entre opções válidas na prévia; servidor revalida. Não disparar todas silenciosamente.

Cada reação declara contexto ofensivo/apoio. Marca ofensiva não pode ser usada para curar o adversário; preparar um alvo não deve gerar proteção contra a própria equipe. Registrar origem das marcas para validar elegibilidade, inclusive em espelhamento de elementos entre equipes.

Sem cancelamento: um par incompatível não remove marcas nem invalida o golpe. Consumo de carga para produzir um benefício é distinto de cancelamento; proposta é consumir apenas a preparação prevista na receita, preservando condições independentes. Política final de consumo/duração precisa de calibração.

## 7. Reações: fonte, precedência e catálogo

Fonte recebida: [CSV original](reacoes_elementais.original.csv), copiado sem alterações de Downloads.
São 36 pares distintos entre nove elementos. A tabela abaixo cobre todos; mesmo elemento e efeito sem elemento não geram reação cruzada nesta base.

**Precedência:** instruções expressas da conversa > conteúdo do CSV > sugestões de pesquisa.
- Ignis + Granite e Gaia + Umbra ficam sem reação, conforme os exemplos explícitos de Paulo, apesar das receitas do CSV.
- Extinção e Eclipse ficam desativadas: eram cancelamentos.
- Penalizar adversários continua permitido. “Sem efeitos negativos” significa não cancelar a preparação nem prejudicar a própria equipe; não proíbe debuffs ofensivos.
- Receitas com prejuízo ao próprio combo, duração infinita ou recursos inexistentes foram adaptadas e identificadas abaixo.
- Nomes mantidos onde possível. Valores, durações e elegibilidade ainda precisam de teste; tabela é especificação planejada, não regra em produção.
- Pares tratados como simétricos para descoberta. A ordem de aplicação é registrada; não haverá multiplicadores diferentes por ordem sem aprovação.

| Par | Nome exibido | Efeito planejado / contexto | Tratamento da fonte |
|---|---|---|---|
| Marine + Ignis | Vaporização | Amplifica dano ofensivo | Manter; consumo da preparação a calibrar |
| Marine + Élix | Condução | Choque entre adversários elegíveis com Umidade | Manter, limitar cadeia |
| Marine + Granite | Sedimentação | Lentidão no adversário | Adaptar: retirar resistência a Élix que beneficiaria o inimigo |
| Marine + Gaia | Germinação | Regeneração crescente em aliado preparado | Apoio; não cura o adversário molhado |
| Marine + Aura | Clarificação | Remove debuff de aliado e preserva benefício | Apoio; Aura continua restrito |
| Marine + Umbra | Turvação | Reduz precisão adversária | Ocultação adicional do executor fica como efeito separado a calibrar |
| Marine + Galeo | — | Sem reação | Manter; sem transporte automático oculto |
| Marine + Glácis | Congelamento | Imobiliza adversário molhado | Área e bloqueio de ações dependem de regra; não confundir imobilizar com perder turno |
| Ignis + Élix | Sobrecarga | Explosão ofensiva limitada | Empurrão adiado até modelo de posição |
| Ignis + Granite | — | Sem reação | Vitrificação do CSV desativada pela orientação verbal |
| Ignis + Gaia | Combustão | Queimadura ofensiva adicional | Adaptar: não converter dano no inimigo em cura futura dele |
| Ignis + Aura | — | Sem reação | Manter |
| Ignis + Umbra | — | Sem reação | Extinção desativada; não remover estados |
| Ignis + Galeo | Alastramento | Propaga queimadura a adversários elegíveis | Cone substituído por seleção limitada enquanto não houver geometria |
| Ignis + Glácis | Derretimento | Amplifica dano ofensivo | Consumo de marca não implica remover congelamento sem regra explícita |
| Élix + Granite | — | Sem reação | Aterramento não será anunciado como reação |
| Élix + Gaia | Estímulo | Antecipa uma parcela de regeneração aliada | Limitar; não criar cura recorrente infinita |
| Élix + Aura | — | Sem reação | Manter |
| Élix + Umbra | Interferência | Aplica penalidade à precisão adversária | Adaptar: não fazer o próprio raio errar/cancelar |
| Élix + Galeo | Tempestade | Propaga descarga a adversários elegíveis | Quantidade limitada; linha geométrica adiada |
| Élix + Glácis | Supercondução | Aplica Fragilidade, reduzindo mitigação | RD do CSV = parâmetro de redução de dano a definir, não novo atributo automático |
| Granite + Gaia | Enraizamento | Estabiliza/protege aliado | Antiempurrão depende de posição; receita completa fica posterior |
| Granite + Aura | Selo | Sustenta barreira aliada por duração limitada | Adaptar: não permitir proteção infinita |
| Granite + Umbra | Encapsulamento | Proteção aliada | Adaptar: retirar cegueira do beneficiário |
| Granite + Galeo | Erosão | Dano adicional à barreira adversária | Somente hostil; nunca degradar barreira aliada |
| Granite + Glácis | — | Sem reação | Manter |
| Gaia + Aura | Vigor | Cura periódica aliada | “Stamina” não existe; não criar recurso nem converter para PE sem decisão |
| Gaia + Umbra | — | Sem reação | Putrefação do CSV desativada pela orientação verbal |
| Gaia + Galeo | Esporulação | Propaga toxina/controle existente a adversários elegíveis | Não cria toxina/raiz só por haver marca Gaia |
| Gaia + Glácis | Dormência | Preserva preparação benéfica de Gaia em aliado | Não atrasa cura nem remove Gaia; benefício/duração a calibrar antes de habilitar |
| Aura + Umbra | — | Sem reação | Eclipse desativado; não remover estados |
| Aura + Galeo | — | Sem reação | Manter |
| Aura + Glácis | Prismação | Revela ocultação e aplica penalidade breve à precisão adversária | Controle ofensivo; duração/teste a calibrar |
| Umbra + Galeo | Ofuscação | Ocultação em aliados selecionados | Limitar alvos; não ocultar adversários automaticamente |
| Umbra + Glácis | — | Sem reação | Manter |
| Galeo + Glácis | Nevasca | Propaga resfriamento/Fragilidade a adversários elegíveis | Cadeia limitada, sem reações recursivas |

Reações adaptadas acima são decisões de desenho propostas para cumprir as diretrizes, não transcrições literais aprovadas uma a uma. Receitas ainda sem benefício mensurável/modelo suportado ficam desabilitadas no catálogo até definição; não mostrar anúncio sem efeito real.

### Referência de Genshin Impact

Pesquisa em 08/11/2026:
- [Genshin.gg — Elements & Elemental Reactions](https://genshin.gg/elements/): referência comunitária, não oficial. Exemplos consultados: Vaporize/Melt ampliam dano, Frozen combina água/gelo e Swirl propaga elementos. Bloom nesse jogo gera núcleo ofensivo; a Germinação de cura é uma adaptação do CSV, não cópia do jogo.
- [HoYoLAB — Elements Reaction Guide](https://www.hoyolab.com/article/25359336): guia comunitário hospedado na plataforma; não tratado como regra oficial do nosso RPG.

Aproveitar a leitura “preparação visível + aplicação seguinte = reação nomeada”. Não importar multiplicadores, gauges, cronômetros em segundos, cancelamentos ou todos os pares do jogo. Os nove elementos e as regras deste projeto são próprios.

## 8. UX de criação e combate

Criador em blocos curtos: identidade → efeito principal → efeitos adicionais → elemento → execução/custo → resumo. Mostrar somente campos aplicáveis, explicando valores padrão. Mesma interface reutilizada em personagens, NPCs e inimigos.

No combate:
- Ícones de estados próximos do retrato, com nome, duração/cargas e origem ao tocar; não depender só de cor/hover.
- Escolher inimigo molhado mostra Umidade e possíveis reações das habilidades disponíveis, como Congelamento.
- Prévia informa alvo, custo, teste necessário, escalador e reação prevista; previsão não é garantia de sucesso.
- Confirmar resultado vindo do servidor antes de anunciar “Vaporização!”.
- Mostrar separadamente dano bruto, amplificação, mitigação, barreira e PV perdido.
- Estados e logs sobrevivem a F5, troca de dispositivo e reconexão.
- Modificação concorrente do alvo exige revalidação e aviso, não reação fictícia.
- Acessibilidade mobile, teclado, alvos de toque e redução de movimento preservados.
- Controle/imunidade deve aparecer com motivo legível; mestre pode corrigir estado com registro.

## 9. Entregas em partes

A ordem operacional foi refinada com Paulo. Seguir o [checklist de implementação](BETA-1.1-FASES.md); os blocos abaixo preservam os requisitos do planejamento original.

### 1.1-A — Fechar contrato e regras mínimas
- [ ] Consolidar enums, campos opcionais, famílias, alvos e esquema de validação.
- [ ] Aprovar orçamento de ações, teste de Intelecto, falhas, esquiva, crítico/vital e zero PV.
- [ ] Definir duração, acúmulos, barreiras, máximos, arredondamento e limites.
- [ ] Selecionar habilidades reais dos participantes para o primeiro encontro.
Aceite: descrever buff de Agilidade, dano + redução de Carisma, cura e movimento próprio sem interpretar texto.

### 1.1-B — Motor único e estados
- [ ] Motor compartilhado para todos os participantes, atributos efetivos e barreira real.
- [ ] Persistência de estados/marcas por instância, duração e expiração determinística.
- [ ] Testes de limites, acúmulo, remoção e habilidades híbridas.
Aceite: remover buff restaura valor base; duas cópias de inimigo não compartilham estados.

### 1.1-C — Ação confiável no servidor
- [ ] Resolver teste, efeitos, PE, recarga e log atomicamente com ID idempotente.
- [ ] Validar turno, propriedade, categoria, lados, limites e versão da habilidade no servidor.
- [ ] Impedir clique duplo, ação parcial e resultados forjados no navegador.
Aceite: repetir requisição não repete efeito/custo; falha técnica não deixa metade da ação aplicada.

### 1.1-D — Editor e migração
- [ ] Reaproveitar formulários, com blocos estruturados e resumo.
- [ ] Converter habilidades existentes mantendo IDs e vínculos: dano/Ataque, cura/Intelecto, escudo/Resistência.
- [ ] Não inferir elemento nem efeitos extras a partir do nome/descrição.
- [ ] Revisar escudos convertidos, regras de execução e custos antes de ativar versão nova.
- [ ] Versionar definições; combate em andamento não muda por edição posterior de habilidade.
Aceite: habilidade antiga continua reconhecida e nenhuma migração apaga fichas/habilidades.

### 1.1-E — Primeiro lote de combos e reações
- [ ] Buff de Agilidade → técnica escalada por Agilidade.
- [ ] Dano + redução de atributo; Medo separado quando solicitado.
- [ ] Proposta de lote: Vaporização, Congelamento, Alastramento, Condução e Germinação.
- [ ] Demais receitas habilitadas gradualmente após estados/defesas necessários.
- [ ] Prioridade/escolha de reação, origem, consumo e limites de propagação.
Aceite: reação correta exibida; par sem reação preserva ação/estados; suporte não cura adversário; explosão não atinge aliado.

### 1.1-F — Ensaio e primeira sessão
- [ ] Simular níveis baixos/médios/altos e confronto entre tiers; calibrar antes da sessão.
- [ ] Testar mestre, jogador, NPC, inimigos repetidos e reconexão.
- [ ] Turnos, derrotados, recuperação/encerramento de combate e logs completos.
- [ ] Ensaio em celular com poderes reais da party; medir tempo por turno e clareza.
- [ ] Manual/Codex/ajuda e catálogo concordam com a versão publicada.
Aceite: concluir encontro completo com dano, cura, barreira, buff, debuff e reação sem edição manual para corrigir falhas do sistema.

## 10. Decisões ainda necessárias antes de implementar regras

- Dificuldade, dado e falhas do teste de Intelecto; habilidades dispensadas.
- Limite de ações, reações fora do turno e critério de zero PV.
- Valores/durações/custos de buffs, controle e reações; resistências de elites/bosses.
- Esquiva/precisão e interpretação de Fragilidade/RD.
- Consumo e coexistência de marcas, renovação e imunidade temporária a controle repetido.
- Aprendizado/criação por testes dos jogadores: teste, custo e falha; mestres continuam responsáveis pela publicação.
- Confirmar adaptações do CSV e resolver receitas ainda sem efeito mensurável.
- Definir quais habilidades reais precisam estar prontas para o primeiro encontro.

Nada exige implementar todas as 36 combinações de uma vez. O contrato precisa comportá-las; a primeira sessão exige as receitas e comportamentos efetivamente usados pelo grupo.

## 11. Fora desta entrega

Bandeja manual de dados, arena/mapa, invocações complexas, novas regras de Cardinal, biblioteca pública de habilidades e mudanças narrativas. Permanecem no [roadmap geral](ROADMAP.md).

Mudanças de código/banco ocorrerão em branch de teste, com migração revisável, validação real de RLS e plano de reversão. Build e navegador simulado não substituem testes do servidor. Esta rodada altera somente documentação e preserva o CSV recebido.
