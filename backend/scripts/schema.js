import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/config/database.js';

const caminho = fileURLToPath(new URL('../database/schema.sql', import.meta.url));

try {
  const sql = await readFile(caminho, 'utf8');
  await pool.query(sql);
  console.log('Schema criado com sucesso.');
} catch (erro) {
  console.error('Não foi possível criar o schema:', erro.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
