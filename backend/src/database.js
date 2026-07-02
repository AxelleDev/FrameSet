/**
 * MySQL access: app-wide promise-based connection pool with ping() (health
 * checks) and closePool() (graceful shutdown) attached.
 */

const mysql = require('mysql2');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Expose the promise-based API so callers can use async/await.
const promisePool = pool.promise();

// Lightweight connectivity probe used by the /health endpoint.
promisePool.ping = async () => {
  await promisePool.query('SELECT 1');
};

// Closes all pooled connections; called during graceful shutdown.
promisePool.closePool = async () => promisePool.end();

module.exports = promisePool;