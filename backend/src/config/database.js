import pg from 'pg';

// O pool reutiliza conexões com o PostgreSQL.
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
