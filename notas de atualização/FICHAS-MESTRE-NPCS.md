# Beta 1.0 — Fichas do mestre e NPCs

Data: 07/11/2026. Branch: `feat/master-sheets-npcs`.

## Implementado

- Card destacado **Minha ficha** na área do mestre. A ficha ativa é consultada pelo ID do acesso atual.
- Criação da ficha pessoal sem novo login, PIN ou alteração do perfil de mestre. Serve para Auroa, Veigas e qualquer outro acesso com papel mestre.
- A criação pessoal verifica se já há ficha ativa; o índice único existente também impede duplicação concorrente.
- **Personagens do Mundo (NPCs)**: lista e criação próprias, reaproveitando a ficha, retrato, atributos, habilidades, perícias e equipamento existentes.
- NPCs têm `characters.user_id = NULL`, sem conta de autenticação; classe e elemento são opcionais.
- Elementalistas lista fichas vinculadas a contas; NPCs lista apenas fichas sem conta.
- NPCs ativos entram no seletor de personagens do combate existente e são operados pelo mestre. Não foi criado um novo sistema de inimigos.
- Exclusão de NPC remove sua ficha. Exclusão da ficha pessoal preserva a conta de mestre.
- Removida a chamada que liberava nomes apagando contas sem ficha. O patch torna essa função antiga uma consulta sem exclusões.
- Erros de listagem e exclusão são exibidos, sem tratar falha como sucesso.

## Aplicação no Supabase — pendente

O banco remoto **não foi alterado** nesta sessão.

1. Confirmar que o patch `supabase/patch-2026-11-04-seguranca-e-combate.sql` já foi aplicado.
2. Executar `supabase/patch-2026-11-07-fichas-mestre-npcs.sql` no SQL Editor do Supabase, primeiro no ambiente de teste.
3. Validar criação e exclusão com acessos reais de mestre, preservação de seus logins e restrições de escrita para jogadores.
4. Só depois integrar esta branch à main/publicar.

O patch é transacional e pode ser reaplicado. Usa as políticas existentes do patch de segurança; a escrita de NPCs é exclusiva do mestre. Não basta publicar o frontend: sem o patch, a criação de NPC falha pela obrigatoriedade antiga de user_id.

## Verificação

- `npm.cmd run build`: aprovado; permanece o aviso preexistente de bundle grande.
- `tests/master-npcs-smoke.cjs`: navegador com Supabase simulado, cobrindo Auroa e Veigas, vínculo pessoal, prevenção de duplicação, NPC sem login, separação das listas, exclusão/erros, bloqueio de jogador e painel em 320, 390, 768 e 1280 px.
- Os testes simulados não comprovam as políticas nem a execução do SQL no banco real.

As alterações de documentação que já estavam no workspace foram preservadas separadamente.
