import 'dotenv/config';
import bcrypt from 'bcrypt';
import { pool } from '../src/config/database.js';

const cliente = await pool.connect();

async function criarUsuario({ nome, email, cpf, senha }) {
  const senhaHash = await bcrypt.hash(senha, 10);
  const { rows: [usuario] } = await cliente.query(
    `INSERT INTO usuarios (nome, email, cpf, senha_hash)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [nome, email, cpf, senhaHash],
  );

  const categorias = [
    ['Salário', 'entrada'], ['Freelance', 'entrada'], ['Rendimentos', 'entrada'],
    ['Alimentação', 'saida'], ['Moradia', 'saida'], ['Saúde', 'saida'],
    ['Mobilidade', 'saida'], ['Lazer', 'saida'], ['Educação', 'saida'], ['Outros', 'saida'],
  ];
  const idsCategorias = {};
  for (const [categoria, tipo] of categorias) {
    const { rows: [linha] } = await cliente.query(
      `INSERT INTO categorias (usuario_id, nome, tipo) VALUES ($1, $2, $3) RETURNING id`,
      [usuario.id, categoria, tipo],
    );
    idsCategorias[categoria] = linha.id;
  }

  const fontes = {};
  const fontesSeed = [
    ['Conta corrente', 'conta', null, null, null, false],
    ['Poupança', 'conta', null, null, null, true],
    ['Salário', 'renda', null, null, null, false],
    ['Nubank', 'cartao_credito', 3, 10, 5000, false],
    ['Visa', 'cartao_credito', 25, 5, 8000, false],
  ];
  for (const [nomeFonte, tipo, diaFechamento, diaVencimento, limite, reserva] of fontesSeed) {
    const { rows: [linha] } = await cliente.query(
      `INSERT INTO fontes_destinos
        (usuario_id, nome, tipo, dia_fechamento, dia_vencimento, limite, reserva)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [usuario.id, nomeFonte, tipo, diaFechamento, diaVencimento, limite, reserva],
    );
    fontes[nomeFonte] = linha.id;
  }

  return { usuario, categorias: idsCategorias, fontes };
}

async function inserirLancamento(usuario, { descricao, tipo, valor, data, categoria, fonte, parcela = 1, total = 1, grupo = null }) {
  await cliente.query(
    `INSERT INTO lancamentos
      (usuario_id, descricao, tipo, valor, data, categoria_id, fonte_destino_id,
       parcela_atual, total_parcelas, grupo_parcelamento)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [usuario.id, descricao, tipo, valor, data, usuario.categorias[categoria], usuario.fontes[fonte], parcela, total, grupo],
  );
}

try {
  await cliente.query('BEGIN');
  await cliente.query('TRUNCATE lancamentos, fontes_destinos, categorias, usuarios RESTART IDENTITY CASCADE');

  const demo = await criarUsuario({
    nome: 'Marina Demonstração', email: 'marina@financas.test', cpf: '52998224725', senha: 'Marina1234',
  });
  const outro = await criarUsuario({
    nome: 'Rafael Demonstração', email: 'rafael@financas.test', cpf: '11144477735', senha: 'Rafael1234',
  });

  const amostras = [
    { descricao: 'Salário setembro', tipo: 'entrada', valor: '5200.00', data: '2026-09-05', categoria: 'Salário', fonte: 'Salário' },
    { descricao: 'Aluguel setembro', tipo: 'saida', valor: '1650.00', data: '2026-09-08', categoria: 'Moradia', fonte: 'Conta corrente' },
    { descricao: 'Mercado setembro', tipo: 'saida', valor: '430.75', data: '2026-09-12', categoria: 'Alimentação', fonte: 'Nubank' },
    { descricao: 'Reserva setembro', tipo: 'saida', valor: '300.00', data: '2026-09-15', categoria: 'Outros', fonte: 'Poupança' },
    { descricao: 'Salário outubro', tipo: 'entrada', valor: '5200.00', data: '2026-10-05', categoria: 'Salário', fonte: 'Salário' },
    { descricao: 'Consulta outubro', tipo: 'saida', valor: '220.00', data: '2026-10-09', categoria: 'Saúde', fonte: 'Conta corrente' },
    { descricao: 'Notebook (parcela)', tipo: 'saida', valor: '600.00', data: '2026-10-24', categoria: 'Educação', fonte: 'Visa', parcela: 1, total: 3, grupo: 'b662ff31-20c2-4a91-af77-2276cd5fb211' },
    { descricao: 'Notebook (parcela)', tipo: 'saida', valor: '600.00', data: '2026-10-24', categoria: 'Educação', fonte: 'Visa', parcela: 2, total: 3, grupo: 'b662ff31-20c2-4a91-af77-2276cd5fb211' },
    { descricao: 'Notebook (parcela)', tipo: 'saida', valor: '600.00', data: '2026-10-24', categoria: 'Educação', fonte: 'Visa', parcela: 3, total: 3, grupo: 'b662ff31-20c2-4a91-af77-2276cd5fb211' },
    { descricao: 'Compra no fechamento', tipo: 'saida', valor: '89.90', data: '2026-10-25', categoria: 'Lazer', fonte: 'Visa' },
    { descricao: 'Salário novembro', tipo: 'entrada', valor: '5200.00', data: '2026-11-05', categoria: 'Salário', fonte: 'Salário' },
    { descricao: 'Mercado novembro', tipo: 'saida', valor: '510.00', data: '2026-11-11', categoria: 'Alimentação', fonte: 'Nubank' },
    { descricao: 'Cinema novembro', tipo: 'saida', valor: '75.00', data: '2026-11-14', categoria: 'Lazer', fonte: 'Conta corrente' },
  ];
  for (const amostra of amostras) await inserirLancamento(demo, amostra);

  await inserirLancamento(outro, {
    descricao: 'Renda outubro', tipo: 'entrada', valor: '4200.00', data: '2026-10-10', categoria: 'Salário', fonte: 'Salário',
  });
  await inserirLancamento(outro, {
    descricao: 'Transporte outubro', tipo: 'saida', valor: '160.00', data: '2026-10-18', categoria: 'Mobilidade', fonte: 'Conta corrente',
  });

  await cliente.query('COMMIT');
  console.log('Seed concluído. Usuários: marina@financas.test / Marina1234 e rafael@financas.test / Rafael1234.');
} catch (erro) {
  await cliente.query('ROLLBACK');
  console.error('Falha ao carregar seed:', erro.message);
  process.exitCode = 1;
} finally {
  cliente.release();
  await pool.end();
}
