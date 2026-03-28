import mysql from 'mysql2/promise';
import { config } from './config.js';

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export async function query(sql, params = []) {
  const hasParams = Array.isArray(params) && params.length > 0;
  const [rows] = hasParams ? await pool.execute(sql, params) : await pool.query(sql);
  return rows;
}

export async function execute(sql, params = []) {
  const hasParams = Array.isArray(params) && params.length > 0;
  const [result] = hasParams ? await pool.execute(sql, params) : await pool.query(sql);
  return result;
}

export async function getConnection() {
  return pool.getConnection();
}

export async function pingDb() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}
