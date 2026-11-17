import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { app } from '../src/server.js';
import { pool } from '../src/config/database.js';

const executar = Boolean(process.env.DATABASE_URL);
let servidor;
let baseUrl;
const usuarios = [];

function cpfValidoAleatorio() {
  const base = randomUUID().replace(/\D/g, '').padEnd(9, '0').slice(0, 9);
  const calcular = (texto) => {
    const soma = texto.split('').reduce((total, n, i) => total + Number(n) * (texto.length + 1 - i), 0);
    const resto = (soma * 10) % 11;
    return String(resto === 10 ? 0 : resto);
  };
  const nove = base;
  const dez = nove + calcular(nove);
  return dez + calcular(dez);
}

async function requisitar(caminho, token, metodo = 'GET', body) {
  const resposta = await fetch(`${baseUrl}${caminho}`, {
    method: metodo,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const dados = resposta.status === 204 ? null : await resposta.json();
  assert.equal(JSON.stringify(dados).includes('senha_hash'), false);
  return { resposta, dados };
}

async function cadastrar(email) {
  const { resposta, dados } = await requisitar('/api/auth/cadastro', null, 'POST', {
    nome: 'Conta de Teste', email, cpf: cpfValidoAleatorio(),
    senha: 'Senha1234', confirmarSenha: 'Senha1234',
  });
  assert.equal(resposta.status, 201);
  usuarios.push(dados.usuario.id);
  const login = await requisitar('/api/auth/login', null, 'POST', { email, senha: 'Senha1234' });
  assert.equal(login.resposta.status, 200);
  return { usuario: dados.usuario, token: login.dados.token };
}

before(async () => {
  servidor = app.listen(0);
  await new Promise((resolver) => servidor.once('listening', resolver));
  baseUrl = `http://127.0.0.1:${servidor.address().port}`;
});

after(async () => {
  if (executar && usuarios.length) {
    await pool.query('DELETE FROM usuarios WHERE id = ANY($1::integer[])', [usuarios]);
  }
  await new Promise((resolver, rejeitar) => servidor.close((erro) => erro ? rejeitar(erro) : resolver()));
  await pool.end();
});

test('isola CRUD e lança parcelado entre dois usuários', { skip: !executar }, async () => {
  const sufixo = randomUUID();
  const a = await cadastrar(`a-${sufixo}@teste.test`);
  const b = await cadastrar(`b-${sufixo}@teste.test`);
  const categoriasA = (await requisitar('/api/categorias', a.token)).dados.categorias;
  const categoriasB = (await requisitar('/api/categorias', b.token)).dados.categorias;
  const fontesA = (await requisitar('/api/fontes-destinos', a.token)).dados.fontesDestinos;
  const fontesB = (await requisitar('/api/fontes-destinos', b.token)).dados.fontesDestinos;
  const contaA = fontesA.find((item) => item.nome === 'Conta corrente');
  const contaB = fontesB.find((item) => item.nome === 'Conta corrente');
  const categoriaSaidaA = categoriasA.find((item) => item.tipo === 'saida');
  const categoriaSaidaB = categoriasB.find((item) => item.tipo === 'saida');
  const categoriaEntradaA = categoriasA.find((item) => item.tipo === 'entrada');

  const proibido = await requisitar('/api/lancamentos', a.token, 'POST', {
    tipo: 'saida', descricao: 'Categoria errada', valor: '10.00', data: '2026-11-10',
    categoria_id: categoriaEntradaA.id, fonte_destino_id: contaA.id,
  });
  assert.equal(proibido.resposta.status, 400);

  const lancamentoB = await requisitar('/api/lancamentos', b.token, 'POST', {
    tipo: 'saida', descricao: 'Despesa privada', valor: '15.00', data: '2026-11-10',
    categoria_id: categoriaSaidaB.id, fonte_destino_id: contaB.id,
  });
  assert.equal(lancamentoB.resposta.status, 201);
  const idLancamentoB = lancamentoB.dados.lancamentos[0].id;

  assert.equal((await requisitar(`/api/lancamentos/${idLancamentoB}`, a.token)).resposta.status, 404);
  assert.equal((await requisitar(`/api/lancamentos/${idLancamentoB}`, a.token, 'PUT', {
    tipo: 'saida', descricao: 'Tentativa', valor: '1.00', data: '2026-11-10', categoria_id: categoriaSaidaA.id,
    fonte_destino_id: contaA.id,
  })).resposta.status, 404);
  assert.equal((await requisitar(`/api/lancamentos/${idLancamentoB}`, a.token, 'DELETE')).resposta.status, 404);

  const categoriaPrivada = categoriaSaidaB;
  assert.equal((await requisitar(`/api/categorias/${categoriaPrivada.id}`, a.token, 'PUT', { nome: 'Alterada', tipo: 'saida' })).resposta.status, 404);
  assert.equal((await requisitar(`/api/categorias/${categoriaPrivada.id}`, a.token, 'DELETE')).resposta.status, 404);
  assert.equal((await requisitar(`/api/fontes-destinos/${contaB.id}`, a.token, 'PUT', { nome: 'Alterada', tipo: 'conta' })).resposta.status, 404);
  assert.equal((await requisitar(`/api/fontes-destinos/${contaB.id}`, a.token, 'DELETE')).resposta.status, 404);

  const exclusaoCategoria = await requisitar(`/api/categorias/${categoriaSaidaB.id}`, b.token, 'DELETE');
  assert.equal(exclusaoCategoria.resposta.status, 409);

  const cartao = await requisitar('/api/fontes-destinos', b.token, 'POST', {
    nome: `Cartão de Teste ${sufixo}`, tipo: 'cartao_credito', dia_fechamento: 25,
    dia_vencimento: 5, limite: '3000.00',
  });
  assert.equal(cartao.resposta.status, 201);
  const parcelado = await requisitar('/api/lancamentos', b.token, 'POST', {
    tipo: 'saida', descricao: 'Compra em três vezes', valor: '100.00', data: '2026-11-10',
    categoria_id: categoriaSaidaB.id, fonte_destino_id: cartao.dados.fonteDestino.id, total_parcelas: 3,
  });
  assert.equal(parcelado.resposta.status, 201);
  assert.equal(parcelado.dados.lancamentos.length, 3);
  assert.equal(new Set(parcelado.dados.lancamentos.map((item) => item.grupo_parcelamento)).size, 1);
  const centavos = parcelado.dados.lancamentos.map((item) => Math.round(Number(item.valor) * 100));
  assert.deepEqual(centavos, [3334, 3333, 3333]);
  assert.equal(centavos.reduce((soma, item) => soma + item, 0), 10000);

  const porCategoria = await requisitar('/api/relatorios/categorias?inicio=2026-11-01&fim=2026-11-30', b.token);
  assert.equal(porCategoria.resposta.status, 200);
  assert.equal(porCategoria.dados.totalSaidas, '115.00');
  assert.equal(porCategoria.dados.saldo, '-115.00');
  assert.equal(porCategoria.dados.categoriasSaida.find((item) => item.id === categoriaSaidaB.id).percentual, 100);

  const porFonte = await requisitar('/api/relatorios/fontes-destinos?inicio=2026-11-01&fim=2026-11-30', b.token);
  assert.equal(porFonte.resposta.status, 200);
  assert.equal(porFonte.dados.totalSaidas, '115.00');

  const faturas = await requisitar('/api/relatorios/faturas?meses=3', b.token);
  assert.equal(faturas.resposta.status, 200);
  const cartaoFaturas = faturas.dados.cartoes.find((item) => item.id === cartao.dados.fonteDestino.id);
  assert.equal(cartaoFaturas.faturas.length, 4);
  assert.equal(cartaoFaturas.limiteUtilizado, '100.00');
  assert.match(cartaoFaturas.faturas[0].itens[0].descricaoParcela, /1\/3$/);
  assert.match(cartaoFaturas.faturas[1].itens[0].descricaoParcela, /2\/3$/);
  assert.match(cartaoFaturas.faturas[2].itens[0].descricaoParcela, /3\/3$/);

  const saudeB = await requisitar('/api/saude-financeira', b.token);
  assert.equal(saudeB.resposta.status, 200);
  assert.equal(saudeB.dados.projecao.length, 6);
  assert.equal(saudeB.dados.projecao[0].mes.length, 7);
  assert.ok('taxaPoupanca' in saudeB.dados.indicadores);
  assert.ok('reservaEmergencia' in saudeB.dados.indicadores);
  assert.ok(Array.isArray(saudeB.dados.dicas));
  const saudeSemToken = await requisitar('/api/saude-financeira', null);
  assert.equal(saudeSemToken.resposta.status, 401);
});
