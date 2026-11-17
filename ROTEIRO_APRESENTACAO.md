# Roteiro de apresentação — até 10 minutos

Use este roteiro para demonstrar o projeto na ordem do enunciado. O ambiente deve estar iniciado, com `npm run db:reset` executado no backend e os dois servidores ativos.

## 1. Organização do projeto, banco e arquivos principais (1 min)

Mostre `backend/database/schema.sql`: usuários, categorias, fontes/destinos e lançamentos. Aponte as chaves únicas de e-mail/CPF, as chaves estrangeiras, o `usuario_id` em cada dado particular e as regras que limitam tipo e valor. Mostre `backend/src/server.js`, as pastas `routes/`, `models/`, `middlewares/` e a conexão em `config/`. No front, destaque `App.jsx`, `AuthContext.jsx` e `services/api.js`.

## 2. Inicialização pela linha de comando (1 min)

Na raiz do projeto, mostre o PostgreSQL de demonstração e as instruções do README. A sequência do backend é:

```powershell
docker compose up -d
Copy-Item backend/.env.example backend/.env
Set-Location backend
npm install
npm run db:reset
npm run dev
```

Edite `backend/.env` para trocar `JWT_SECRET`. Em outro terminal:

```powershell
Set-Location frontend
npm install
npm run dev
```

Explique que `npm run db:reset` apaga e recria o schema público do banco apontado por `DATABASE_URL`; use somente no banco de desenvolvimento.

## 3. Cadastro, duplicidade, login, sessão e isolamento (2 min)

Comece pela tela Cadastro. Tente cadastrar um e-mail já usado e mostre a validação. As restrições `UNIQUE` no PostgreSQL também protegem contra duplicidade concorrente; a senha é guardada como hash bcrypt. Acesse a conta pronta `marina@financas.test` / `Marina1234`.

Para mostrar o limite entre contas, faça login como `rafael@financas.test` / `Rafael1234` e compare os lançamentos. Cada rota privada usa o ID obtido do token no middleware e filtra no banco; um ID de outra conta retorna `404`.

Sem token, a API responde `401`:

```powershell
curl.exe -i http://localhost:3000/api/lancamentos
```

Com token, os dados são JSON:

```powershell
$login = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/auth/login -ContentType 'application/json' -Body '{"email":"marina@financas.test","senha":"Marina1234"}'
Invoke-RestMethod -Uri http://localhost:3000/api/lancamentos -Headers @{ Authorization = "Bearer $($login.token)" }
```

## 4. CRUD de lançamentos e compra parcelada (2 min)

Cadastre uma entrada e uma saída, edite uma e exclua um lançamento. Mostre filtros por data, tipo, categoria e fonte, paginação e totais calculados pelo backend. Cadastre uma compra de R$ 100,00 no cartão em 3 vezes. A API grava três parcelas relacionadas e distribui centavos como R$ 33,34 + R$ 33,33 + R$ 33,33. Ao excluir, demonstre a escolha entre apenas uma parcela e o grupo.

## 5. Categorias, fontes/destinos, relatórios e faturas (2 min)

Mostre as categorias e fontes/destinos do próprio usuário. Em Relatórios, explique valores por categoria com percentuais e período anterior, e totais por fonte/destino. Abra Faturas: o Visa de demonstração fecha no dia 25 e vence dia 5; o Nubank fecha dia 3 e vence dia 10. Uma compra no dia exato do fechamento segue para o ciclo seguinte.

No seed, a compra “Notebook (parcela)” de R$ 600,00 no Visa foi feita em 10/11/2026:

| Parcela | Fechamento | Vencimento | Referência |
|---|---|---|---|
| 1/3 | 25/11/2026 | 05/12/2026 | 2026-12 |
| 2/3 | 25/12/2026 | 05/01/2027 | 2027-01 |
| 3/3 | 25/01/2027 | 05/02/2027 | 2027-02 |

A compra de fone no Nubank, feita após o fechamento em 05/11/2026, aparece nas faturas de dezembro, janeiro e fevereiro. A “Compra no fechamento”, em 25/10/2026 no Visa, entra na referência dezembro por ser no próprio dia de fechamento.

## 6. Qualidade e validações (1 min)

Explique os testes automatizados: CPF, cálculo de parcela em centavos e regras de fechamento; há testes HTTP para autenticação e integração com dois usuários, CRUD, relatórios, faturas e saúde financeira. Rode `npm test` e `npm run build` (este último dentro de `frontend`). A integração depende de PostgreSQL configurado por `DATABASE_URL`.

## 7. Desafio: página de saúde financeira (1 min)

Abra Saúde financeira. Apresente taxa de poupança, comprometimento de cartões, parcelas futuras, reserva de emergência, variação de categoria e gráfico de projeção por seis meses. A projeção usa médias recentes e compromissos conhecidos, sem tentar adivinhar lançamentos não cadastrados. A página exibe o aviso: **“As informações são educativas e não constituem recomendação financeira profissional.”**
