import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { pool } from '../src/config/database.js';

const schemaPath = fileURLToPath(new URL('../database/schema.sql', import.meta.url));
try {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await pool.query(await readFile(schemaPath, 'utf8'));
  console.log('Schema recriado. Carregando dados de demonstração…');
} catch (erro) {
  console.error('Não foi possível recriar o banco:', erro.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

if (!process.exitCode) {
  const resultado = spawnSync(process.execPath, ['database/seed.js'], { stdio: 'inherit' });
  if (resultado.error) { console.error(resultado.error.message); process.exitCode = 1; }
  else process.exitCode = resultado.status ?? 1;
}
