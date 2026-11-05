# Parecer sobre Declínio da Luz

Data: 04/11/2026
Avaliação baseada na leitura do projeto, por Codex.

## Minha opinião

Sim, acho que o projeto está legal e entendi o que ele quer ser. Declínio da Luz é um RPG de mesa autoral com uma casa digital própria: apresenta o universo, guarda as regras e oferece ferramentas para o mestre e os jogadores conduzirem a campanha.

O que mais me convence é a ligação entre história e utilidade. Os elementos, as classes e a identidade dos Vigias aparecem tanto na apresentação pública quanto nas fichas e no combate. Existe uma razão concreta para os jogadores voltarem ao site durante as sessões.

Eu o considero uma base promissora de ferramenta para uma mesa, com bastante funcionalidade implementada e pontos importantes de consolidação. A leitura não permite afirmar que está pronto para uso sem problemas: não executei uma partida, não confirmei a configuração do banco remoto e não fiz inspeção visual no navegador.

## O que entendi do universo

A humanidade alcançou uma Era Dourada de expansão pelo sistema solar. O cataclismo de Pandora, em 2222, rompeu essa estabilidade e deu lugar à corrupção, à queda de colônias e a um longo período de sobrevivência. Nesse cenário, os Vigias Elementalistas manipulam forças primordiais por conversão de energia e princípios científicos, conforme a premissa do manual.

Os jogadores assumem esses Vigias. Existem nove elementos, incluindo Aura como elemento restrito, e cinco classes com papéis táticos distintos. A progressão acompanha os acontecimentos da campanha, enquanto habilidades, perícias e escolhas permitem desenvolver cada personagem.

O contexto do projeto descreve a primeira temporada como a travessia do Expresso Astral pelo sistema solar, culminando no confronto com O Observador. O retorno dos personagens, agora caçados pela humanidade que ajudaram a salvar, prepara a segunda temporada. A causa dessa perseguição permanece em aberto.

Para mim, esse é o gancho narrativo mais forte: vencer a ameaça externa não resolve a relação com a própria humanidade. Há espaço para consequências, conflitos de lealdade e decisões difíceis. Eu preservaria esse mistério.

## O que entendi do aplicativo

| Frente | Papel no projeto | O que encontrei |
|---|---|---|
| Home | Apresentar o cenário e despertar interesse | Universo, elementos, classes, temporadas e paradas da jornada |
| Codex | Ajudar a consultar e aprender | Visão geral, elementos, classes, sistema e ficha |
| Livro | Preservar e compartilhar a história da mesa | Página “Em breve”; leitura ainda não implementada |
| Ficha | Acompanhar o personagem durante as sessões | Recursos, atributos, habilidades, equipamentos e rolagens |
| Área do mestre | Preparar e administrar a mesa | Criação de fichas e gestão de personagens e inimigos |
| Combate | Automatizar parte da resolução da luta | Iniciativa, turnos, alvos, efeitos, energia, recarga e sincronização |

O mestre cria a ficha e o acesso do jogador. O jogador consulta seu personagem, ajusta recursos atuais e usa as ações disponíveis. O app depende da condução do mestre e das decisões narrativas da mesa. O mapa de batalha continua como possibilidade futura.

## O que achei mais bem resolvido

**A proposta tem um público claro.** A campanha e seus jogadores dão um propósito imediato às funcionalidades. Ficha, consulta de regras e combate resolvem tarefas recorrentes.

**O universo oferece boas possibilidades de aventura.** Ruínas tecnológicas, corrupção planetária, poderes elementais e conflitos humanos permitem variar exploração, investigação, relações sociais e enfrentamentos. A sequência dos planetas ajuda a tornar uma campanha longa compreensível.

**Classe e elemento são eixos distintos de identidade.** Essa separação abre espaço para personagens com estilos diferentes. A qualidade do equilíbrio entre combinações depende das habilidades e das sessões; não pode ser atestada só pela lista de classes.

**A direção estética combina com a proposta.** Pelo código, a paleta escura, os acentos luminosos, as partículas e os efeitos de energia sustentam o clima do universo. Essa é uma avaliação da intenção visual; legibilidade, conforto e fluidez ainda precisam ser vistos em dispositivos reais.

**Há escolhas técnicas úteis.** O motor de dados está separado em um módulo independente de React e Supabase. O projeto também contém políticas e triggers de banco para distinguir permissões de mestre e jogador. Isso fornece uma boa base para manutenção, desde que os scripts estejam aplicados no ambiente utilizado.

## Onde eu amadureceria o projeto

### 1. Fazer o manual e o aplicativo dizerem a mesma coisa

Este é o ponto mais importante para a confiança dos jogadores.

- O manual e o Codex indicam vantagem a partir de 3 pontos e 3d20 a partir de 6. O motor usa uma fórmula que só aumenta o conjunto de dados em 4 e 8 pontos. Um personagem com 3 pontos recebe uma expectativa ao ler a regra e outro comportamento ao rolar.
- O manual não explicita a faixa de 10–11 pontos na tabela de dados. Vale fechar essa lacuna ao escolher a regra oficial.
- O contexto situa o presente em meados de 2422, enquanto o teaser do Livro na Home começa em 2446. Pode haver uma explicação cronológica, mas ela não está clara entre os documentos.
- A Home convida a criar uma ficha, enquanto a criação está reservada ao mestre.

Eu definiria uma referência oficial para regras e cronologia e atualizaria as demais representações a partir dela. Isso evita que uma mudança de regra seja aplicada apenas ao código ou apenas ao texto.

Referências: [manual](MANUAL%20DECLÍNIO.docx), [contexto](CONTEXTO-PROJETO.md), [motor](../src/lib/diceEngine.ts), [Codex](../src/pages/Codex.tsx), [Home](../src/pages/Home.tsx).

### 2. Explicitar o que o combate automatiza e o que o mestre arbitra

A automação já cobre bastante coisa, mas algumas escolhas precisam ficar claras:

- Cura e escudo seguem o mesmo caminho de alteração de PV. O escudo não constitui uma reserva separada e não protege adicionalmente um alvo com vida cheia.
- A função de regeneração de energia existe no motor, mas não é chamada na passagem de turno.
- A passagem de turno não verifica PV zero para pular participantes.
- O ponto vital multiplica o resultado e está disponível também no fluxo de cura e escudo.
- Não encontrei um limite geral de ações por turno; energia e recarga limitam parte dos usos.

Esses comportamentos não devem ser todos classificados automaticamente como erros de regra. Algumas decisões podem ser arbitradas de propósito pelo mestre. O problema é o jogador não saber onde termina a automação e começa a decisão da mesa.

Também há uma questão técnica independente da regra: aplicar o efeito, descontar energia e registrar a recarga são operações separadas. Uma falha intermediária pode deixar a ação parcialmente registrada. Eu priorizaria tornar essa resolução consistente.

Referências: [combate](../src/pages/player/Combate.tsx), [motor](../src/lib/diceEngine.ts), [patch do banco](../supabase/patch-2026-11-04-seguranca-e-combate.sql).

### 3. Dar ao visitante uma entrada mais direta

A Home apresenta muitos nomes interessantes, mas o início poderia explicar imediatamente que se trata de um RPG de mesa e o que o visitante encontrará ali. Uma frase possível, como sugestão editorial:

> Um RPG de mesa de ficção científica em que Vigias Elementalistas enfrentam a corrupção do sistema solar e as consequências das próprias escolhas.

Depois disso, uma orientação curta para novos jogadores ajudaria: por onde começar a leitura, como entrar na campanha e como receber o acesso com o mestre.

O Livro merece atenção porque já é anunciado com destaque e desperta uma expectativa que a tela “Em breve” ainda não entrega. Publicar um primeiro capítulo ou resumo autorizado da temporada já aproximaria a apresentação da experiência disponível.

Referências: [Home](../src/pages/Home.tsx), [Livro](../src/pages/Livro.tsx), [criação da ficha](../src/pages/player/CriarFicha.tsx).

### 4. Preservar a atmosfera com acesso rápido às ferramentas

A abertura da Home espera aproximadamente 3,7 segundos para liberar as revelações do conteúdo abaixo do título. Isso pode funcionar como apresentação, mas pode cansar em visitas recorrentes.

Eu avaliaria a navegação com alguém tentando consultar uma regra rapidamente durante uma sessão. Também verificaria a iniciativa no celular: a coluna atual fica oculta em telas pequenas.

O suporte a movimento reduzido está explícito no componente de scroll suave; isso, sozinho, não comprova que todas as animações respeitem essa preferência.

Referências: [Home](../src/pages/Home.tsx), [combate](../src/pages/player/Combate.tsx), [scroll](../src/components/SmoothScroll.tsx).

### 5. Consolidar a base antes de ampliar a arena

O projeto já registra limites técnicos no README e nas notas. A leitura confirma alguns deles: o cadastro ocorre em etapas, o banco recebe valores de combate calculados no navegador, e o motor de rolagem livre aceita quantidades de dados sem um limite explícito. Esse último ponto merece validação para evitar entradas que travem a página.

O patch contém proteções importantes, mas sua presença no repositório não prova que estejam aplicadas no banco remoto. A função de combate verifica autoria e participação, porém não recalcula os valores nem valida o turno atual.

A documentação também acumula decisões antigas. Nas notas, a descrição geral ainda fala em voltar à Home após o login, enquanto a atualização mais recente e o código encaminham para a área do jogador ou mestre. Separar estado atual de histórico deixaria a leitura mais confiável.

Referências: [README](../README.md), [notas](../notas%20de%20atualização/notas.md), [entrada do jogador](../src/pages/player/PlayerHome.tsx), [criação da ficha](../src/pages/player/CriarFicha.tsx), [motor](../src/lib/diceEngine.ts).

## Ordem que eu seguiria

1. Confirmar as regras oficiais de dados, escudo, energia, ações e derrota; alinhar manual, Codex e implementação.
2. Validar uma sessão completa com mestre e jogador, incluindo falhas de conexão e atualização simultânea; garantir consistência entre efeito, custo e recarga.
3. Melhorar a orientação de entrada e publicar conteúdo inicial do Livro.
4. Revisar celular, leitura, animações e carregamento; restaurar o lint e criar testes úteis para o motor de regras.
5. Retomar o mapa quando a experiência básica estiver consolidada.

Essa ordem é minha sugestão, não uma mudança nas decisões do projeto. A arena pode enriquecer a experiência, mas ficha confiável, regras coerentes e combate previsível trazem um benefício mais imediato à mesa.

## Limites deste parecer

Li o manual em DOCX, o README, o contexto, as notas, as rotas, os dados do universo, o motor de regras, as páginas públicas e trechos centrais dos fluxos de ficha, autenticação, cadastro e combate, além do patch de permissões.

Este trabalho é uma avaliação de proposta e leitura estática. Não executei build, lint ou testes nesta revisão; não reproduzi os comportamentos numa partida; não auditei o banco remoto nem validei o visual no navegador. Não considero contagens antigas de vulnerabilidades ou medições antigas de desempenho como resultados atuais.

Minha conclusão é que Declínio da Luz tem uma proposta compreensível, um gancho narrativo forte e ferramentas com utilidade real. O próximo ganho de qualidade está em tornar a experiência coerente e confiável para quem joga, além de tornar a história mais acessível para quem chega.
