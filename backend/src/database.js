const mysql = require('mysql2');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '', // Par défaut vide sur WAMP
  database: process.env.DB_NAME || 'frameset_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Wrapper pour utiliser les promesses (async/await)
const promisePool = pool.promise();

module.exports = promisePool;