// main/db2-search.js
// Busca desenho -> pedido diretamente no banco DB2 do ERP (bartznew).
// ITEMPED.ITEM (item do pedido) casa com ITEM.ITEM, e ITEM.NARRATIVA_1 guarda
// o código do desenho. NARRATIVA_1 não tem índice no banco (~2M linhas), então
// cada busca custa uns 2-3s — ainda assim mais rápido e mais confiável que
// varrer a pasta de rede.
const path = require('path');
const fs = require('fs');

const DB2_HOST = '192.168.1.10';
const DB2_PORT = 50000;
const DB2_DATABASE = 'bartznew';
const DB2_USER = 'db2admin';
const DB2_PASSWORD = '@db2bartz';

const CONNECT_TIMEOUT_SEC = 5;
const OVERALL_TIMEOUT_MS = 10000;

let ibmdbInstance = null;
let ibmdbInitError = null;

function getIbmDb() {
  if (ibmdbInstance) return ibmdbInstance;
  if (ibmdbInitError) return null;

  try {
    // Localizar a pasta raiz do módulo ibm_db
    let ibmDbDir = path.dirname(require.resolve('ibm_db/package.json'));
    // Se o aplicativo estiver empacotado no Electron, converter app.asar -> app.asar.unpacked
    if (ibmDbDir.includes('app.asar') && !ibmDbDir.includes('app.asar.unpacked')) {
      ibmDbDir = ibmDbDir.replace('app.asar', 'app.asar.unpacked');
    }

    const clidriverDir = path.join(ibmDbDir, 'installer', 'clidriver');
    const binDir = path.join(clidriverDir, 'bin');
    const libDir = path.join(clidriverDir, 'lib');
    const vc14Dir = path.join(binDir, 'amd64.VC14.CRT');
    const vc12Dir = path.join(binDir, 'amd64.VC12.CRT');
    const iccDir = path.join(binDir, 'icc64');

    if (fs.existsSync(binDir)) {
      process.env.IBM_DB_HOME = clidriverDir;
      const pathsToAdd = [binDir, libDir, vc14Dir, vc12Dir, iccDir].filter(p => fs.existsSync(p));
      process.env.PATH = `${pathsToAdd.join(';')};${process.env.PATH || ''}`;
    }

    ibmdbInstance = require('ibm_db');
    return ibmdbInstance;
  } catch (err) {
    ibmdbInitError = err;
    console.error('[DB2 Search] Erro ao carregar módulo ibm_db:', String(err && err.message || err));
    return null;
  }
}

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
  const ibmdb = getIbmDb();
  if (!ibmdb) return Promise.reject(new Error('Módulo ibm_db não está disponível.'));
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

  const ibmdb = getIbmDb();
  if (!ibmdb) {
    console.warn('[DB2 Search] ibm_db não inicializado. Ignorando busca no DB2.');
    return found;
  }

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
