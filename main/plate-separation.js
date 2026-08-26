// main/plate-separation.js
// Gestão e leitura dos arquivos de controle de Separação de Chapas (.json e .pdf)
const { ipcMain, shell } = require("electron");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const { PDFParse } = require("pdf-parse");

const DEFAULT_CONTROLE_DIR = "\\\\192.168.1.10\\DatabaseFolder\\PDF\\_controle";

/**
 * Faz o parser do texto extraído do PDF Promob de Separação de Chapas
 */
function parsePromobPdf(rawText) {
  if (!rawText) return { loteTitle: "", items: [] };
  const lines = rawText.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
  let loteTitle = "";
  const items = [];
  const codeRegex = /\b(\d{2}\.\d{2}\.\d{3,4})\b/;

  for (const line of lines) {
    if (
      line.startsWith("PROMOB") ||
      line.startsWith("--") ||
      line.includes("SEPARAÇÃO") ||
      line.includes("Código") ||
      line.includes("Quantidade") ||
      line === "Lote:" ||
      line === "Resp:"
    ) {
      continue;
    }

    const loteMatch = line.match(/^(\d{3,6})\s+(.*)$/);
    if (loteMatch && !codeRegex.test(line)) {
      loteTitle = loteMatch[2].trim();
      continue;
    }

    const codeMatch = line.match(codeRegex);
    if (codeMatch) {
      const code = codeMatch[1];
      const parts = line.split(code);
      const desc = parts[0].trim().replace(/\t+/g, " ");
      const rest = (parts[1] || "").trim();
      const numMatches = rest.match(/(\d+(?:[.,]\d+)?)/g) || [];
      let qty = "";
      let metros = "";
      if (numMatches.length >= 2) {
        qty = numMatches[0];
        metros = numMatches[1];
      } else if (numMatches.length === 1) {
        qty = numMatches[0];
      }
      items.push({
        codigo: code,
        descricao: desc,
        quantidade: qty,
        metros: metros,
      });
    }
  }

  return { loteTitle, items };
}

const DB2_HOST = '192.168.1.10';
const DB2_PORT = 50000;
const DB2_DATABASE = 'bartznew';
const DB2_USER = 'db2admin';
const DB2_PASSWORD = '@db2bartz';

let ibmdbInstance = null;
let ibmdbInitError = null;

function getIbmDb() {
  if (ibmdbInstance) return ibmdbInstance;
  if (ibmdbInitError) return null;

  try {
    let ibmDbDir = path.dirname(require.resolve('ibm_db/package.json'));
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
    console.error('[PlateSeparation DB2] Erro ao carregar módulo ibm_db:', String(err && err.message || err));
    return null;
  }
}

function getConnStr() {
  return `DATABASE=${DB2_DATABASE};HOSTNAME=${DB2_HOST};PORT=${DB2_PORT};PROTOCOL=TCPIP;UID=${DB2_USER};PWD=${DB2_PASSWORD};CONNECTTIMEOUT=5;`;
}

function openDb2Connection() {
  const ibmdb = getIbmDb();
  if (!ibmdb) return Promise.reject(new Error('Módulo ibm_db não está disponível.'));
  return new Promise((resolve, reject) => {
    ibmdb.open(getConnStr(), (err, conn) => {
      if (err) reject(err);
      else resolve(conn);
    });
  });
}

function closeDb2Connection(conn) {
  if (!conn) return Promise.resolve();
  return new Promise((resolve) => conn.close(() => resolve()));
}

function runDb2Query(conn, sql, params = []) {
  return new Promise((resolve, reject) => {
    conn.query(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

/**
 * Lê todos os arquivos JSON da pasta de controle e mescla com os dados dos PDFs
 */
ipcMain.handle("analyzer:getPlateSeparationData", async (_e, customDir) => {
  const targetDir = customDir && typeof customDir === "string" ? customDir : DEFAULT_CONTROLE_DIR;

  try {
    const exists = await fsp.access(targetDir).then(() => true).catch(() => false);
    if (!exists) {
      return {
        ok: false,
        message: `Diretório não acessível: ${targetDir}`,
        folderPath: targetDir,
        data: [],
        count: 0,
      };
    }

    const files = await fsp.readdir(targetDir);
    const jsonFiles = files.filter((f) => f.toLowerCase().endsWith(".json"));
    const parentDir = path.dirname(targetDir);

    const items = await Promise.all(
      jsonFiles.map(async (fileName) => {
        const filePath = path.join(targetDir, fileName);
        const baseName = fileName.replace(/\.json$/i, "");
        const pdfPath = path.join(parentDir, `${baseName}.pdf`);
        const pdfUpperPath = path.join(parentDir, `${baseName}.PDF`);

        let pdfExists = false;
        let finalPdfPath = pdfPath;

        try {
          if (await fsp.access(pdfPath).then(() => true).catch(() => false)) {
            pdfExists = true;
            finalPdfPath = pdfPath;
          } else if (await fsp.access(pdfUpperPath).then(() => true).catch(() => false)) {
            pdfExists = true;
            finalPdfPath = pdfUpperPath;
          }
        } catch {
          pdfExists = false;
        }

        let content = null;
        let stats = null;

        try {
          stats = await fsp.stat(filePath);
        } catch {
          // stats error
        }

        try {
          const raw = await fsp.readFile(filePath, "utf8");
          content = JSON.parse(raw);
        } catch (parseErr) {
          content = { error: `Erro ao ler/interpretar JSON: ${parseErr.message}` };
        }

        // Tentar ler e fazer parse do PDF correspondente
        let pdfData = { loteTitle: "", items: [] };
        if (pdfExists) {
          try {
            const pdfBuf = await fsp.readFile(finalPdfPath);
            const pdfParser = new PDFParse({ data: pdfBuf });
            const textResult = await pdfParser.getText();
            pdfData = parsePromobPdf(textResult?.text || "");
          } catch (pdfErr) {
            console.error(`[PlateSeparation] Erro ao extrair texto do PDF ${finalPdfPath}:`, pdfErr);
          }
        }

        // Mesclar itens do PDF com itens do JSON de controle
        const jsonItens = content?.itens || {};
        const maxCount = Math.max(
          pdfData.items.length,
          Object.keys(jsonItens).length
        );

        const tableItems = [];
        for (let i = 0; i < maxCount; i++) {
          const pdfItem = pdfData.items[i] || {};
          const jsonItem = jsonItens[String(i)] || jsonItens[i] || {};

          tableItems.push({
            index: i,
            codigo: pdfItem.codigo || "",
            descricao: pdfItem.descricao || "",
            metros: pdfItem.metros || "",
            quantidade: pdfItem.quantidade || "",
            qtde_real: jsonItem.qtde_real !== undefined ? String(jsonItem.qtde_real) : "",
            obs: jsonItem.obs !== undefined ? String(jsonItem.obs) : "",
          });
        }

        return {
          id: baseName,
          fileName,
          filePath,
          pdfPath: finalPdfPath,
          pdfExists,
          size: stats ? stats.size : 0,
          mtime: stats ? stats.mtime.toISOString() : null,
          birthtime: stats ? stats.birthtime.toISOString() : null,
          responsavel: content?.responsavel || "",
          status: content?.status || "pendente",
          prioridade: Boolean(content?.prioridade),
          concluido_em: content?.concluido_em || "",
          concluido_por: content?.concluido_por || "",
          lancado_erp: content?.lancado_erp || null,
          loteTitle: pdfData.loteTitle || "",
          comentarios: Array.isArray(content?.comentarios) ? content.comentarios : [],
          tableItems,
          rawJson: content,
        };
      })
    );

    // Ordenar pelos mais recentes por padrão
    items.sort((a, b) => {
      const timeA = a.mtime ? new Date(a.mtime).getTime() : 0;
      const timeB = b.mtime ? new Date(b.mtime).getTime() : 0;
      return timeB - timeA;
    });

    return {
      ok: true,
      data: items,
      folderPath: targetDir,
      count: items.length,
    };
  } catch (err) {
    console.error("[PlateSeparation] Erro ao ler pasta de controle:", err);
    return {
      ok: false,
      message: err?.message || String(err),
      folderPath: targetDir,
      data: [],
      count: 0,
    };
  }
});

/**
 * Retorna preview das informações para lançamento de movimento no ERP
 */
ipcMain.handle("analyzer:getPlateSeparationErpPreview", async (_e, _loteId) => {
  let conn;
  try {
    conn = await openDb2Connection();
    const rows = await runDb2Query(conn, "SELECT PRX_DOCUMENT FROM DB2ADMIN.PARAMES FETCH FIRST 1 ROWS ONLY");
    const nextDoc = rows && rows.length > 0 ? Number(rows[0].PRX_DOCUMENT) : null;

    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    const dateFormatted = `${day}/${month}/${year}`;

    return {
      ok: true,
      nextDocument: nextDoc,
      tipoTransacao: "RM",
      tipoTransacaoNome: "REQUISICAO MATERIAIS",
      codigoDeposito: 1,
      depositoNome: "ALMOXARIFADO",
      codigoCcusto: 1,
      ccustoNome: "GERAL",
      dataMoviment: dateFormatted,
    };
  } catch (err) {
    console.error("[PlateSeparation] Erro ao obter preview ERP:", err);
    return {
      ok: false,
      message: `Não foi possível consultar o próximo número no ERP: ${err?.message || err}`,
    };
  } finally {
    if (conn) await closeDb2Connection(conn);
  }
});

/**
 * Efetua a inserção do Movimento de Estoque (RM) no banco DB2 do ERP (bartznew)
 */
ipcMain.handle("analyzer:postPlateSeparationMovement", async (_e, params) => {
  const { id, items, usuario, usuarioId, deposito = 1, centroCusto = 1, observacao = "" } = params || {};

  if (!id) {
    return { ok: false, message: "ID do lote não informado." };
  }

  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, message: "Nenhum item selecionado para lançamento." };
  }

  // Filtrar itens com quantidade válida maior que 0
  const validItems = items
    .map((it) => {
      const code = String(it.codigo || "").trim();
      const rawQty = it.qtde_real !== undefined && it.qtde_real !== "" ? it.qtde_real : it.quantidade;
      const numQty = parseFloat(String(rawQty || "0").replace(",", "."));
      return {
        codigo: code,
        descricao: String(it.descricao || "").trim(),
        metros: it.metros || "",
        quantidade: numQty,
        obs: it.obs || "",
      };
    })
    .filter((it) => it.codigo && it.quantidade > 0);

  if (validItems.length === 0) {
    return { ok: false, message: "Todos os itens selecionados possuem quantidade zerada ou inválida." };
  }

  let conn;
  try {
    conn = await openDb2Connection();

    const loteNum = parseInt(String(id).replace(/\D/g, ""), 10) || 0;
    const codUsuario = Number(usuarioId) || 0;
    const safeObs = String(observacao || `Separação de Chapas Lote ${id}`).replace(/'/g, "''");

    // 1+2. Reservar atomicamente o próximo número de documento:
    //       Primeiro incrementa, depois lê o valor resultante.
    //       O número do nosso documento é (valor_atualizado - 1).
    //       Retry em caso de conflito de chave duplicada (até 5 tentativas).
    let nroDocument = 0;
    let insertedDocument = false;

    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        // Incrementar PRX_DOCUMENT atomicamente (reservar o número)
        await runDb2Query(conn, "UPDATE DB2ADMIN.PARAMES SET PRX_DOCUMENT = PRX_DOCUMENT + 1 WHERE RECNUM = 1");

        // Ler o valor APÓS o incremento
        const pRows = await runDb2Query(conn, "SELECT PRX_DOCUMENT FROM DB2ADMIN.PARAMES WHERE RECNUM = 1");
        if (!pRows || pRows.length === 0 || !pRows[0].PRX_DOCUMENT) {
          throw new Error("Não foi possível ler o contador PRX_DOCUMENT em DB2ADMIN.PARAMES.");
        }

        // Nosso documento é o valor que acabamos de reservar (antes do incremento)
        nroDocument = Number(pRows[0].PRX_DOCUMENT) - 1;

        // 3. Inserir cabeçalho do documento em DB2ADMIN.DOCUMENT
        await runDb2Query(
          conn,
          `INSERT INTO DB2ADMIN.DOCUMENT (
            NRO_DOCUMENT, DT_MOVIMENT, SIGLA_TIPTRANS, CODIGO_CCUSTO, DOC_ORIGEM,
            CODIGO_CLIENTE, VL_TOTAL, FLAG_BAIXA, NRO_DOC_AUX, NRO_DOC_ENT,
            SERIE_NF, FLAG_IMPORTA, OBSERVACAO_1, USUARIOA, CODIGO_FORNEC, CODIGO_RESPONSA
          ) VALUES (
            ?, CURRENT DATE, 'RM   ', ?, '',
            0, 0, ' ', 0, 0,
            '   ', ' ', ?, ?, 0, 0
          )`,
          [nroDocument, centroCusto, safeObs.slice(0, 50), codUsuario]
        );

        insertedDocument = true;
        console.log(`[PlateSeparation] Documento RM #${nroDocument} criado com sucesso (tentativa ${attempt}).`);
        break; // Sucesso, sai do loop

      } catch (retryErr) {
        const sqlcode = retryErr?.sqlcode || retryErr?.error?.sqlcode;
        const sqlstate = String(retryErr?.sqlstate || retryErr?.error?.sqlstate || "");

        // SQL0803N (SQLSTATE 23505) = chave duplicada → tentar o próximo número
        if (sqlstate === "23505" || sqlcode === -803) {
          console.warn(`[PlateSeparation] Documento #${nroDocument} já existe. Tentativa ${attempt}/5, tentando próximo número...`);
          if (attempt >= 5) {
            throw new Error(`Não foi possível reservar um número de documento livre após 5 tentativas. Último tentado: #${nroDocument}.`);
          }
          continue; // Tenta novamente com o próximo número
        }

        // Qualquer outro erro é fatal
        throw retryErr;
      }
    }

    if (!insertedDocument) {
      throw new Error("Falha ao criar cabeçalho do documento no ERP após múltiplas tentativas.");
    }

    // 4. Inserir e processar cada item via procedure FMOVIMENTAESTOQUE
    const launchedDetails = [];
    for (const it of validItems) {
      const safeCode = it.codigo.replace(/'/g, "''");
      const itemQty = it.quantidade;

      const procSql = `
        BEGIN
          DECLARE v_trans INTEGER;
          DECLARE v_rec INTEGER;
          CALL DB2ADMIN.FMOVIMENTAESTOQUE(${nroDocument}, 0, '${safeCode}', ${deposito}, ${itemQty.toFixed(4)}, ${codUsuario}, ${loteNum}, v_trans, v_rec);
        END
      `;

      await runDb2Query(conn, procSql);
      launchedDetails.push({
        codigo: it.codigo,
        descricao: it.descricao,
        quantidade: itemQty,
      });
    }

    // 5. Atualizar o arquivo JSON de controle do lote
    const filePath = path.join(DEFAULT_CONTROLE_DIR, `${id}.json`);
    let content = {};
    try {
      const raw = await fsp.readFile(filePath, "utf8");
      content = JSON.parse(raw);
    } catch {
      content = {};
    }

    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, "0");
    const mins = String(now.getMinutes()).padStart(2, "0");
    const dateStr = `${day}/${month}/${year} ${hours}:${mins}`;

    content.status = "Lançado";
    content.lancado_erp = {
      documento: nroDocument,
      data: dateStr,
      usuario: usuario || "Usuário",
      tipoTransacao: "RM",
      deposito,
      centroCusto,
      totalItens: launchedDetails.length,
      itens: launchedDetails,
    };

    if (!Array.isArray(content.comentarios)) {
      content.comentarios = [];
    }

    content.comentarios.push({
      id: `${Date.now()}_erp_${Math.random().toString(36).substring(2, 9)}`,
      autor: usuario || "Sistema ERP",
      data: dateStr,
      texto: `📦 Movimento de Estoque RM lançado com sucesso no ERP! Documento: #${nroDocument} (${launchedDetails.length} item(ns) movimentado(s)).`,
    });

    try {
      await fsp.writeFile(filePath, JSON.stringify(content, null, 2), "utf8");
    } catch (fsErr) {
      console.warn("[PlateSeparation] Aviso ao gravar JSON após lançamento ERP:", fsErr.message);
    }

    return {
      ok: true,
      nroDocument,
      count: launchedDetails.length,
      status: "Lançado",
      lancado_erp: content.lancado_erp,
      comentarios: content.comentarios,
      message: `Movimento RM lançado com sucesso no ERP! Documento: #${nroDocument}`,
    };
  } catch (err) {
    console.error("[PlateSeparation] Erro ao lançar movimento no ERP:", err);
    return {
      ok: false,
      message: `Falha ao gravar no ERP DB2: ${err?.message || err}`,
    };
  } finally {
    if (conn) await closeDb2Connection(conn);
  }
});

/**
 * Adicionar comentário ao arquivo JSON de controle da Separação de Chapas
 */
ipcMain.handle("analyzer:addPlateSeparationComment", async (_e, { id, texto, autor }) => {
  if (!id || !texto || typeof texto !== "string" || !texto.trim()) {
    return { ok: false, message: "Parâmetros inválidos para comentário." };
  }

  const filePath = path.join(DEFAULT_CONTROLE_DIR, `${id}.json`);
  try {
    let content = {};
    try {
      const raw = await fsp.readFile(filePath, "utf8");
      content = JSON.parse(raw);
    } catch {
      content = {};
    }

    if (!Array.isArray(content.comentarios)) {
      content.comentarios = [];
    }

    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, "0");
    const mins = String(now.getMinutes()).padStart(2, "0");
    const dateStr = `${day}/${month}/${year} ${hours}:${mins}`;

    const newComment = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      autor: autor && typeof autor === "string" && autor.trim() ? autor.trim() : "Anônimo",
      data: dateStr,
      texto: texto.trim(),
    };

    content.comentarios.push(newComment);

    await fsp.writeFile(filePath, JSON.stringify(content, null, 2), "utf8");
    return { ok: true, comment: newComment, comentarios: content.comentarios };
  } catch (err) {
    console.error("[PlateSeparation] Erro ao salvar comentário:", err);
    return { ok: false, message: err?.message || String(err) };
  }
});

/**
 * Obter comentários em tempo real de um lote específico (leitura instantânea do JSON)
 */
ipcMain.handle("analyzer:getPlateSeparationComments", async (_e, id) => {
  if (!id) return { ok: false, comentarios: [] };

  const filePath = path.join(DEFAULT_CONTROLE_DIR, `${id}.json`);
  try {
    const raw = await fsp.readFile(filePath, "utf8");
    const content = JSON.parse(raw);
    return {
      ok: true,
      id,
      status: content.status || "pendente",
      responsavel: content.responsavel || "",
      concluido_em: content.concluido_em || "",
      concluido_por: content.concluido_por || "",
      comentarios: Array.isArray(content.comentarios) ? content.comentarios : [],
    };
  } catch (err) {
    return { ok: false, comentarios: [], message: err?.message || String(err) };
  }
});

/**
 * Abrir arquivo específico (PDF ou JSON) no aplicativo padrão
 */
ipcMain.handle("analyzer:openPlateSeparationFile", async (_e, filePath) => {
  if (!filePath || typeof filePath !== "string") {
    return { ok: false, message: "Caminho de arquivo inválido" };
  }

  try {
    const errorMsg = await shell.openPath(filePath);
    if (errorMsg) {
      return { ok: false, message: errorMsg };
    }
    return { ok: true, path: filePath };
  } catch (err) {
    return { ok: false, message: err?.message || String(err) };
  }
});

/**
 * Abrir pasta de controle ou pasta pai no Explorer
 */
ipcMain.handle("analyzer:openPlateSeparationFolder", async (_e, folderPath) => {
  const target = folderPath || DEFAULT_CONTROLE_DIR;
  try {
    const errorMsg = await shell.openPath(target);
    if (errorMsg) {
      return { ok: false, message: errorMsg };
    }
    return { ok: true, path: target };
  } catch (err) {
    return { ok: false, message: err?.message || String(err) };
  }
});
