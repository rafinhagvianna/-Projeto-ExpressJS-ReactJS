export const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function dataBrasileira(valor) {
  if (!valor) return '—';
  const [ano, mes, dia] = String(valor).slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

export function mascaraDinheiro(valor) {
  const digitos = String(valor).replace(/\D/g, '');
  const centavos = Number(digitos || 0);
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(centavos / 100);
}

export function dinheiroParaApi(valor) {
  const centavos = Number(String(valor).replace(/\D/g, '') || 0);
  return (centavos / 100).toFixed(2);
}
