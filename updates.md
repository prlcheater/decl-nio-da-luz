# Updates — evolução de Declínio da Luz

Data: 04/11/2026
Status: direção de produto e proposta de evolução; funcionalidades abaixo ainda não implementadas.
Origem: conversa com Paulo após a leitura do projeto e do manual.

## 1. Direção confirmada por Paulo

O objetivo principal é dar coesão ao sistema em código e ao manual. As diferenças atuais não significam automaticamente que o código está errado: Paulo adaptou regras na implementação para obter uma matemática mais adequada. O trabalho deve avaliar essas adaptações e atualizar a referência oficial, preservando as escolhas intencionais.

O combate atual automatiza quase toda a rolagem e resolução. Embora facilite o uso, repetir cliques pode reduzir a sensação de participação e descoberta que se espera de um RPG. A evolução deve oferecer:

- Um **modo simples**, preservando a facilidade atual e melhorando apresentação, números, impactos e compreensão dos resultados.
- Um **modo de combos**, no qual o jogador combina dados e habilidades e participa mais da construção da ação.
- Interação entre habilidades do próprio personagem e espaço para combinações entre personagens.
- Buffs e debuffs com matemática e consequências sobre dados e resolução.
- Comportamentos reutilizáveis de habilidades, ampliando a diversidade por composição.
- Condições como lentidão, envenenamento, corrosão e congelamento.
- Reações elementais: elementos e estados modificando os efeitos uns dos outros.
- Melhorias gerais de UX, com espaço para pesquisa e sugestões coerentes com o universo futurista.

**Escopo desta entrega:** documentar a direção, pesquisar referências e registrar propostas concretas. Não altera fórmulas, manual DOCX, telas ou banco. A autorização para documentar e commitar não transforma cada número sugerido abaixo em regra aprovada.

Este documento complementa o [parecer inicial](docs/PARECER-PROJETO.md). A explicação de Paulo substitui qualquer interpretação de que alinhar o sistema exigiria restaurar automaticamente as regras antigas.

## 2. Princípio central

Automatizar a contabilidade e tornar visíveis as escolhas. O jogador deve decidir intenção, risco, preparação, alvo e combinação; o app deve contar recursos, aplicar regras e explicar o resultado.

Mais decisões relevantes podem recuperar o envolvimento. Exigir mais cliques ou mais contas manuais, por si só, não resolve a repetição. O mestre continua podendo arbitrar situações narrativas e registrar exceções.

## 3. Coesão entre código e manual

### Retrato da implementação atual

Referência: [diceEngine.ts](src/lib/diceEngine.ts).

| Parte | Comportamento encontrado |
|---|---|
| Conjunto básico de dados de teste | min(6, floor(max(0, traço) / 4) + 1) |
| Dificuldade | Altera quantidade de dados e modificador; mínimo de um dado |
| Resultado do teste | Maior d20 + traço + modificador de dificuldade |
| Dados de habilidade | min(200, max(0, traço escalador) × 10) |
| Habilidade comum | Dados d2, incremento 3 × nível da habilidade, custo de 10% do PE máximo |
| Especial | Dados d4, incremento 15 × nível da habilidade, custo de 25% |
| Suprema | Dados d8, incremento 75 × nível da habilidade, custo de 50% |
| Crítico de habilidade | d20 separado; 20 dobra o resultado |
| Ponto vital | Dobra o resultado; pode acumular com crítico |
| Mitigação | Soma de dados d10 pelo conjunto básico de Resistência + Resistência |
| PV máximo | 500 + Resistência × 150 + nível × 10 |
| PE máximo | 300 + Intelecto × 100 + nível × 8 |
| Iniciativa | 1d20 + nível |
| Recarga | Comum 0, Especial 1 e Suprema 3 rodadas |
| Regeneração | Função de 15% do PE máximo existente, sem aplicação na passagem de turno |

O limite de seis dados pertence ao conjunto básico: a dificuldade favorável pode acrescentar outro. Essa distinção precisa aparecer no manual se for mantida.

O manual antigo usa outros degraus de dados, a partir de 3 e 6 pontos. Não escolher uma versão só por ela estar no DOCX ou no código: registrar a intenção, comparar resultados e definir a versão oficial com Paulo.

### Processo proposto

1. Inventariar regra antiga, regra implementada, motivo da mudança e dúvidas.
2. Medir probabilidades, dano médio, variância, custo e duração esperada de encontros.
3. Definir a versão das regras da campanha.
4. Centralizar parâmetros e definições estruturadas; o motor consome essas definições.
5. Publicar tabelas e exemplos derivados dos mesmos parâmetros no Codex e na versão revisada do manual.
6. Registrar mudanças com exemplos de antes/depois e impacto nas fichas existentes.

O manual continua explicando intenção, narrativa e exceções em linguagem humana; não deve virar uma listagem de código. Regras em texto e fórmulas devem ter verificações de consistência.

### Observação matemática importante

Muitos dados somados tendem a produzir resultados proporcionalmente mais estáveis. Para N dados independentes dS, a média da soma é N × (S + 1) / 2 e a variância é N × (S² − 1) / 12. A dispersão relativa diminui com o crescimento de N.

Exemplo da regra atual, sem crítico, ponto vital ou mitigação: habilidade comum de nível 1 com Ataque 10 usa 100d2 + 3. A média é 153 e o desvio padrão dos dados é 5. A rolagem comum oscila pouco em relação ao total; os multiplicadores externos provocam saltos maiores. Isso ajuda a explicar por que apenas animar mais dados pode não produzir mais decisão.

Trocar muitos dados por poucos dados maiores pode preservar a média e alterar bastante a variância. Essa mudança exige simulação e teste de mesa, não apenas uma equivalência de soma.

## 4. Dois modos disponíveis

**Proposta de arquitetura:** um motor compartilhado de regras e duas formas de construir a ação. A interação entre efeitos deve funcionar para ambos os modos.

| Aspecto | Simples | Combos |
|---|---|---|
| Intenção | Escolher habilidade e alvo | Planejar sequência, alocação de dados e alvo |
| Contabilidade | Automática | Automática |
| Dados | Resultado apresentado com opção de detalhar | Dados manipuláveis dentro de regras explícitas |
| Efeitos | Aplicados e explicados pelo motor | Usados para preparar, transformar e finalizar |
| Ritmo | Poucas decisões e resolução rápida | Mais escolhas táticas, sem exigência de reflexos |
| Público | Quem prefere fluidez | Quem gosta de experimentar combinações |

Sugestão: escolher o modo por jogador, com autorização da configuração da campanha, e trocar apenas fora de uma ação em andamento. A convivência na mesma luta exige uma economia comum de ações, energia e potência. Enquanto isso não estiver balanceado, testar combos em encontros separados.

O modo simples pode oferecer sequências predefinidas de potência equivalente. O modo de combos oferece flexibilidade; não deve simplesmente liberar várias habilidades completas pelo preço de uma.

## 5. Proposta inicial para combos

Tudo nesta seção é hipótese de protótipo.

### Fluxo

1. Declarar intenção e selecionar habilidades elegíveis.
2. Ver custo, limites e resultados possíveis antes de comprometer a ação.
3. Comprometer a ação e gerar um conjunto pequeno de dados de combo.
4. Distribuir os resultados entre preparação, transformação e finalização.
5. Ver a previsão dos efeitos conhecidos.
6. Confirmar a distribuição e resolver a ação.
7. Exibir o resultado com explicação; permitir ao mestre registrar uma correção.

Após revelar os dados, recarregar a página, cancelar ou alternar o modo não gera novos resultados. O conjunto pertence à ação persistida. Reconexão recupera os mesmos dados e o mesmo estado.

### Dados de combo e dados de dano

Não mostrar 100 dados para o jogador arrastar. Proposta inicial: poucos dados de decisão, separados dos dados numéricos usados para calcular potência. Uma conversão para dano deve ser definida e balanceada antes de ativar a mecânica.

Os dados de decisão podem alimentar requisitos: valor mínimo, par, ímpar, soma limitada ou dois resultados iguais. Resultados baixos devem ter usos, como preparar um estado ou estabilizar energia. Cada dado tem identidade própria e só pode ser gasto uma vez, salvo transformação explicitamente permitida.

### Exemplo ilustrativo de alocação

Protótipo fictício com três d6 de decisão, resultados 2, 4 e 5:

- O 2 alimenta um módulo de estabilização.
- O 4 alimenta uma preparação condutiva.
- O 5 ativa uma descarga que se beneficia dessa preparação.

Alternativa: investir dois dados numa barreira e usar o terceiro para preparar o próximo turno. Isso cria uma escolha entre pressão e sobrevivência.

Esse exemplo não define dano, preço ou três ações gratuitas. Os módulos dividem um orçamento único de potência e recursos. O número de dados, suas faces e os requisitos precisam ser experimentados.

### Interação entre habilidades

- **Preparadora:** aplica estado ou abre uma condição.
- **Transformadora:** altera dado, estado ou distribuição de potência.
- **Finalizadora:** consome preparação para produzir um efeito.
- **Reativa:** responde a um evento elegível usando um recurso reservado.

Combos próprios podem atravessar turnos. Combos cooperativos podem usar uma preparação deixada por um aliado, sem transferir seu controle a outro jogador. Começar pelas preparações persistentes; interrupções simultâneas entre jogadores exigem uma interface e uma ordem de resolução próprias.

Proposta para limitar abuso: tamanho máximo da sequência, custo de cada módulo, teto de ativações reativas e proibição de ciclos que devolvam indefinidamente dados ou energia.

## 6. Habilidades como composição de comportamentos

Uma habilidade pode ser descrita por:

**identidade + elemento + forma de entrega + escalamento + comportamentos + condições + custo + restrições.**

Exemplos originais para explorar, sem aprovação como cânone:

| Habilidade | Comportamento | Interação possível |
|---|---|---|
| Agulha Criogênica | Impacto e acúmulo de frio | Prepara congelamento |
| Pulso de Élix | Descarga sobre um alvo | Consome estado condutivo |
| Névoa Corrosiva | Aplicação periódica | Desgasta proteção |
| Muralha de Granite | Barreira temporária | Absorve dano antes do PV |
| Vetor Galeo | Redirecionamento | Muda alvo ou dispersa névoa conforme regra |
| Matriz Gaia | Regeneração | Remove ou reduz contaminação compatível |

Catálogo inicial de comportamentos: impacto direto, dano periódico, barreira, cura, preparação, consumo de estado, conversão de dado, redistribuição de potência, encadeamento e reação defensiva.

A ideia “X habilidades × Y comportamentos” é boa para ampliar possibilidades, mas o produto aritmético não garante combinações interessantes. Cada composição deve passar por compatibilidade, custo, legibilidade e teste. Começar pequeno permite descobrir quais interações geram escolhas reais.

O criador de habilidades do mestre deve usar opções estruturadas, limites e prévia do efeito. Descrições narrativas permanecem livres; fórmulas arbitrárias não devem ser executadas como código.

## 7. Buffs, debuffs e estados

| Estado proposto | Papel mecânico a experimentar | Regra necessária |
|---|---|---|
| Lentidão | Restringir uma transformação de dado ou capacidade de reação | Evitar que só reorganize iniciativa de forma confusa |
| Envenenamento | Dano periódico biológico | Compatibilidade com alvo; máquinas não recebem automaticamente veneno orgânico |
| Corrosão | Reduzir proteção ou eficiência de barreiras | Piso de proteção e teto de acúmulo |
| Resfriamento | Preparar congelamento | Quantos acúmulos e quando são consumidos |
| Congelamento | Restringir parte da ação | Duração curta, resistência e prevenção de bloqueio permanente |
| Condutividade | Preparar descarga de Élix | Fonte, duração e consumo |
| Queimadura | Dano periódico térmico | Momento do dano e interação com resfriamento |
| Foco | Melhorar ou ajustar um dado | Custo e número máximo de ajustes |
| Barreira | Reserva de proteção separada do PV | Capacidade, expiração e regra de substituição |
| Interferência | Prejudicar módulos tecnológicos | Elegibilidade e contramedida |

Um efeito precisa armazenar: definição, origem, responsável, alvo, intensidade, acúmulos, duração, momento de ativação, momento de expiração, categoria de remoção e versão da regra.

Reaplicação precisa escolher entre renovar duração, somar intensidade com teto, substituir pelo maior ou manter instâncias separadas. Não aplicar as quatro possibilidades implicitamente.

Atributos base devem permanecer preservados; calcular valores efetivos a partir dos modificadores ativos. A proposta se inspira na separação entre dados originais e efeitos temporários documentada pelo [Foundry VTT](https://foundryvtt.com/article/active-effects/).

### Matemática dos modificadores

Distinguir claramente:

- Adicionar ou remover dados.
- Alterar faces ou transformar um resultado.
- Alterar critério de seleção.
- Somar valor fixo.
- Modificar potência percentual.
- Modificar resistência, barreira ou custo.

Mais dados não significam a mesma coisa em “somar todos” e “manter o maior”. Modificadores precisam declarar qual família de rolagem afetam.

Proposta de resolução: elegibilidade e recursos → modificadores dos dados → rolagem/alocação → potência base e bônus fixos → percentuais compatíveis → mitigação → barreira → PV → estados e reações na ordem definida.

Percentuais da mesma categoria podem ser somados antes de aplicar um teto; multiplicações entre categorias devem ser explícitas. Fixar a regra de arredondamento em cada etapa. Esta ordem é uma proposta; não alterar silenciosamente a ordem atual de crítico e ponto vital.

## 8. Reações elementais

Recomendação: reações orientadas por **estado presente + elemento recebido + comportamento da habilidade**. Ter um elemento na ficha não significa imunidade, fraqueza ou reação automática em todos os ataques.

Primeiro conjunto de hipóteses:

| Preparação | Elemento ou ação seguinte | Reação proposta | Contrapartida |
|---|---|---|---|
| Molhado, aplicado por Marine | Élix | Condução: favorece descarga ou salto limitado | Consome a preparação; limite de alvos |
| Molhado | Glácis | Formação acelerada de gelo | Consome água; congelamento limitado |
| Resfriado | Ignis | Choque térmico | Consome frio; não mantém controle e bônus indefinidamente |
| Névoa ou partículas | Galeo | Dispersão ou propagação controlada | Pode reduzir concentração; definir alcance |
| Proteção de Granite | Impacto qualificado | Fratura ou absorção reforçada conforme comportamento | Requer propriedade explícita; não vale para qualquer golpe |
| Contaminação biológica | Gaia | Filtragem ou recuperação | Custo; não purifica tudo automaticamente |
| Ocultação de Umbra | Aura | Revelação temporária | Aura continua restrita; não anula todo o elemento |
| Campo luminoso identificável | Umbra | Atenuação ou ocultação parcial | Limite de duração e intensidade |

Esses nomes e efeitos são propostas autorais para Declínio da Luz, não regras retiradas de outros jogos. “Choque térmico” e termos semelhantes são inspirações ficcionais; não são uma simulação física validada.

Os nove elementos aparecem como campos de exploração, mas isso ainda não é uma matriz completa. Para a primeira versão, implementar poucas reações coerentes. Pares sem regra resultam em “nenhuma reação adicional”.

A ordem importa: aplicar A e depois B não precisa equivaler a B e depois A. Cada receita define gatilho, consumo, prioridade, alvo, dano ou benefício, limite de ativações e quais eventos podem gerar nova reação.

Começar com no máximo uma reação derivada por resolução é uma hipótese conservadora. Se cadeias forem introduzidas, exigir profundidade máxima e registrar a origem para impedir ciclos. Interações ofensivas e benéficas precisam ser visíveis para ambos os modos.

## 9. UX: prioridades aplicáveis

### Durante o combate

- Mostrar turno, rodada, recursos, condições e recargas num local previsível.
- Disponibilizar ordem de iniciativa também no celular.
- Manter uma visão útil da luta fora do próprio turno.
- Mostrar por que uma ação está indisponível e o que falta.
- Prévia de alvo, custo, efeitos garantidos e faixas incertas, respeitando informações ocultas.
- Separar dano bruto, mitigação, barreira absorvida e perda real de PV.
- Destacar números com contexto; o registro permanece consultável depois da animação.
- Animações rápidas, velocidade configurável e movimento reduzido.
- Sons opcionais, sem depender deles para comunicar eventos.
- Interação por toque, teclado e seleção; arrastar dados deve ser uma opção.
- Estados com nome, ícone e duração; cor sozinha não basta.
- Desabilitar confirmação duplicada enquanto uma ação está sendo processada.
- Informar falha e reconexão; nunca anunciar sucesso antes da confirmação da ação.
- Permitir correção pelo mestre com registro, sem apagar o histórico.

### No modo simples

Uma sequência curta: habilidade → alvo → confirmação → resultado. Presets podem reduzir escolhas repetidas. Uma opção “ver cálculo” mostra como o sistema chegou ao número.

### No modo de combos

Bandeja de dados, módulos compatíveis destacados e sequência legível. Permitir desfazer alocação antes de confirmar, sem rerrolar. Explicar o efeito de cada encaixe e oferecer tutorial curto com uma combinação.

### No restante do produto

Revisar entrada de novos jogadores, busca de regras, navegação, ficha mobile, mensagens de erro, estados vazios e retorno após salvar. Reduzir espera artificial em acessos recorrentes. Publicar o Livro em etapas e alinhar a chamada da Home ao cadastro pelo mestre.

Critério de sucesso: jogador consegue explicar o que fez, por que funcionou e qual escolha faria diferente. Medir tempo de turno, cliques, erros e pedidos de ajuda durante testes; definir metas após observar a experiência atual.

## 10. Pesquisa e ideias adicionais

Pesquisa realizada em 04/11/2026, usando páginas dos próprios projetos. As referências servem para inspirar soluções; não pressupõem equivalência entre esses jogos e Declínio da Luz.

### Dicey Dungeons: estratégia diante da rolagem

A apresentação oficial destaca o equilíbrio entre planejamento e incerteza dos dados, com personagens de estilos distintos. Isso oferece uma referência para investigar como escolhas sobre dados podem produzir identidades de jogo. Minha sugestão derivada: cada classe de Declínio pode ter uma forma própria e limitada de manipular dados, em vez de receber apenas multiplicadores de dano. [Fonte oficial](https://terrycavanagh.itch.io/dicey-dungeons).

Hipóteses: Velocista troca potência por sequência; Sentinela reserva dado para proteção; Marionetista redistribui resultados; Suporte melhora uma alocação aliada; Arcano transforma um dado com custo. Testar efeitos distintos sem obrigar o modo de combos.

### Foundry VTT: efeitos temporários estruturados

A documentação explica efeitos que alteram valores sem destruir a informação original, com operações como adição e multiplicação. A lição para este projeto é manter origem, duração e composição dos modificadores de forma rastreável. Não exige adotar o Foundry como plataforma. [Fonte oficial](https://foundryvtt.com/article/active-effects/).

### Lancer e COMP/CON: personalização e ferramenta de apoio

A página oficial de Lancer apresenta personalização modular e indica o COMP/CON como construtor de personagens e compêndio. A inspiração é aproximar a construção do personagem da consulta de regras. Minha sugestão: laboratório de habilidades para o mestre visualizar custo, compatibilidades e exemplos antes de liberar uma combinação. Não foi feita uma auditoria funcional do COMP/CON nem leitura integral do livro. [Fonte oficial](https://massif-press.itch.io/corebook-pdf).

### Ideias originais coerentes com o cenário

| Ideia | Escolha oferecida | Prioridade sugerida |
|---|---|---|
| Sobrecarga elemental | Aumentar capacidade agora e acumular instabilidade | Depois da base de combos |
| Dissipação térmica | Gastar preparação para remover sobrecarga | Junto da sobrecarga |
| Interferência e contramedidas | Comprometer uma função tecnológica ou proteger um aliado | Após estados básicos |
| Telemetria dos Vigias | Investir numa análise para revelar uma condição ou comportamento inimigo | Protótipo pequeno |
| Assinatura energética | Repetir uma estratégia pode permitir adaptação inimiga anunciada | Depois do balanceamento |
| Objetivos de combate | Proteger reator, evacuar civis ou interromper transmissão | Pode começar sem mapa |
| Vestígios da Matéria Negra | Efeitos narrativos opcionais com custo de exposição | Somente com direção de lore de Paulo |
| Simulador de treino | Experimentar combos sem gastar recursos da campanha | Após motor determinístico |

Não transformar tudo em barras de recursos. Começar com PV, PE e efeitos já compreensíveis; adicionar sobrecarga apenas se melhorar decisões. Novas ideias não devem explicar o mistério da segunda temporada ou estabelecer fatos de lore sem Paulo.

## 11. Estrutura técnica proposta

Esta seção é desenho futuro, não descrição de código existente.

- Catálogos versionados de regras, habilidades, comportamentos, estados e reações.
- Motor puro de resolução com fonte de aleatoriedade injetável para testes.
- Interface separada para intenção, prévia, confirmação e apresentação.
- Definições de habilidade distintas das instâncias de efeito em combate.
- Ações persistidas com identificador único, versão do combate, dados revelados, alocações, custos e eventos resultantes.
- Resolução autorizada no servidor, com validação de autoria, turno, recursos, alvo e compatibilidade.
- Uma transação para custo, resultado, recarga, efeitos e registro da ação.
- Proteção contra repetição da mesma ação e conflitos entre clientes.
- Sincronização por eventos confirmados; animações não são a fonte da verdade.
- Recursos de campanha para habilitar combos gradualmente e manter encontros antigos na versão de regras original.

O projeto atual calcula resultados no navegador e grava partes da ação separadamente. A ampliação de interações torna a consistência mais importante. O modo de dados revelados exige persistência antes da alocação final; recarregar não pode permitir escolher uma rolagem melhor.

Migração: adaptar habilidades existentes como impacto, cura ou barreira, preservar identificadores e históricos, testar numa campanha separada e habilitar por configuração. A conversão de “escudo como cura” para barreira deve ser anunciada como mudança de regra.

Um evento pode conter: ação, autor, alvo, momento, tipo, valores antes/depois, regra aplicada, motivo e reação de origem. Guardar apenas o necessário para explicar, reproduzir e corrigir a resolução.

## 12. Plano incremental e critérios de conclusão

| Etapa | Entrega | Critério de conclusão |
|---|---|---|
| 0 — Regras | Inventário e versão matemática oficial | Manual, Codex e exemplos concordam; dúvidas identificadas |
| 1 — Base confiável | Ação consistente, registro, barreira e economia de turno | Sem gasto ou efeito duplicado em repetição/reconexão |
| 2 — Simples aprimorado | Fluxo mobile e resultado legível | Jogadores conseguem usar e explicar ações sem ajuda constante |
| 3 — Estados | Poucos buffs/debuffs com duração e acúmulo | Aplicação, renovação, remoção e expiração verificadas |
| 4 — Reações | Pequeno catálogo com consumo explícito | Ordem previsível; sem cadeias infinitas |
| 5 — Combos próprios | Dados de decisão e sequência limitada | Mesmo conjunto ao reconectar; alocação válida; custos equivalentes |
| 6 — Cooperação | Preparações entre aliados e reações autorizadas | Controle de cada jogador preservado; turno continua fluido |
| 7 — Expansão | Mais comportamentos e ideias futuristas | Diversidade demonstrada em sessões, sem opção dominante |

Melhorias de UX independentes podem avançar em paralelo às etapas, sem esperar todo o sistema. A arena continua uma expansão posterior; estados, combos e objetivos podem funcionar sem coordenadas ou mapa.

### Validação

- Testes do motor: extremos de atributos, limites de dados, arredondamento, modificadores, duração, prioridade e prevenção de ciclos.
- Testes de integração: custo e efeito atômicos, recarga, autoria, repetição, concorrência e reconexão.
- Simulações reproduzíveis por nível e papel: dano médio, dispersão, proteção, cura, controle, gasto de energia e duração dos encontros.
- Comparar modos também por utilidade e flexibilidade, não só dano por turno.
- Testes com mestre e jogadores em celular e desktop, incluindo teclado e movimento reduzido.
- Registrar escolhas mais frequentes e combinações abandonadas para detectar opções dominantes.

## 13. Decisões ainda abertas

Não bloqueiam este documento; serão resolvidas antes da implementação dependente.

1. Confirmar quais adaptações matemáticas atuais viram regra oficial.
2. Definir orçamento de ações por turno e como habilidades múltiplas o dividem.
3. Escolher quantidade, faces e função dos dados de combo.
4. Definir se algum dado substitui parte do cálculo atual de dano.
5. Definir chance de aplicação/resistência, duração e acúmulo de condições.
6. Definir o primeiro conjunto de reações e sua prioridade.
7. Determinar equivalência entre modos e acesso dos inimigos às mecânicas.
8. Definir intervenções do mestre, dados físicos e registro manual, caso desejados.
9. Confirmar limites de Aura e compatibilidade de novos comportamentos com a lore.
10. Selecionar um encontro de teste e poucos personagens representativos.

## 14. Checklist de acompanhamento

- [x] Registrar a direção de Paulo e a justificativa das adaptações no código.
- [x] Documentar os dois modos, comportamentos, condições, reações e UX.
- [x] Pesquisar referências e distinguir inspiração de proposta autoral.
- [x] Registrar plano de implementação, limites e critérios de teste.
- [ ] Fechar a versão oficial das regras.
- [ ] Atualizar manual e Codex.
- [ ] Implementar e testar as etapas.
- [ ] Validar em sessão com a mesa.

A entrega atual é planejamento. Nenhuma das novas mecânicas deve ser apresentada como pronta até existir implementação e validação.
