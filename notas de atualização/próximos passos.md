# Próximos Passos

Lista de ideias e melhorias planejadas para as próximas atualizações do app.

## Concluído

- Sistema de rolagem de dados, com notação no estilo do bot **Rollem Rocks** do Discord.
- Cálculo automático de dano das habilidades.
- Combate por turnos em tempo real (sem mapa).

## A fazer

1. Criar a arena interativa do combate: mapa com tokens e ferramentas de desenho.
2. Implementar a leitura dos capítulos na página Livro.
3. Revisar design mobile e desktop.
4. Restaurar o `npm run lint` (falta o `eslint.config.js`).
5. Mover a criação de contas para uma Edge Function, para fechar o cadastro público.

As regras de jogo que dependem de decisão do Paulo estão em `docs/CONTEXTO-PROJETO.md`, seção "Decisões pendentes".

## Revisão de 04/11/2026

Pontos encontrados lendo o código. Nenhum foi reproduzido em uma partida real, então vale confirmar cada um antes de corrigir.

### Lógica do combate

- **Ações por turno sem limite:** nada impede usar várias habilidades ou rolar vários testes no mesmo turno. Habilidades comuns não têm recarga, então o limite real é só o PE.
- **Ponto vital sem custo:** é uma caixa de seleção que dobra o resultado, sem teste nem custo. Também vale para cura e escudo.
- **Habilidades sempre acertam:** não há teste de acerto nem de esquiva. O crítico é um d20 separado.
- **Inimigos repetidos:** cada ficha só pode ser escolhida uma vez por combate.
- **Falhas silenciosas ao iniciar:** `startBattle` não mostra erros. Se a criação de participantes falhar, a luta fica ativa e vazia, e um inimigo cuja instância falhe simplesmente não entra.
- **Passagem de turno:** só o mestre consegue. O jogador não tem como encerrar o próprio turno.
- **Painel do jogador fora do turno:** ele não vê a lista com o PV de cada participante.
- **PV máximo vem do navegador:** `combat_apply_hp` recebe `p_hp_max` do front, então o limite de cura pode ser forjado.

### Fichas e contas

- **Criação em etapas:** login, perfil e ficha são gravados separadamente. Uma falha no meio deixa o cadastro incompleto.
- **Ficha sem classe ou elemento:** sem o `seed.sql`, os seletores mostram a lista fixa com id vazio, e a ficha é salva sem esses dados e sem aviso.
- **PV e PE após mudar atributos:** os atuais não acompanham o novo máximo. É preciso usar o botão de restaurar.
- **Aliado sem jogador:** toda ficha aliada exige um login, então não há NPC aliado.
- **Jogador sem ficha:** o login agora leva para "Nenhuma ficha encontrada", uma tela sem orientação sobre o que fazer.
- **Instanciar inimigo:** o botão do Painel de Inimigos cria cópias que não entram no combate, porque a luta cria as próprias. Ele confunde e pode ser removido.

### Desempenho

- **Imagens dentro do banco:** o retrato é salvo como data URL em `portrait_url`, sem usar o Storage, e vem junto em cada consulta de combate e de listagem.
- **Recarga completa no combate:** qualquer mudança em `characters` ou `enemy_instances`, mesmo fora da luta, refaz todas as consultas da tela para cada pessoa conectada.
- **Tamanho do site:** o JavaScript tem 1,3 MB em um único arquivo. Dividir por rota reduziria o carregamento da Home.

### Qualidade do projeto

- **Sem testes automatizados:** `diceEngine.ts` é uma função pura e seria o melhor ponto de partida.
- **Dependências:** o `npm audit` aponta 8 vulnerabilidades (4 moderadas e 4 altas), 2 delas moderadas em dependências de produção.

### Faltando

- Arena com mapa, tokens e desenho.
- Upload de arte de item.
- Livro com capítulos.
- Coluna de iniciativa em telas pequenas, onde hoje fica oculta.
