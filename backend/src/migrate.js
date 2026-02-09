const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

const migrationsDir = path.join(__dirname, '..', 'migrations');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'frameset_db',
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  multipleStatements: true
});

const ensureMigrationsTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT NOT NULL AUTO_INCREMENT,
      filename VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
};

const getPendingMigrations = async () => {
  const [rows] = await pool.query('SELECT filename FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.filename));

  if (!fs.existsSync(migrationsDir)) {
    return [];
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  return files.filter((f) => !applied.has(f));
};

const run = async () => {
  try {
    await ensureMigrationsTable();
    const pending = await getPendingMigrations();

    if (pending.length === 0) {
      console.log('Aucune migration en attente.');
      return;
    }

    for (const file of pending) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8').trim();

      if (!sql) {
        console.log(`Migration ignorée (vide): ${file}`);
        await pool.query('INSERT INTO schema_migrations (filename) VALUES (?)', [file]);
        continue;
      }

      console.log(`Exécution de la migration: ${file}`);
      await pool.query(sql);
      await pool.query('INSERT INTO schema_migrations (filename) VALUES (?)', [file]);
      console.log(`Migration appliquée: ${file}`);
    }
  } catch (error) {
    console.error('Erreur migration:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

run();
