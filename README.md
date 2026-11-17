# Clareza — controle financeiro pessoal

Aplicação full stack para registrar entradas e saídas, organizar categorias e contas, controlar compras parceladas e acompanhar relatórios e faturas. A interface está em português e cada conta vê apenas os próprios dados.

## Tecnologias

- **API:** Node.js 20+, Express, PostgreSQL e JWT.
- **Interface:** React, Vite, React Router, Axios e Recharts.
- **Persistência:** PostgreSQL com restrições, chaves estrangeiras e índices definidos em `backend/database/schema.sql`.

## Pré-requisitos

Instale Node.js 20 ou superior. Para o banco, use Docker Desktop ou PostgreSQL 14 ou superior. O Git não é necessário para executar o projeto já baixado.

## Inicialização com Docker

Na pasta raiz do projeto:

```powershell
docker compose up -d
```

Configure `backend/.env` copiando `backend/.env.example`. Troque `JWT_SECRET` por um segredo longo e aleatório. O `DATABASE_URL` de exemplo funciona com o serviço do `docker-compose.yml`:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/financas
JWT_SECRET=troque-por-um-segredo-longo-e-aleatorio
PORT=3000
FRONTEND_ORIGIN=http://localhost:5173
```

No PowerShell, crie o arquivo a partir do exemplo:

```powershell
Copy-Item backend/.env.example backend/.env
```

Depois, edite `backend/.env`, entre em `backend` e instale as dependências, crie o schema e carregue os dados de demonstração:

```powershell
cd backend
npm install
npm run db:reset
npm run dev
```

Em outro terminal, entre em `frontend` e inicie a interface:

```powershell
cd frontend
npm install
npm run dev
```

Abra http://localhost:5173. O Vite encaminha as chamadas para `http://localhost:3000/api`. Para limpar e recarregar todos os dados de demonstração, rode `npm run db:reset` dentro de `backend`; **esse comando apaga o schema público do banco configurado**.

## Usuários para demonstração

| E-mail | Senha | Uso |
|---|---|---|
| `marina@financas.test` | `Marina1234` | Conta com lançamentos, reserva, cartões e compras parceladas |
| `rafael@financas.test` | `Rafael1234` | Segunda conta para demonstrar isolamento |

O seed é apenas para desenvolvimento. Não use essas credenciais em produção.

## Organização do código

```text
backend/
  database/schema.sql       tabelas, restrições e índices
  database/seed.js          usuários e dados de demonstração
  scripts/                  schema e reset do ambiente de desenvolvimento
  src/server.js             configuração e montagem da API
  src/config/               conexão com PostgreSQL
  src/middlewares/          autenticação, validação e erros
  src/models/               consultas e regras de domínio
  src/routes/               endpoints HTTP
  tests/                    testes HTTP de unidade e integração
frontend/src/
  components/               telas e componentes React
  contexts/                 estado de autenticação
  services/                 cliente Axios autenticado
```

O backend mantém consultas ao banco nos models e controle HTTP nas rotas. `utilitarios.js` reúne regras sem dependência do banco, incluindo validação de CPF, divisão exata de parcelas em centavos e cálculo de faturas com fechamento.

## API principal

Todas as rotas abaixo, exceto autenticação, exigem `Authorization: Bearer <token>`.

| Método | Caminho | Finalidade |
|---|---|---|
| `POST` | `/api/auth/cadastro` | Cadastrar usuário e criar categorias e conta padrão |
| `POST` | `/api/auth/login` | Autenticar e emitir token |
| `GET` | `/api/auth/me` | Consultar usuário do token |
| `GET/POST/PUT/DELETE` | `/api/categorias` | Consultar e manter categorias próprias |
| `GET/POST/PUT/DELETE` | `/api/fontes-destinos` | Manter rendas, contas, reservas e cartões |
| `GET/POST/PUT/DELETE` | `/api/lancamentos` | Consultar, filtrar e manter lançamentos |
| `GET` | `/api/relatorios/categorias` | Totais, percentuais e comparação de períodos |
| `GET` | `/api/relatorios/fontes-destinos` | Totais agrupados por conta/renda/cartão |
| `GET` | `/api/relatorios/faturas?meses=3` | Fatura aberta, próximas faturas e limite utilizado |
| `GET` | `/api/saude-financeira` | Indicadores educativos e projeção de seis meses |

Parâmetros de lançamentos incluem `pagina`, `limite`, `inicio`, `fim`, `tipo`, `categoriaId` e `fonteDestinoId`. A API valida os campos, escapa consultas por parâmetros e responde `404` quando um recurso pertence a outra conta.

## Parcelas e fechamento da fatura

O lançamento de uma compra parcelada grava uma linha por parcela, com o mesmo grupo, data da compra, categoria e cartão. O total é dividido em centavos; qualquer centavo restante é distribuído nas primeiras parcelas. Assim, uma compra de R$ 100,00 em três vezes vira R$ 33,34 + R$ 33,33 + R$ 33,33.

O cálculo da fatura está em `backend/src/models/utilitarios.js`. Compra no próprio dia de fechamento entra no próximo ciclo. Os dados de demonstração incluem o Visa com fechamento dia 25 e vencimento dia 5, o Nubank com fechamento dia 3 e vencimento dia 10 e compras que atravessam o fechamento.

## Testes

Dentro de `backend`:

```powershell
npm test
```

Os testes sem banco cobrem CPF, parcelas, fechamento de fatura e respostas HTTP sem autenticação. Os testes de integração usam `DATABASE_URL`; configure o banco, aplique `npm run db:reset` e rode `npm test` para habilitá-los. Sem a variável, os testes de integração são marcados como ignorados.

Para compilar a interface, dentro de `frontend`:

```powershell
npm run build
```

## Saúde financeira

A página compara entradas e saídas nos três meses recentes, calcula comprometimento agregado dos limites dos cartões, reserva registrada em contas marcadas como reserva e aumentos de categoria. A projeção usa o saldo histórico, a média líquida sem contar compra no cartão duas vezes e os compromissos de cartão conhecidos no horizonte consultado. É uma estimativa simples: não prevê renda ou despesas futuras que ainda não foram lançadas. As dicas seguem regras fixas documentadas no model; não usam IA nem dados externos.

> As informações são educativas e não constituem recomendação financeira profissional.

## Segurança e configuração

Senhas são armazenadas com bcrypt; tokens JWT expiram em uma hora; login tem limitação de tentativas; as rotas privadas filtram por `usuario_id`; o CORS aceita a origem definida em `FRONTEND_ORIGIN`. Nunca publique `.env`. Antes de expor a aplicação, use segredos próprios, HTTPS e credenciais de banco diferentes das demonstrações.
