// Valida CPF pelos dois dígitos verificadores.
export function cpfValido(cpf) {
  const digitos = String(cpf ?? '').replace(/\D/g, '');
  if (digitos.length !== 11 || /^(\d)\1{10}$/.test(digitos)) return false;

  const calcularDigito = (base, pesoInicial) => {
    const soma = base.split('').reduce((total, digito, indice) => (
      total + Number(digito) * (pesoInicial - indice)
    ), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return calcularDigito(digitos.slice(0, 9), 10) === Number(digitos[9])
    && calcularDigito(digitos.slice(0, 10), 11) === Number(digitos[10]);
}

function ultimoDiaDoMes(ano, mes) {
  return new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
}

function dataSegura(ano, mes, dia) {
  const anoFinal = ano + Math.floor(mes / 12);
  const mesFinal = ((mes % 12) + 12) % 12;
  return new Date(Date.UTC(anoFinal, mesFinal, Math.min(dia, ultimoDiaDoMes(anoFinal, mesFinal))));
}

// Calcula fechamento e vencimento sem depender do fuso horário local.
export function calcularFatura(dataCompra, cartao, numeroParcela = 1) {
  const [ano, mes, dia] = String(dataCompra).slice(0, 10).split('-').map(Number);
  if (!ano || !mes || !dia || !Number.isInteger(numeroParcela) || numeroParcela < 1) {
    throw new TypeError('Data ou número da parcela inválido.');
  }
  const fechamentoDia = Number(cartao.diaFechamento ?? cartao.dia_fechamento);
  const vencimentoDia = Number(cartao.diaVencimento ?? cartao.dia_vencimento);
  if (![fechamentoDia, vencimentoDia].every((n) => Number.isInteger(n) && n >= 1 && n <= 31)) {
    throw new TypeError('Cartão precisa de dias de fechamento e vencimento válidos.');
  }

  let mesFechamento = mes - 1;
  const fechamentoDoMes = Math.min(fechamentoDia, ultimoDiaDoMes(ano, mesFechamento));
  if (dia >= fechamentoDoMes) mesFechamento += 1;
  mesFechamento += numeroParcela - 1;

  const fechamento = dataSegura(ano, mesFechamento, fechamentoDia);
  const mesDoFechamento = fechamento.getUTCMonth();
  const anoDoFechamento = fechamento.getUTCFullYear();
  const mesVencimento = vencimentoDia > fechamentoDia ? mesDoFechamento : mesDoFechamento + 1;
  const vencimento = dataSegura(anoDoFechamento, mesVencimento, vencimentoDia);
  const iso = (data) => data.toISOString().slice(0, 10);

  return {
    referencia: iso(vencimento).slice(0, 7),
    fechamento: iso(fechamento),
    vencimento: iso(vencimento),
  };
}

// Converte um valor em reais para centavos sem parsear números pelo locale.
export function valorEmCentavos(valor) {
  let totalCentavos;
  if (typeof valor === 'number') {
    totalCentavos = Math.round(valor * 100);
  } else {
    const texto = String(valor).trim().replace(',', '.');
    const partes = texto.match(/^(\d+)(?:\.(\d{1,2}))?$/);
    if (!partes) throw new TypeError('Valor deve ter no máximo duas casas decimais.');
    totalCentavos = Number(partes[1]) * 100 + Number((partes[2] ?? '').padEnd(2, '0'));
  }
  if (!Number.isSafeInteger(totalCentavos) || totalCentavos <= 0) {
    throw new TypeError('Valor precisa ser positivo e caber em centavos inteiros.');
  }
  return totalCentavos;
}

export function centavosParaDecimal(centavos) {
  if (!Number.isSafeInteger(centavos) || centavos <= 0) throw new TypeError('Centavos inválidos.');
  return `${Math.floor(centavos / 100)}.${String(centavos % 100).padStart(2, '0')}`;
}

// Divide centavos inteiros e distribui toda a sobra na primeira parcela.
export function dividirParcelas(valor, quantidade) {
  const totalCentavos = valorEmCentavos(valor);
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 48 || quantidade > totalCentavos) {
    throw new TypeError('Quantidade de parcelas deve estar entre 1 e 48.');
  }

  const base = Math.floor(totalCentavos / quantidade);
  const sobra = totalCentavos % quantidade;
  return Array.from({ length: quantidade }, (_, indice) => base + (indice === 0 ? sobra : 0));
}
