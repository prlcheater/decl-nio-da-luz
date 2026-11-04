# Notas de Atualização — Declínio da Luz

Registro do que já está implementado no app e do que ele faz hoje. Serve como referência viva: sempre que algo novo for implementado, atualiza aqui.

---

## Visão geral

Site/app oficial do RPG de mesa **Declínio da Luz**, criado e mestrado pelo Paulo (prlcheater). Tem duas frentes:

1. **Área pública** — lore do universo (Home + Codex) e leitura do livro por temporada.
2. **Área do Player (logada)** — ficha de personagem interativa, criação de ficha e painel de controle do mestre.

Stack: React + Vite + TypeScript + Tailwind CSS no front-end; Supabase (Postgres + Auth + RLS) no back-end.

---

## Área pública

### Home
- Hero animado com o título "Declínio da Luz" em revelação letra a letra, seguido de botões pra explorar o Codex ou ler o Livro.
- Seção "O Universo": resumo da cosmologia (Era Dourada, colapso de Pandora, Matéria Negra, Última Cidade, Vigias) e cards das duas temporadas (T1 finalizada, T2 em andamento).
- Seção com os 9 elementos (ícone, nome, epíteto, descrição — Aura marcado como elemento restrito).
- Seção com as 5 classes de personagem.
- **Roadmap Expresso Astral**: linha do tempo visual com as 7 paradas da Temporada 1 pelo sistema solar (Terra, Vênus, Lua, Marte, Saturno, Urano, Europa), cada uma com o antagonista/conflito central daquele arco.
- Teaser do Livro e CTA final convidando a entrar na Área do Player.

### Codex
Enciclopédia navegável em abas: Visão Geral (história completa da origem do universo), Elementos, Classes, Sistema (traços, sistema de dados, progressão/XP, energia, penalidades, perícias passivas) e Ficha (explicação do que compõe uma ficha de personagem).

### Livro
Página existe, mas ainda é um placeholder ("em breve") — a leitura dos capítulos por temporada ainda não foi implementada de fato, mesmo já existindo a tabela `book_chapters` pronta no banco.

---

## Login e contas

- Login não é e-mail/senha tradicional: o jogador entra com **Nome do Elementalista + PIN de 4 dígitos**. Por trás dos panos isso é convertido pro formato exigido pelo Supabase Auth (o nome vira um e-mail fictício, o PIN vira uma senha com sufixo fixo).
- Duas roles: **player** e **mestre**. O mestre tem acesso total (cria, edita e remove qualquer ficha); o player vê a própria ficha e ajusta só PV e PE atuais.
- **Não existe cadastro público** — quem cria login e ficha de um novo jogador é sempre o mestre, pelo fluxo de "Criar Ficha".
- Excluir uma ficha também exclui o login associado, liberando aquele nome de elementalista pra ser reutilizado depois.
- Ao logar (ou já estar logado e reabrir o site/dar F5), o usuário cai no **Home**, não direto na ficha.
- Quando logado, o link "Área do Player" do menu vira o **nome do elementalista**.

---

## Área do Player

### Minha Ficha
- **Identidade**: nome, título (editável), foto/retrato circular ("Vulto") com upload e recorte (zoom + posicionamento antes de salvar).
- **Nível**: contador com setas de + / − e barra de progresso de XP (0–100%) — visual, não incrementa nível sozinha.
- **Ícones de elemento e classe** no cabeçalho da ficha.
- **Moedas**: Créditos (uso geral) e Cifras (moeda rara reservada pro futuro Sistema Cardinal de evolução de habilidades), ambas editáveis.
- **PV (Pontos de Vida) e PE (Pontos de Energia)**: máximo calculado por fórmula (nível + Resistência ou Intelecto) e valor atual — barra/slider pra ajustar o atual, botão de restaurar pro máximo.
- **Traços**: Ataque, Resistência, Agilidade, Intelecto e Carisma, cada um com contador de + / − e indicador de pontos disponíveis.
- **Habilidades**: nome, descrição, nível, tier (Comum / Especial / Suprema) e efeito (Dano / Cura / Escudo), com botão de usar que gasta energia e calcula o resultado.
- **Dados**: testes de traço por dificuldade (Favorável, Regular, Difícil, Severa), rolagem livre (ex: `2d20kh1+3`) e histórico das últimas rolagens.
- **Perícias passivas**: lista simples de nome + descrição.
- **Equipamento**: 3 slots fixos — Armadura, Item de Classe e Arma — cada um podendo receber um item com nome e raridade.
- **Bolsa (inventário)**: lista livre de itens, mesma lógica de raridade do equipamento.
- Botão de sair (logout) e, só pro mestre, opção de excluir a ficha (com confirmação).

**Raridade dos itens** (cores e nomes atuais):
| Raridade | Cor |
|---|---|
| Regular | cinza |
| Raro | azul médio |
| Lendário | roxo |
| Exótico | dourado |

> Quem edita a ficha (traços, moedas, habilidades, equipamento, foto) é só o **mestre**. O player ajusta PV e PE atuais, rola dados e usa as próprias habilidades.

### Área do Mestre
Menu com três entradas:
- **Elementalistas**: lista as fichas da campanha, com criação e exclusão (com confirmação).
- **Inimigos**: cadastro por tier (Comum, Elite, Boss), com ficha própria, traços, habilidades e elemento opcional, além de instâncias com PV e PE rastreados.
- **Combate**: escolhe quem participa e controla a luta.

### Combate
- Iniciativa rolada ao iniciar (1d20 + nível), ordem visível e botão de próximo turno para o mestre.
- Na sua vez, o jogador testa um traço ou usa uma habilidade em um alvo; o mestre age pelos inimigos.
- Custo de energia e recarga em rodadas por tier (Comum 0, Especial 1, Suprema 3).
- Dano reduzido pela mitigação do alvo, com número flutuante que todos veem em tempo real.

### Criar Ficha
Formulário (só o mestre usa) que cria o login do jogador e a ficha ao mesmo tempo: nome do elementalista, PIN, título, classe, elemento e nível inicial. PV e PE iniciais saem da fórmula.

---

## Visual e animações

- Fundo animado de partículas em todo o site (Three.js).
- Scroll suave em toda a navegação (GSAP + Lenis), desativado automaticamente se o usuário tiver "reduzir movimento" ligado no sistema.
- Cards com borda que brilha seguindo o cursor (usados em Home, Codex e na Ficha).
- Textos com efeito de gradiente animado (título do menu, "Segunda Temporada", "Seja bem-vindo").
- Títulos com revelação letra a letra ao entrar na página.
- Seções que aparecem com fade/deslocamento conforme o usuário rola a página.

---

## Regras de negócio confirmadas

- Cada jogador tem **uma ficha ativa por vez** (garantido pelo banco).
- Nível máximo de personagem: **125**.
- Máximo de pontos base por traço: **10**.
- Elemento e classe são listas fixas (`supabase/seed.sql`); o mestre escolhe entre as opções ao criar a ficha.
- Sistema Cardinal (evolução de habilidades usando Cifras) ainda não tem regras definidas — só o campo/estrutura já reservados no banco.

---

## Últimas atualizações (04/11/2026)

As mudanças de banco só valem depois de executar `supabase/patch-2026-11-04-seguranca-e-combate.sql` (ver README).

**Segurança**
- Corrigido: qualquer conta podia se promover a mestre, gravando a própria role.
- Corrigido: o jogador podia alterar nível, traços, moedas e habilidades da própria ficha chamando a API. Agora o banco só libera PV e PE atuais.
- Excluir a ficha de um mestre não apaga mais o login dele.

**Combate**
- Corrigido: o jogador só via a si mesmo como alvo, então não conseguia atacar. Agora ele enxerga os participantes enquanto a luta está ativa.
- O PV agora é ajustado no banco, então dois golpes simultâneos não se sobrescrevem.
- Se o efeito falhar, a ação para antes de gastar energia ou recarga.
- As tabelas do combate foram adicionadas ao Realtime.

**Telas**
- Corrigido: tela em branco na área logada quando a conta não tem perfil ou o banco está fora do ar.
- Corrigido: tela em branco para quem não é mestre ao abrir a ficha de um inimigo.
- O login agora diferencia PIN errado de servidor fora do ar.
- A ficha avisa quando uma alteração não é salva.
- PV e PE ajustados pelo teclado agora são salvos.
- Nível limitado a 125 nas fichas de personagem.
- Excluir inimigo agora pede confirmação.

**Projeto**
- Novos: `README.md`, `supabase/seed.sql` (classes e elementos) e `vercel.json`.

---

## Atualizações de 16/08/2026

- Corrigido: login e reabertura do site (F5) agora levam pro **Home**, em vez de cair direto na ficha — vale tanto pra login de player quanto de mestre.
- O menu agora mostra **"Seja bem-vindo, {nome do elementalista}"** no lugar de "Área do Player" quando o usuário está logado.
- Ícones de elemento e classe no cabeçalho da ficha ficaram um pouco maiores, e o texto do nível ganhou +2px.
- Raridade dos itens ajustada: **Regular** (cinza), **Raro** (azul médio), **Lendário** (roxo) e **Exótico** (dourado) — os nomes e cores exibidos foram corrigidos, sem alterar os dados já salvos.
