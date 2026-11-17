# Auditoria final do enunciado

Esta lista confere os requisitos funcionais, de qualidade e demonstração. “Implementado” significa que o código correspondente está presente e a compilação/testes disponíveis neste ambiente foram executados. Integração com PostgreSQL precisa ser repetida em ambiente com banco.

## Funcionalidades

- [x] PostgreSQL relacional com usuários, categorias, fontes/destinos e lançamentos, chaves, restrições e índices.
- [x] Cadastro com validação de dados, CPF, e-mail único, senha hash e categorias/conta padrão em transação.
- [x] Login, JWT com expiração, middleware, endpoint de sessão, limitação de tentativas e redirecionamento de token expirado.
- [x] Isolamento por usuário nas rotas/models e resposta `404` para recurso de terceiro.
- [x] CRUD de categorias e fontes/destinos, incluindo cartão e marcação de reserva.
- [x] CRUD e filtros de lançamentos; validação de tipo/categoria/fonte; paginação e totais.
- [x] Compras parceladas como parcelas relacionadas, divisão exata em centavos e exclusão individual ou do grupo.
- [x] Relatórios por categoria e por fonte/destino, comparação de períodos, totais de faturas, limite utilizado e disponível.
- [x] Fatura atual e próximos ciclos, inclusive compra no dia de fechamento e parcela futura.
- [x] Página de saúde com cinco indicadores, dicas por regras e projeção de seis meses; aviso educativo explícito.
- [x] README, roteiro de apresentação com sete seções, guia de estudo e este checklist.

## Regras de aceitação destacadas

- [x] E-mail/CPF únicos no banco; senha não é exposta na resposta.
- [x] Tentativas de leitura/edição/exclusão cruzada têm testes de integração preparados.
- [x] Categoria de entrada não pode ser associada a saída (e vice-versa).
- [x] R$ 100,00 em três parcelas soma exatamente R$ 100,00.
- [x] Cálculo do fechamento usa a compra no próprio dia como pertencente ao ciclo seguinte.
- [x] API privada sem token responde `401`; token expirado limpa a sessão do navegador.
- [x] `.env`, dependências e arquivos locais estão excluídos pelo `.gitignore`; `.env.example` contém apenas configuração fictícia.
- [x] README documenta instalação, banco, seed, inicialização, testes e contas de demonstração.

## Verificações executadas neste ambiente

- `backend: npm test` — 6 testes passaram, 0 falharam e 2 testes de integração foram ignorados porque `DATABASE_URL`/PostgreSQL não estão disponíveis.
- `frontend: npm run build` — compilação de produção passou.
- `node --check` — passou para o model e rota de saúde financeira e script de reset.
- A consulta `npm audit` não pôde ser atualizada nesta execução: o endpoint de auditoria do registry respondeu com erro de rede. A versão anterior durante a construção reportou zero vulnerabilidades nas dependências então instaladas; não se apresenta esse valor como auditoria atual.

## Validação que depende de PostgreSQL

Depois de instalar Docker Desktop e Node.js, iniciar o PostgreSQL, criar `backend/.env` e executar `npm run db:reset`, rode `npm test` dentro de `backend`. Isso habilita cadastro/login no banco, unicidade, isolamento entre dois usuários, CRUD, relatórios, parcelas, faturas e endpoint de saúde. O comando `db:reset` remove o schema público do banco configurado, portanto deve ser usado apenas em desenvolvimento.
