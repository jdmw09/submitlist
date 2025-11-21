import { readFileSync } from 'fs';
import { join } from 'path';
import pool from '../config/database';

async function migrate() {
  try {
    console.log('Starting database migration...');

    const schemaSQL = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');

    await pool.query(schemaSQL);

    console.log('Database migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Database migration failed:', error);
    process.exit(1);
  }
}

migrate();
