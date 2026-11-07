# Beta 1.0 — ficha mobile e inimigos repetidos

Data: 07/11/2026

## Entregue

### Ficha e navegação

- Cabeçalho reorganizado: identidade, elemento/classe e nível/XP; depois PV/PE, moedas e abas.
- Nome e título podem quebrar linha sem invadir outros controles.
- Textos auxiliares mais legíveis, campos com fonte de 16 px e botões com alvo mínimo de 44 × 44 px na ficha.
- Controles de nível, traços, restaurar recursos, retrato e remoção de itens acessíveis por toque; foco de teclado visível.
- Abas distribuídas em uma grade no celular, sem depender de rolagem horizontal.
- Créditos e Cifras identificados por nome, além do ícone.
- A animação de entrada da ficha começa ao abrir, inclusive nas seções abaixo da dobra. Rolagem continua necessária para ler conteúdo maior que a tela, mas não para fazê-lo aparecer.
- Preferência de movimento reduzido respeitada pela revelação; progresso de XP também é salvo pelo teclado.
- Menu reorganizado no celular para acomodar os links e o nome do jogador.
- Alcance da borda luminosa limitado no celular para não provocar rolagem horizontal.

### Combate e inimigos

- A preparação do combate permite selecionar a quantidade de cada modelo de inimigo (0 a 20 cópias por modelo).
- Cada cópia é uma instância independente no banco: PV, PE, participação e recarga próprios.
- **Decisão de Paulo: no combate, manter o nome original, sem sufixos como #1, #2 ou #3.**
- Desempate da iniciativa usa o identificador interno quando nome e rolagem são iguais, mantendo a ordem estável.
- Iniciativa com nomes e PV disponível no celular e fora do turno do jogador.
- Retratos em foco mostram o nome; seleção de habilidades cabe na altura disponível, com rolagem interna.
- Preparação usa o estado setup e só ativa a luta depois de salvar os participantes. Falhas exibem mensagem e tentam remover os dados parciais criados nessa preparação.
- Botão de iniciar fica bloqueado durante o envio.
- Cópias avulsas no Painel de Inimigos continuam disponíveis para controle manual, com identificador curto. O painel explica que o combate cria suas próprias cópias.

Não houve mudança de fórmula de jogo ou de schema SQL. A recuperação de falhas de preparação é feita pelo cliente e não substitui a futura transação de combate no servidor. Falhas na própria limpeza são informadas na tela.

## Validação desta rodada

- Build de produção: TypeScript e Vite.
- Teste de navegador em Chromium com Supabase simulado: larguras de 320, 390, 768 e 1280 px, todas as abas da ficha, ausência de excesso horizontal, botões de 44 px, nome longo e movimento reduzido.
- Verificado que as seções ficam visíveis sem rolar a página.
- Três cópias com o mesmo nome: IDs distintos, dano altera apenas a instância alvo e energia é descontada apenas da instância que age.
- Recarga da página preserva as cópias; jogador acompanha participantes fora do próprio turno.
- Falha simulada na criação de uma cópia: mensagem de erro, remoção dos dados parciais e liberação para tentar novamente.
- Capturas locais da ficha e do combate revisadas.
- Teste salvo em `tests/beta-1.0-smoke.cjs`. Requer servidor local em 127.0.0.1:5173 (ou TEST_BASE_URL), Playwright com Chromium disponível e as variáveis Supabase do projeto. PLAYWRIGHT_MODULE pode apontar para uma instalação existente. Todas as chamadas ao Supabase são interceptadas pelo teste; nenhuma ficha da campanha é usada.
- O teste de navegador não valida as permissões do banco remoto nem sincronização entre dispositivos reais.
- Lint continua pendente de configuração, conforme o roadmap. O build ainda avisa sobre o bundle JavaScript grande.

## Próximas rodadas previstas no roadmap

O planejamento anteriormente chamado updates foi consolidado localmente em MEMORIA.md e ROADMAP.md. Esta rodada entrega parte da revisão mobile e da preparação do combate, sem implementar novas regras.

1. Fundação técnica: restaurar lint, testes e aleatoriedade controlada do motor, limitar rolagens livres e dividir o carregamento por rota.
2. Coesão entre manual, Codex e matemática adaptada por Paulo; fechar decisões de escudo, energia, ações e 0 PV.
3. Resolução de combate no servidor em uma transação, proteção contra ações duplicadas e histórico persistido.
4. Prévia e explicação dos cálculos no modo simples.
5. Estados e condições, seguidos de reações elementais.
6. Modo de combos e cooperação; Livro e arena seguem suas trilhas.

## Escopo do commit

Arquivos de interface e combate, teste de navegador e esta nota. A reorganização de documentação que já estava staged antes desta rodada foi preservada, sem incluí-la neste commit.
