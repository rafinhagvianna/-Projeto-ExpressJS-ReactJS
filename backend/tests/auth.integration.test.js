import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { app } from '../src/server.js';
import { pool } from '../src/config/database.js';

const executar = Boolean(process.env.DATABASE_URL);
let servidor;
let baseUrl;
let usuarioCriado;

function gerarCpfTeste() {
  let base = randomUUID().replace(/\D/g, '').padEnd(9, '0').slice(0, 9);
  if (/^(\d)\1{8}$/.test(base)) base = `12${base.slice(2)}`;
  const digito = (prefixo) => {
    const soma = prefixo.split('').reduce((total, n, indice) => total + Number(n) * (prefixo.length + 1 - indice), 0);
    const resto = (soma * 10) % 11;
    return String(resto === 10 ? 0 : resto);
  };
  base += digito(base);
  return base + digito(base);
}

before(async () => {
  servidor = app.listen(0);
  await new Promise((resolver) => servidor.once('listening', resolver));
  baseUrl = `http://127.0.0.1:${servidor.address().port}`;
});

after(async () => {
  if (usuarioCriado) await pool.query('DELETE FROM usuarios WHERE id = $1', [usuarioCriado]);
  await new Promise((resolver, rejeitar) => servidor.close((erro) => erro ? rejeitar(erro) : resolver()));
  await pool.end();
});

test('rotas protegidas recusam token ausente ou inválido', async () => {
  const semToken = await fetch(`${baseUrl}/api/auth/me`);
  assert.equal(semToken.status, 401);
  const invalido = await fetch(`${baseUrl}/api/auth/me`, { headers: { Authorization: 'Bearer token-invalido' } });
  assert.equal(invalido.status, 401);
});

test('responde com erro padronizado para JSON malformado e rota inexistente', async () => {
  const jsonInvalido = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
  });
  assert.equal(jsonInvalido.status, 400);
  assert.ok((await jsonInvalido.json()).erro);
  const inexistente = await fetch(`${baseUrl}/api/nao-existe`);
  assert.equal(inexistente.status, 404);
  assert.ok((await inexistente.json()).erro);
});

test('cadastro, normalização, login genérico e token', { skip: !executar }, async () => {
  const identificador = randomUUID();
  const email = `teste-${identificador}@financas.test`;
  const corpo = {
    nome: 'Pessoa de Teste', email: ` ${email.toUpperCase()} `, cpf: gerarCpfTeste(),
    senha: 'Senha1234', confirmarSenha: 'Senha1234',
  };

  const cadastro = await fetch(`${baseUrl}/api/auth/cadastro`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
  });
  assert.equal(cadastro.status, 201);
  const dadosCadastro = await cadastro.json();
  usuarioCriado = dadosCadastro.usuario.id;
  assert.equal(dadosCadastro.usuario.email, email);
  assert.equal(JSON.stringify(dadosCadastro).includes('senha_hash'), false);

  const duplicadoEmail = await fetch(`${baseUrl}/api/auth/cadastro`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...corpo, email: email.toUpperCase(), cpf: gerarCpfTeste() }),
  });
  assert.equal(duplicadoEmail.status, 409);
  assert.ok((await duplicadoEmail.json()).campos.email);

  const duplicadoCpf = await fetch(`${baseUrl}/api/auth/cadastro`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...corpo, email: `outro-${identificador}@financas.test` }),
  });
  assert.equal(duplicadoCpf.status, 409);
  assert.ok((await duplicadoCpf.json()).campos.cpf);

  const loginInvalido = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'inexistente@financas.test', senha: 'Senha1234' }),
  });
  assert.equal(loginInvalido.status, 401);
  assert.equal((await loginInvalido.json()).erro, 'E-mail ou senha inválidos.');

  const semToken = await fetch(`${baseUrl}/api/auth/me`);
  assert.equal(semToken.status, 401);

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha: 'Senha1234' }),
  });
  assert.equal(login.status, 200);
  const dadosLogin = await login.json();
  assert.ok(dadosLogin.token);
  assert.equal(JSON.stringify(dadosLogin).includes('senha_hash'), false);

  const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { Authorization: `Bearer ${dadosLogin.token}` } });
  assert.equal(me.status, 200);
  assert.equal(JSON.stringify(await me.json()).includes('senha_hash'), false);
});
