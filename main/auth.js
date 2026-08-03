// main/auth.js
// Autenticação de usuários diretamente via banco de dados MySQL (tabela tab_usuario)
const { ipcMain } = require("electron");
const fse = require("fs-extra");
const mysql = require("mysql2/promise");
const crypto = require("crypto");
const state = require("./state");
const { loadCfg } = require("./helpers");

/**
 * Função utilitária para gerar hash de senha no formato MySQL 4.1+ PASSWORD():
 * '*' + SHA1(SHA1(password)).toUpperCase()
 */
function hashPasswordMySQL41(plainPassword) {
  if (!plainPassword) return "";
  const stage1 = crypto.createHash("sha1").update(plainPassword).digest();
  const stage2 = crypto.createHash("sha1").update(stage1).digest("hex").toUpperCase();
  return "*" + stage2;
}

/**
 * Autentica o usuário no banco de dados MySQL (tab_usuario)
 */
async function authenticateUser(username, password) {
  const cfg = state.currentCfg || (await loadCfg());

  const dbHost = (cfg.dbHost || "mysql55-farm2.uni5.net").trim();
  const dbPort = Number(cfg.dbPort) || 3306;
  const dbUser = (cfg.dbUser || "bartzpedidosph").trim();
  const dbPassword = cfg.dbPassword !== undefined && cfg.dbPassword !== "" ? cfg.dbPassword : "mangaROSA2006";
  const dbName = (cfg.dbName || "bartzpedidosph").trim();

  let connection;
  try {
    connection = await mysql.createConnection({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      connectTimeout: 7000,
    });
  } catch (err) {
    console.error("[Auth] Erro ao conectar ao MySQL:", err.message);
    return {
      ok: false,
      message: `Não foi possível conectar ao banco de dados (${dbHost}:${dbPort}). Verifique a conexão nas Opções. (${err.message})`,
    };
  }

  try {
    const cleanUsername = username.trim();
    const [rows] = await connection.execute(
      "SELECT pk_usuario, txt_login, txt_nome, txt_senha, num_tipo_usuario, pk_representante, pk_ponto_venda FROM tab_usuario WHERE BINARY txt_login = ? OR txt_login = ?",
      [cleanUsername, cleanUsername]
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      return { ok: false, message: "Usuário não encontrado." };
    }

    const userRow = rows[0];
    const storedHash = (userRow.txt_senha || "").trim();

    // 1. Hash MySQL 4.1+ (ex: *D8C249EE37A0B15E18E5BF41EC789CD46F1C1A3F)
    const computedHash = hashPasswordMySQL41(password);
    
    // 2. Outros métodos de verificação (texto puro, sha1 direto, md5)
    const sha1Direct = crypto.createHash("sha1").update(password).digest("hex").toUpperCase();
    const md5Direct = crypto.createHash("md5").update(password).digest("hex").toLowerCase();

    const isMatch =
      storedHash.toUpperCase() === computedHash.toUpperCase() ||
      storedHash === password ||
      storedHash.toUpperCase() === sha1Direct ||
      storedHash.toLowerCase() === md5Direct;

    if (!isMatch) {
      return { ok: false, message: "Senha incorreta." };
    }

    // Buscar permissões do usuário em tab_usuario_permissao
    let permissions = [];
    try {
      const [permRows] = await connection.execute(
        "SELECT pk_permissao FROM tab_usuario_permissao WHERE pk_usuario = ?",
        [userRow.pk_usuario]
      );
      if (Array.isArray(permRows)) {
        permissions = permRows.map((r) => Number(r.pk_permissao));
      }
    } catch (permErr) {
      console.error("[Auth] Erro ao buscar permissões do usuário:", permErr.message);
    }

    // Login bem-sucedido — salvar sessão em cache local
    const sessionData = {
      pk_usuario: userRow.pk_usuario,
      txt_login: userRow.txt_login,
      txt_nome: userRow.txt_nome || userRow.txt_login,
      num_tipo_usuario: userRow.num_tipo_usuario,
      pk_representante: userRow.pk_representante,
      pk_ponto_venda: userRow.pk_ponto_venda,
      permissions: permissions,
      loggedAt: new Date().toISOString(),
    };

    await fse.ensureFile(state.USER_SESSION_FILE);
    await fse.writeJson(state.USER_SESSION_FILE, sessionData, { spaces: 2 });
    console.log(`[Auth] Usuário '${userRow.txt_login}' logado com permissões:`, permissions);

    return { ok: true, user: sessionData };
  } catch (queryErr) {
    console.error("[Auth] Erro na consulta SQL:", queryErr.message);
    return { ok: false, message: `Erro ao consultar usuário: ${queryErr.message}` };
  } finally {
    if (connection) {
      try {
        await connection.end();
      } catch (e) {}
    }
  }
}

// Handler IPC: Realizar Login
ipcMain.handle("auth:login", async (_e, { username, password }) => {
  if (!username || !password) {
    return { ok: false, message: "Informe o usuário e a senha." };
  }
  return await authenticateUser(username, password);
});

// Handler IPC: Obter Sessão Salva (Cache)
ipcMain.handle("auth:getSession", async () => {
  try {
    if (await fse.pathExists(state.USER_SESSION_FILE)) {
      const session = await fse.readJson(state.USER_SESSION_FILE);
      if (session && session.txt_login) {
        // Tentar atualizar permissões ao iniciar
        try {
          const cfg = state.currentCfg || (await loadCfg());
          const dbHost = (cfg.dbHost || "mysql55-farm2.uni5.net").trim();
          const dbPort = Number(cfg.dbPort) || 3306;
          const dbUser = (cfg.dbUser || "bartzpedidosph").trim();
          const dbPassword = cfg.dbPassword !== undefined && cfg.dbPassword !== "" ? cfg.dbPassword : "mangaROSA2006";
          const dbName = (cfg.dbName || "bartzpedidosph").trim();

          const conn = await mysql.createConnection({
            host: dbHost,
            port: dbPort,
            user: dbUser,
            password: dbPassword,
            database: dbName,
            connectTimeout: 4000,
          });

          const [permRows] = await conn.execute(
            "SELECT pk_permissao FROM tab_usuario_permissao WHERE pk_usuario = ?",
            [session.pk_usuario]
          );
          if (Array.isArray(permRows)) {
            session.permissions = permRows.map((r) => Number(r.pk_permissao));
          }
          await conn.end();
          await fse.writeJson(state.USER_SESSION_FILE, session, { spaces: 2 });
        } catch (e) {
          // Mantém as permissões existentes no cache local se falhar a atualização off-line
        }

        return { ok: true, user: session };
      }
    }
  } catch (e) {
    console.error("[Auth] Erro ao ler sessão:", e.message);
  }
  return { ok: false, user: null };
});

// Handler IPC: Logout (Deslogar)
ipcMain.handle("auth:logout", async () => {
  try {
    if (await fse.pathExists(state.USER_SESSION_FILE)) {
      await fse.remove(state.USER_SESSION_FILE);
    }
    console.log("[Auth] Sessão de usuário removida (logout).");
    return { ok: true };
  } catch (e) {
    console.error("[Auth] Erro ao deslogar:", e.message);
    return { ok: false, message: e.message };
  }
});
