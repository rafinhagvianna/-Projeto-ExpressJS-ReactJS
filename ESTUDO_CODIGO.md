# Guia de estudo do código

Este material explica as decisões principais e prepara respostas curtas para a apresentação. Os caminhos são relativos à raiz do repositório.

## Como uma requisição percorre o sistema

O React chama `frontend/src/services/api.js`. O Axios inclui o JWT salvo no navegador; se a resposta privada for `401`, remove o token e encaminha para login. `App.jsx` protege as telas e carrega páginas pesadas sob demanda. No backend, `server.js` encaminha para uma rota; o middleware confere o token; a rota valida parâmetros e chama um model; o model executa SQL parametrizado no PostgreSQL.

## Conceitos centrais

- **Schema e isolamento — `backend/database/schema.sql`:** cada entidade de negócio tem dono (`usuario_id`). As consultas recebem esse ID do token validado e restringem todos os resultados. `UNIQUE(email)` e `UNIQUE(cpf)` no banco impedem duplicidade mesmo quando duas requisições chegam ao mesmo tempo. Uma validação prévia melhora a mensagem, mas a restrição do banco é a garantia final.
- **Senha — `backend/src/routes/auth.routes.js`:** bcrypt guarda um hash com salt. A senha original não é retornada nem persistida. A verificação compara a senha digitada com o hash.
- **JWT e middleware — `backend/src/middlewares/autenticar.js`:** no login a API assina um token com validade curta. Nas rotas protegidas, o middleware verifica assinatura/expiração e disponibiliza o ID do usuário; token ausente ou inválido dá `401`.
- **Transação — cadastro:** usuário, categorias padrão e conta inicial são criados como uma unidade. Se uma etapa falha, a transação evita deixar uma conta parcialmente configurada.
- **Consultas SQL — models:** filtros são parâmetros do PostgreSQL (`$1`, `$2`), e as agregações usam `SUM`, `GROUP BY` e `FILTER` para calcular totais no banco sem carregar todos os dados do usuário para somar em JavaScript.
- **Dinheiro — `utilitarios.js`:** divisão e comparação de parcelas usam centavos inteiros para evitar erros de ponto flutuante. Uma sobra de centavos fica nas primeiras parcelas.
- **Fechamento — `calcularFatura`:** a compra é comparada com o próximo dia de fechamento. Se foi no próprio fechamento ou depois dele, a parcela começa no ciclo seguinte. O dia de vencimento é ajustado para meses mais curtos.
- **Projeção educativa — `saudeFinanceiraModel.js`:** calcula médias recentes e compromissos conhecidos de cartões. Compra no cartão é excluída da base de despesas não cartão para evitar descontar a mesma compra uma segunda vez; as parcelas futuras são abatidas no mês previsto.

## Perguntas prováveis

1. **Por que validar e-mail/CPF também no banco?** A checagem na aplicação ajuda a explicar o erro; a restrição única impede duplicidade mesmo sob concorrência.
2. **A senha fica salva em texto?** Não. Apenas o hash bcrypt.
3. **O que o JWT armazena?** A identidade mínima necessária para associar a sessão ao usuário, com assinatura e expiração.
4. **Como um usuário não acessa lançamento alheio?** As rotas obtêm o dono do token e as queries filtram por `usuario_id`; IDs de terceiros parecem inexistentes e retornam `404`.
5. **Por que usar SQL parametrizado?** Evita concatenar entrada do usuário em SQL e reduz risco de injeção.
6. **O que uma transação garante no cadastro?** Ou todas as entidades padrão são criadas, ou nenhuma fica parcialmente salva.
7. **Por que os models fazem acesso ao banco?** Concentram persistência e regras de domínio; rotas cuidam de HTTP e validação de entrada.
8. **Por que armazenar dinheiro como NUMERIC?** É decimal exato no banco, apropriado para moeda; valores de divisão na aplicação são tratados como centavos inteiros.
9. **Como R$ 100 se divide em três?** 10.000 centavos / 3: 3.334, 3.333 e 3.333, cuja soma permanece 10.000.
10. **Como uma compra vai para a fatura?** A data da compra e os dias de fechamento/vencimento determinam a referência de cada parcela.
11. **O que acontece no dia do fechamento?** A regra considera compra nesse dia como posterior ao fechamento; ela vai para o ciclo seguinte.
12. **Por que gravar uma linha por parcela?** Cada parcela tem valor, índice e data de compra rastreáveis; o grupo permite excluir a compra inteira.
13. **Como evita somar a compra duas vezes na projeção?** As saídas de cartão são retiradas da média histórica e as parcelas previstas são abatidas nas faturas futuras.
14. **O que é `GROUP BY`?** Agrupa linhas por uma chave, como categoria, para calcular soma/contagem de cada grupo.
15. **Para que servem os índices?** Ajudam consultas frequentes por usuário e data, evitando varrer a tabela inteira conforme os dados crescem.
16. **Por que o backend também valida?** A interface não é confiável como barreira; qualquer cliente pode chamar a API diretamente.
17. **Como expira uma sessão?** O token tem validade. Quando a API responde `401`, o cliente limpa a sessão local e redireciona para login.
18. **Como cadastro duplicado é tratado?** A aplicação normaliza/valida campos e o PostgreSQL garante unicidade de e-mail e CPF; conflitos viram resposta controlada.
19. **Qual a diferença entre conta, renda e cartão?** São tipos de fonte/destino com campos e regras próprias; cartões exigem fechamento, vencimento e limite.
20. **Como funciona a paginação?** A API limita linhas, aplica `LIMIT/OFFSET` e devolve contagem e totais do conjunto filtrado.
21. **Por que as rotas privadas retornam 404 entre usuários?** Para não revelar se o recurso de outra pessoa existe.
22. **Como são criadas as categorias iniciais?** No cadastro, dentro da mesma transação de criação do usuário e da conta padrão.
23. **O que os relatórios mostram?** Gastos/entradas por período, percentuais por categoria, comparação com período anterior, origem/destino e faturas.
24. **O que significa reserva de emergência neste protótipo?** Soma dos lançamentos líquidos em contas marcadas como reserva; é uma indicação fornecida pelo usuário, não integração bancária.
25. **A projeção é aconselhamento?** Não. É uma extrapolação educativa e simples baseada no histórico e compromissos cadastrados; a página deixa essa limitação explícita.

## Comandos para explicar e executar

```powershell
# backend
npm run db:reset
npm run dev
npm test

# frontend
npm run dev
npm run build
```

Execute `db:reset` somente em banco de desenvolvimento: ele apaga e recria o schema público antes de aplicar os dados de exemplo.
