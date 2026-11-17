import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularFatura, cpfValido, dividirParcelas } from './utilitarios.js';

test('valida CPF pontuado e rejeita dígitos repetidos ou inválidos', () => {
  assert.equal(cpfValido('529.982.247-25'), true);
  assert.equal(cpfValido('111.111.111-11'), false);
  assert.equal(cpfValido('52998224724'), false);
});

test('calcula os quatro exemplos da tabela 10.3', () => {
  const nubank = { diaFechamento: 3, diaVencimento: 10 };
  const visa = { diaFechamento: 25, diaVencimento: 5 };
  assert.deepEqual(calcularFatura('2026-11-02', nubank), {
    referencia: '2026-11', fechamento: '2026-11-03', vencimento: '2026-11-10',
  });
  assert.deepEqual(calcularFatura('2026-11-03', nubank), {
    referencia: '2026-12', fechamento: '2026-12-03', vencimento: '2026-12-10',
  });
  assert.deepEqual(calcularFatura('2026-12-28', visa), {
    referencia: '2027-02', fechamento: '2027-01-25', vencimento: '2027-02-05',
  });
  assert.deepEqual(calcularFatura('2026-12-20', visa, 3), {
    referencia: '2027-03', fechamento: '2027-02-25', vencimento: '2027-03-05',
  });
});

test('ajusta fechamento no dia 31 ao último dia de fevereiro', () => {
  assert.deepEqual(calcularFatura('2027-02-28', {
    diaFechamento: 31, diaVencimento: 31,
  }), {
    referencia: '2027-04', fechamento: '2027-03-31', vencimento: '2027-04-30',
  });
});

test('divide centavos com a sobra na primeira parcela', () => {
  assert.deepEqual(dividirParcelas('100.00', 3), [3334, 3333, 3333]);
  assert.deepEqual(dividirParcelas(10, 4), [250, 250, 250, 250]);
  assert.deepEqual(dividirParcelas('12,34', 2), [617, 617]);
  assert.equal(dividirParcelas('100.00', 3).reduce((soma, v) => soma + v, 0), 10000);
});
