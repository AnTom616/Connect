# ConnectHub — Sistema de Gerenciamento de Cadastros

Painel administrativo **SaaS** com tema *Modern Dark Dashboard*, CRUD completo
(**Criar, Ler, Atualizar, Excluir**) e **persistência real de dados** — pronto
para publicação na **Vercel**.

Desenvolvido com **HTML5, CSS3 e JavaScript puro** (sem frameworks no frontend)
e **Vercel Functions** (Node.js) no servidor. **Não utiliza Supabase.**

---

## Índice

1. [Visão geral da arquitetura](#1-visão-geral-da-arquitetura)
2. [Persistência de dados — por que um banco de dados é obrigatório](#2-persistência-de-dados--por-que-um-banco-de-dados-é-obrigatório)
3. [Opções de banco de dados compatíveis com a Vercel](#3-opções-de-banco-de-dados-compatíveis-com-a-vercel)
4. [Configuração do banco recomendado (Neon Postgres)](#4-configuração-do-banco-recomendado-neon-postgres)
5. [Executando localmente](#5-executando-localmente)
6. [Publicando na Vercel — passo a passo](#6-publicando-na-vercel--passo-a-passo)
7. [Testando o CRUD depois do deploy](#7-testando-o-crud-depois-do-deploy)
8. [Estrutura de arquivos](#8-estrutura-de-arquivos)
9. [API REST](#9-api-rest)
10. [Solução de problemas](#10-solução-de-problemas)

---

## 1. Visão geral da arquitetura

O projeto é dividido em **quatro camadas independentes**. A interface nunca
conversa diretamente com o banco de dados: ela consome apenas a API REST,
que delega toda leitura e escrita à camada de acesso a dados (padrão
*repositório*). Essa separação permite trocar o provedor de armazenamento sem
alterar uma única linha do frontend.

```text
┌──────────────────────────────────────────────┐
│  Interface  (public/)                        │
│  HTML5 + CSS3 + JavaScript · sem frameworks  │
└──────────────────────┬───────────────────────┘
                       │ fetch / JSON
┌──────────────────────▼───────────────────────┐
│  API REST  (api/)                            │
│  Vercel Functions · Node.js                  │
│  /api/cadastros · /api/estatisticas · /api/saude │
└──────────────────────┬───────────────────────┘
┌──────────────────────▼───────────────────────┐
│  Camada de acesso a dados  (api/_lib/)       │
│  Padrão repositório · validação centralizada │
│  ├── repository-postgres.js  (produção)      │
│  └── repository-sqlite.js    (dev local)     │
└──────────────────────┬───────────────────────┘
┌──────────────────────▼───────────────────────┐
│  Banco de dados                              │
│  Neon Postgres (Vercel) · SQLite (local)     │
└──────────────────────────────────────────────┘
```

**Como o driver é escolhido** (`api/_lib/db.js`):

| Condição | Driver usado | Onde |
|---|---|---|
| `DATABASE_URL` com `postgres://` definida | PostgreSQL (`pg`) | Vercel / produção |
| Sem `DATABASE_URL` e fora da Vercel | SQLite (arquivo `data/connecthub.db`) | `npm run dev` |
| Sem `DATABASE_URL` **na Vercel** | — (erro 503 com instrução) | Deploy sem configuração |

> ⚠️ O sistema **nunca simula persistência**: se o banco não estiver
> configurado na Vercel, a API responde com um erro orientando a configuração,
> e a interface exibe o selo “Banco não configurado”. Nenhum dado fictício é
> exibido como se fosse real — todos os indicadores vêm do banco.

---

## 2. Persistência de dados — por que um banco de dados é obrigatório

Na Vercel, o frontend é servido por CDN e as funções de servidor são
**serverless e efêmeras**. Isso significa que:

- **Arrays em memória** são descartados a cada execução/instância da função;
- **Arquivos locais da aplicação** vivem em um sistema de arquivos
  **somente leitura** no ambiente serverless;
- **`/tmp`** (o único diretório gravável) é **descartado** entre execuções e
  não é compartilhado entre instâncias;
- **`localStorage`** persiste apenas **no navegador de cada visitante** — os
  dados não existem no servidor e somem ao trocar de dispositivo/navegador.

Portanto, qualquer solução que gravasse “no servidor local” apenas
**simularia** persistência. A única forma honesta de manter os cadastros é
usar um **banco de dados gerenciado**, acessado pela rede via variável de
ambiente — exatamente o que este projeto faz.

---

## 3. Opções de banco de dados compatíveis com a Vercel

| Solução | Tipo | Tier gratuito | Integração com Vercel | Observações |
|---|---|---|---|---|
| **Neon Postgres** ⭐ recomendado | PostgreSQL serverless | Sim | **Nativa** (Marketplace) | SQL relacional, ideal para CRUD; driver `pg` já configurado |
| Supabase | PostgreSQL | Sim | Marketplace | **Não utilizado** — excluído do escopo do projeto |
| Railway / Render Postgres | PostgreSQL | Limitado | Manual (env var) | Funciona sem alterar código (só trocar a `DATABASE_URL`) |
| MongoDB Atlas | Documentos | Sim | Manual | Reabilitaria uma nova camada de dados (sem SQL) |
| Turso (libSQL) | SQLite na nuvem | Sim | Manual | Ótimo custo, mas exigiria outro driver |
| Vercel KV (Redis) | Chave-valor | Sim | Nativa | Inadequado para consultas com busca/ordenação |
| Vercel Blob | Objetos/arquivos | Sim | Nativa | Sem query SQL — também inadequado para CRUD relacional |

**Escolha deste projeto: Neon Postgres**, porque:

1. é a integração oficial de Postgres do **Marketplace da Vercel** (criação do
   banco e da variável de ambiente em poucos cliques, sem sair do painel);
2. possui **tier gratuito** suficiente para fins acadêmicos;
3. é **PostgreSQL padrão** — o driver `pg` usado aqui funciona com qualquer
   provedor, evitando dependência de um único serviço;
4. suporta **busca (`ILIKE`), ordenação e paginação no servidor**, requisitos
   da tabela de cadastros.

---

## 4. Configuração do banco recomendado (Neon Postgres)

### Opção A — criando o banco pelo painel da Vercel (mais simples)

1. Acesse seu projeto na Vercel → aba **Storage**;
2. Clique em **Marketplace → Neon Postgres → Install Neon**;
3. Escolha o plano **Free** e confirme a criação do banco;
4. A Vercel cria automaticamente a variável `DATABASE_URL` (com a string
   *pooled*, ideal para serverless) em todos os ambientes.

### Opção B — criando o banco direto no site do Neon

1. Crie uma conta em <https://neon.tech> e um projeto novo;
2. No painel do projeto, copie a **connection string** marcada como
   **pooled** (termina com `-pooler` e `?sslmode=require`);
3. Adicione-a manualmente como variável de ambiente na Vercel (passo 3.2 do
   guia de publicação abaixo).

O formato da variável é:

```bash
DATABASE_URL="postgresql://USUARIO:SENHA@ep-nome-regiao.aws.neon.tech/neondb?sslmode=require"
```

> 💡 O schema da tabela `cadastros` é criado **automaticamente** na primeira
> requisição (migração `CREATE TABLE IF NOT EXISTS` embutida no repositório).
> Não é preciso executar SQL manualmente.

---

## 5. Executando localmente

Localmente o projeto funciona **sem qualquer banco externo**: sem
`DATABASE_URL`, a camada de dados usa o driver SQLite (arquivo em
`data/connecthub.db`, já no `.gitignore`) com a mesma interface do driver
Postgres.

```bash
# 1. instalar dependências
npm install

# 2. (opcional) garantir o schema do banco
npm run db:push

# 3. iniciar o servidor de desenvolvimento (http://localhost:3000)
npm run dev

# 4. (opcional) inserir 8 cadastros de teste claramente marcados
npm run seed
```

> 🧪 Os cadastros do `npm run seed` usam e-mails `@exemplo.com` e ficam
> gravados de verdade no banco — servem para testar busca, ordenação e
> paginação. Podem ser excluídos pela própria interface.

Se quiser testar **localmente com PostgreSQL** (ex.: Neon), basta criar um
arquivo `.env` (copie `.env.example`) com a `DATABASE_URL` — o servidor
detecta e usa o Postgres automaticamente.

---

## 6. Publicando na Vercel — passo a passo

### 6.1 Hospedar o código no GitHub

```bash
git init
git add .
git commit -m "ConnectHub — Sistema de Gerenciamento de Cadastros"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/connecthub.git
git push -u origin main
```

> Alternativa sem Git: no painel da Vercel, arraste a pasta do projeto em
> **Add New… → Project**. (Recomenda-se GitHub para deploys automáticos.)

### 6.2 Importar o projeto na Vercel

1. Acesse <https://vercel.com/new> e conecte sua conta do GitHub;
2. Selecione o repositório `connecthub`;
3. A Vercel detecta a estrutura automaticamente (**Framework Preset: Other**):
   - `public/` → arquivos estáticos do frontend;
   - `api/` → Vercel Functions (Node.js);
   - **não** há build step — não altere Build Command / Output Directory;
4. Antes de clicar em **Deploy**, abra **Environment Variables** e adicione:

   | Nome | Valor |
   |---|---|
   | `DATABASE_URL` | string de conexão do Neon (opção A cria automaticamente) |

5. Clique em **Deploy** e aguarde (~1 minuto).

### 6.3 Verificar a configuração

Após o deploy, acesse `https://SEU-PROJETO.vercel.app/api/saude`. A resposta
esperada é:

```json
{ "status": "conectado", "banco": "PostgreSQL", "horario": "2026-10-19T12:00:00.000Z" }
```

Se aparecer o erro `configurar_banco` (HTTP 503), a `DATABASE_URL` não foi
definida corretamente — revise o passo 6.2.4 e faça **Redeploy**.

---

## 7. Testando o CRUD depois do deploy

Checklist completo (corresponde às quatro operações exigidas):

| # | Teste | Como | Resultado esperado |
|---|---|---|---|
| 1 | **Create** | Botão “Novo Cadastro” → preencher → Salvar | Toast verde “Cadastro criado”; registro aparece na tabela e no dashboard |
| 2 | Validação | Salvar com nome curto/e-mail inválido/telefone incompleto | Mensagens de erro por campo; nada é gravado |
| 3 | E-mail duplicado | Cadastrar dois registros com o mesmo e-mail | Erro “Já existe um cadastro com este e-mail.” |
| 4 | **Read** | Pesquisar por nome, e-mail ou cidade; ordenar por nome/data; navegar na paginação | Resultados filtrados/ordenados **no servidor**; contador real |
| 5 | Detalhes | Ícone 👁 (olho) | Modal com todos os campos + ID completo (copiável) |
| 6 | **Update** | Ícone ✏️ (lápis) → alterar dados → Salvar | Toast verde “Cadastro atualizado”; mudança persiste após **F5** |
| 7 | **Delete** | Ícone 🗑 (lixeira) → Confirmar no modal vermelho | Toast verde; registro some; KPIs atualizam |
| 8 | Persistência real | Recarregar a página / acessar de outro dispositivo | Os dados continuam lá (vinham do banco, não do navegador) |
| 9 | Indicadores | Comparar os 3 cartões do dashboard com os registros | Total e “recentes (7 dias)” batem exatamente |
| 10 | Falha amigável | (Opcional) desligar o banco e recarregar | Selo vermelho “Banco offline” e mensagens claras, sem dados falsos |

---

## 8. Estrutura de arquivos

```text
connecthub/
├── api/                          # Vercel Functions (backend serverless)
│   ├── _lib/                     # Camada de acesso a dados + lógica compartilhada
│   │   ├── db.js                 # Fábrica de repositórios (Postgres ou SQLite)
│   │   ├── repository-postgres.js# Driver PostgreSQL (Neon) — produção
│   │   ├── repository-sqlite.js  # Driver SQLite — desenvolvimento local
│   │   ├── validation.js         # Regras de validação autoritativas
│   │   ├── handlers.js           # Lógica dos endpoints (CRUD + dashboard)
│   │   └── util.js               # Respostas JSON, erros, CORS, leitura de corpo
│   ├── cadastros/
│   │   ├── index.js              # GET (listar) e POST (criar)  /api/cadastros
│   │   └── [id].js               # GET / PUT / DELETE           /api/cadastros/:id
│   ├── estatisticas.js           # GET /api/estatisticas (KPIs do dashboard)
│   └── saude.js                  # GET /api/saude (indicador de conexão)
├── public/                       # Frontend (servido como estático)
│   ├── index.html                # Página única: dashboard, cadastros e sobre
│   ├── favicon.svg
│   ├── css/styles.css            # Tema Modern Dark Dashboard (responsivo)
│   └── js/
│       ├── api.js                # Cliente da API REST (fetch)
│       ├── utils.js              # Formatação, máscara, validação, toasts
│       └── app.js                # Roteamento, telas, modais e eventos
├── scripts/
│   ├── db-push.mjs               # Garante o schema (npm run db:push)
│   ├── seed.mjs                  # Dados de teste opcionais (npm run seed)
│   └── check-syntax.mjs          # Verifica a sintaxe de todos os JS (npm run lint)
├── server.mjs                    # Servidor local de desenvolvimento (porta 3000)
├── package.json
├── vercel.json                   # Cabeçalhos de segurança
├── .env.example                  # Modelo da variável DATABASE_URL
├── .gitignore
└── README.md                     # Este guia
```

---

## 9. API REST

Todas as respostas são JSON. Erros de validação usam código `400` com o mapa
`campos`; recurso inexistente usa `404`; e-mail duplicado `400` com erro no
campo `email`; banco não configurado na Vercel usa `503`.

| Método | Rota | Descrição | Parâmetros |
|---|---|---|---|
| `GET` | `/api/cadastros` | Lista paginada | `busca`, `ordenarPor` (`nome`/`criado_em`), `ordem` (`asc`/`desc`), `pagina`, `porPagina` (5/10/25/50) |
| `POST` | `/api/cadastros` | Cria um cadastro | Corpo: `nome`, `email`, `telefone`, `cidade` |
| `GET` | `/api/cadastros/:id` | Detalhes de um cadastro | — |
| `PUT` | `/api/cadastros/:id` | Atualiza o cadastro | Mesmos campos do POST |
| `DELETE` | `/api/cadastros/:id` | Exclui o cadastro | — |
| `GET` | `/api/estatisticas` | KPIs do dashboard | — |
| `GET` | `/api/saude` | Status da conexão com o banco | — |

**Regras de negócio aplicadas no servidor** (o navegador replica, mas o
servidor é a fonte da verdade):

- `nome`: 3–120 caracteres, ao menos nome + sobrenome, apenas letras/hífens/apóstrofos;
- `email`: formato válido, até 254 caracteres, **único** (comparação sem maiúsculas/minúsculas);
- `telefone`: 10 ou 11 dígitos (DDD + número), armazenado apenas com dígitos;
- `cidade`: 2–80 caracteres;
- `id`: UUID v4 gerado no servidor; `criado_em`: timestamp ISO 8601 (UTC).

---

## 10. Solução de problemas

| Sintoma | Causa provável | Solução |
|---|---|---|
| Selo âmbar “Banco não configurado” | `DATABASE_URL` ausente na Vercel | Refazer o passo 6.2.4 e redeployar |
| Selo vermelho “Banco offline” | Banco inacessível (neon pausado, credencial errada) | Verificar status no painel do Neon e a string de conexão |
| `503` com `acao: configurar_banco` na API | Deploy sem a variável de ambiente | Ver **6.3** |
| Erro de autenticação do Postgres | Senha/servidor incorretos na connection string | Copiar novamente a string *pooled* do Neon |
| `relation "cadastros" does not exist` | Schema não criado (raro) | A primeira requisição o cria; recarregue a página |
| API local não sobe | Porta 3000 ocupada | `PORT=3001 npm run dev` |
| Ícones não aparecem | CDN do Lucide bloqueado | Verifique a conexão; o app continua funcional |

---

## Licença e uso

Projeto de finalidade **acadêmica**, livre para estudo e adaptação. Os dados
de teste (`npm run seed`) usam e-mails fictícios `@exemplo.com` e devem ser
removidos antes de qualquer uso com dados reais.
