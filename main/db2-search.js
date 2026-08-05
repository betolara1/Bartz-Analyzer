// main/db2-search.js
// Busca desenho -> pedido diretamente no banco DB2 do ERP (bartznew).
// ITEMPED.ITEM (item do pedido) casa com ITEM.ITEM, e ITEM.NARRATIVA_1 guarda
// o código do desenho. NARRATIVA_1 não tem índice no banco (~2M linhas), então
// cada busca custa uns 2-3s — ainda assim mais rápido e mais confiável que
// varrer a pasta de rede.
const ibmdb = require('ibm_db');

const DB2_HOST = '192.168.1.10';
const DB2_PORT = 50000;
const DB2_DATABASE = 'bartznew';
const DB2_USER = 'db2admin';
const DB2_PASSWORD = '@db2bartz';

const CONNECT_TIMEOUT_SEC = 5;
const OVERALL_TIMEOUT_MS = 10000;

function getConnStr() {
  return `DATABASE=${DB2_DATABASE};HOSTNAME=${DB2_HOST};PORT=${DB2_PORT};PROTOCOL=TCPIP;UID=${DB2_USER};PWD=${DB2_PASSWORD};CONNECTTIMEOUT=${CONNECT_TIMEOUT_SEC};`;
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout (${label})`)), ms)),
  ]);
}

function openConnection() {
  return withTimeout(new Promise((resolve, reject) => {
    ibmdb.open(getConnStr(), (err, conn) => {
      if (err) reject(err);
      else resolve(conn);
    });
  }), OVERALL_TIMEOUT_MS, 'conexão DB2');
}

function runQuery(conn, sql) {
  return withTimeout(new Promise((resolve, reject) => {
    conn.query(sql, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  }), OVERALL_TIMEOUT_MS, 'query DB2');
}

function closeConnection(conn) {
  return new Promise((resolve) => conn.close(() => resolve()));
}

function escapeSqlLiteral(value) {
  return String(value).replace(/'/g, "''");
}

// Busca, para cada código de desenho, o pedido correspondente no DB2.
// Roda as buscas em paralelo (uma conexão por busca) já que cada query
// isolada gira em torno de 2-3s por falta de índice em NARRATIVA_1.
async function findPedidosInDb2(codes) {
  const found = new Map();
  const uniqueCodes = Array.from(new Set((codes || []).map((c) => String(c).trim().toUpperCase()).filter(Boolean)));
  if (uniqueCodes.length === 0) return found;

  await Promise.all(uniqueCodes.map(async (code) => {
    let conn;
    try {
      conn = await openConnection();
      const safeCode = escapeSqlLiteral(code);
      const rows = await runQuery(conn, `
        SELECT ip.NRO_PEDIDO
        FROM ITEMPED ip
        JOIN ITEM i ON TRIM(i.ITEM) = TRIM(ip.ITEM)
        WHERE i.NARRATIVA_1 = '${safeCode}'
        FETCH FIRST 1 ROWS ONLY
      `);
      if (rows && rows.length > 0 && rows[0].NRO_PEDIDO) {
        found.set(code, { pedido: String(rows[0].NRO_PEDIDO) });
      }
    } catch (e) {
      console.error(`[DB2] Erro buscando desenho ${code}:`, e.message || e);
    } finally {
      if (conn) await closeConnection(conn);
    }
  }));

  return found;
}

module.exports = { findPedidosInDb2 };
