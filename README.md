# Declínio da Luz

Site do RPG de mesa Declínio da Luz: lore pública (Home e Codex) e área logada com ficha, painel do mestre e combate por turnos.

- Memória do projeto (estado atual, regras, problemas conhecidos, histórico): [notas de atualização/MEMORIA.md](notas%20de%20atualização/MEMORIA.md)
- O que vamos fazer (roadmap e bibliotecas): [notas de atualização/ROADMAP.md](notas%20de%20atualização/ROADMAP.md)

## Rodar localmente

Requer Node 18 ou superior.

```bash
npm install
cp .env.example .env   # preencha com os dados do projeto Supabase
npm run dev
```

O site abre em `http://localhost:5173`. Home, Codex e Livro funcionam mesmo sem banco acessível, desde que o `.env` esteja preenchido. Login e área do player precisam do Supabase.

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Checagem de tipos e build de produção em `dist/` |
| `npm run lint` | ESLint (config flat em `eslint.config.js`) |
| `npm test` | Testes do motor com Vitest (`npm run test:watch` em modo watch) |
| `npm run preview` | Serve o build localmente |

## Configurar o Supabase

O banco fica definido em `supabase/`, em ordem numérica. O índice completo está em
[`supabase/00_LEIA-ME.md`](supabase/00_LEIA-ME.md).

| Arquivo | Conteúdo | Quando rodar |
|---|---|---|
| `01_schema.sql` | Tabelas, RLS e funções | Só em banco vazio |
| `02_seguranca-e-combate.sql` | Correções de segurança e de combate | Reaplicável |
| `03_fichas-mestre-npcs.sql` | Ficha do mestre e NPCs sem login | Reaplicável |
| `04_habilidades-estruturadas.sql` | Criador estruturado de habilidades | Reaplicável |
| `05_combate-servidor.sql` | Buffs/debuffs/barreira e execução no servidor | Reaplicável |
| `06_elementos-e-reacoes.sql` | Marcas elementais e primeiras reações | Reaplicável |
| `07_seed.sql` | Classes e elementos | Reaplicável |

### Projeto novo

1. Crie o projeto em [supabase.com](https://supabase.com) e copie a **Project URL** e a chave **anon** (*Project Settings > API*) para o `.env`.
2. No **SQL Editor**, execute os arquivos de `01` a `07`, na ordem numérica.
3. Em *Authentication > Sign In / Providers > Email*:
   - desligue **Confirm email**, porque os e-mails do app são fictícios e nunca seriam confirmados;
   - mantenha **Allow new users to sign up** ligado, porque o formulário "Criar Ficha" depende dele.
4. Crie o primeiro mestre, como descrito abaixo.

### Banco que já está em uso

Já está aplicado até o `07`. **Não** execute o `01_schema.sql` de novo. Quando uma beta
nova chegar (ex.: `08_beta-1.3-estados.sql`), rode **apenas o patch novo**.

### Criar o primeiro mestre

Só um mestre consegue criar contas pelo site, então a primeira é feita à mão. O login do app converte nome e PIN assim:

| No site | No Supabase Auth | Exemplo |
|---|---|---|
| Nome do Elementalista | nome sem acentos, em minúsculas, com hífens, seguido de `@example.com` | `Veigas Di Cadmus` vira `veigas-di-cadmus@example.com` |
| PIN | PIN seguido de `-vigia-declinio` | `1234` vira `1234-vigia-declinio` |

1. Em *Authentication > Users > Add user*, crie o usuário com esse e-mail e essa senha, marcando **Auto Confirm User**.
2. No SQL Editor, execute com os seus dados:

```sql
insert into profiles (id, username, role)
select id, 'Veigas Di Cadmus', 'mestre'
from auth.users
where email = 'veigas-di-cadmus@example.com'
on conflict (id) do update set role = 'mestre';
```

Depois disso, entre no site com o nome e o PIN e crie as fichas em *Área do Mestre > Elementalistas*.

## Quem pode fazer o quê

As regras ficam no banco (RLS e triggers), não só nas telas.

| Ação | Visitante | Jogador | Mestre |
|---|---|---|---|
| Ler Home, Codex e Livro | Sim | Sim | Sim |
| Ver a própria ficha | | Sim | Sim |
| Ver fichas e inimigos de outros | | Só dos participantes do combate ativo | Sim |
| Alterar PV/PE atuais da própria ficha | | Sim | Sim |
| Alterar o resto da ficha, habilidades e itens | | | Sim |
| Criar ou excluir fichas e logins | | | Sim |
| Ver habilidades de inimigos | | | Sim |
| Aplicar dano ou cura em combate | | Só como o próprio personagem | Sim |
| Montar combate e passar o turno | | | Sim |

### Limites conhecidos

- **Rolagens no navegador:** dados e dano são calculados no front. O banco confere quem age e em qual combate, mas não o valor nem de quem é a vez. Um jogador com conhecimento técnico conseguiria forjar um resultado.
- **Cadastro aberto:** com a chave anon, qualquer pessoa consegue criar uma conta sem ficha. Ela vira no máximo `player`, mas pode ler o que todo usuário logado lê, como os dados do combate ativo. Fechar isso exige mover a criação de contas para uma Edge Function.
- **PIN de 4 dígitos:** são só 10.000 combinações, e a proteção depende do limite de tentativas do Supabase. O sufixo da senha está no código público do site.

## Deploy

O `vercel.json` já redireciona as rotas para o app. Na Vercel, configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. Nunca use a chave `service_role` no front-end.
