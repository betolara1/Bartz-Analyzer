// main/watcher.js
// Monitoramento da pasta de entrada (chokidar) e os handlers de IPC que giram
// em torno do ciclo de vida de um arquivo XML: iniciar/parar, escanear uma vez,
// buscar XMLs em outra pasta, copiar para a entrada, abrir na pasta, reprocessar.
const path = require("path");
const fs = require("fs");
const fsp = fs.promises;
const fse = require("fs-extra");
const chokidar = require("chokidar");
const { ipcMain, shell } = require("electron");
const state = require("./state");
const { isUNC, loadCfg, sanitizeCfg, send, resolveFilePathMaybeBase } = require("./helpers");
const { processOne } = require("./xml-processor");

/** ================== IPC: BUSCA E CÓPIA DE ARQUIVOS XML ================== **/
ipcMain.handle('analyzer:searchXmlFiles', async (_e, { searchTerm }) => {
  try {
    const cfg = state.currentCfg || (await loadCfg()) || {};
    const searchFolder = cfg?.busca;
    if (!searchFolder) {
      return { ok: false, message: "A pasta de busca XML não está configurada." };
    }
    const folderExists = await fse.pathExists(searchFolder);
    if (!folderExists) {
      return { ok: false, message: `Pasta de busca não encontrada: ${searchFolder}` };
    }

    // Validar se a pasta raiz é legível
    try {
      await fse.readdir(searchFolder);
    } catch (e) {
      return { ok: false, message: `Sem permissão de leitura na pasta de busca: ${e.message}` };
    }

    const results = [];
    const term = String(searchTerm || '').toLowerCase().trim();
    if (!term) {
      return { ok: true, results: [] };
    }

    // Função interna recursiva robusta para buscar arquivos xml correspondentes
    async function scanDir(directory) {
      if (results.length >= 100) return;
      let items;
      try {
        items = await fse.readdir(directory, { withFileTypes: true });
      } catch (e) {
        return; // Ignora erros de leitura de subpastas individuais
      }

      for (const item of items) {
        if (results.length >= 100) return;
        const full = path.join(directory, item.name);
        if (item.isDirectory()) {
          await scanDir(full);
        } else if (item.isFile()) {
          if (item.name.toLowerCase().endsWith('.xml') && item.name.toLowerCase().includes(term)) {
            results.push({
              name: item.name,
              fullPath: full
            });
          }
        }
      }
    }

    await scanDir(searchFolder);
    return { ok: true, results };
  } catch (e) {
    return { ok: false, message: String(e && e.message || e) };
  }
});

ipcMain.handle('analyzer:copyXmlToEntrada', async (_e, { sourceFullPath }) => {
  try {
    if (!sourceFullPath) {
      return { ok: false, message: "Caminho do arquivo de origem não especificado." };
    }
    const cfg = state.currentCfg || (await loadCfg()) || {};
    const destFolder = cfg?.entrada;
    if (!destFolder) {
      return { ok: false, message: "A pasta de entrada não está configurada." };
    }
    const destFolderExists = await fse.pathExists(destFolder);
    if (!destFolderExists) {
      return { ok: false, message: `Pasta de entrada não encontrada: ${destFolder}` };
    }

    const fileName = path.basename(sourceFullPath);
    const destFullPath = path.join(destFolder, fileName);

    await fse.copy(sourceFullPath, destFullPath);
    return { ok: true, destPath: destFullPath };
  } catch (e) {
    return { ok: false, message: String(e && e.message || e) };
  }
});

/** ================== IPC: DOWNLOAD .PROMOB DO PEDIDOS ONLINE ================== **/
ipcMain.handle('analyzer:downloadPromob', async (_e, { xmlFilename }) => {
  try {
    if (!xmlFilename) {
      return { ok: false, message: "Nome do arquivo XML não especificado." };
    }
    const cfg = state.currentCfg || (await loadCfg()) || {};
    const downloadFolder = cfg?.downloadPromob;
    if (!downloadFolder) {
      return { ok: false, message: "Configure a Pasta de Download Promob nas Configurações antes de baixar." };
    }

    // Garante que a pasta de download exista
    await fse.ensureDir(downloadFolder);

    // Extrai número do pedido do nome do arquivo (ex: "69371" de "69371a__...")
    const orderMatch = xmlFilename.match(/^(\d{4,6})/);
    const orderNumber = orderMatch ? orderMatch[1] : (xmlFilename.match(/\b(\d{4,6})\b/)?.[1] || null);

    // Extrai prefixo de data/hora do nome do arquivo se disponível (ex: "2026-07-15_18-27")
    const dateMatch = xmlFilename.match(/(\d{4}-\d{2}-\d{2}_\d{2}-\d{2})/);
    let datePrefix = dateMatch ? dateMatch[1] : null;

    const https = require('https');
    const http = require('http');
    const querystring = require('querystring');

    // Helper HTTP POST
    const httpPost = (targetUrl, dataObj, cookieHeader = '') => new Promise((resolve, reject) => {
      const postData = querystring.stringify(dataObj);
      const isHttps = targetUrl.startsWith('https');
      const client = isHttps ? https : http;
      const parsedUrl = new URL(targetUrl);

      const reqOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) BartzAnalyzer/1.0',
          ...(cookieHeader ? { 'Cookie': cookieHeader } : {})
        },
        timeout: 20000,
      };

      const req = client.request(reqOptions, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout na conexão.')); });
      req.write(postData);
      req.end();
    });

    // Helper HTTP GET (Buffer)
    const httpGetBuffer = (targetUrl, cookieHeader = '') => new Promise((resolve, reject) => {
      const isHttps = targetUrl.startsWith('https');
      const client = isHttps ? https : http;
      const parsedUrl = new URL(targetUrl);

      const reqOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) BartzAnalyzer/1.0',
          ...(cookieHeader ? { 'Cookie': cookieHeader } : {})
        },
        timeout: 30000,
      };

      const req = client.request(reqOptions, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          let redirectUrl = res.headers.location;
          if (!redirectUrl.startsWith('http')) {
            redirectUrl = new URL(redirectUrl, targetUrl).toString();
          }
          httpGetBuffer(redirectUrl, cookieHeader).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout no download.')); });
      req.end();
    });

    // 1. Efetuar Login no Pedidos Online (roberto / 1234)
    let sessionCookie = '';
    try {
      const loginRes = await httpPost('https://pedidosbartzmoveis.com.br/executa/processo_login.php', {
        txt_login: 'roberto',
        txt_senha: '1234'
      });
      const setCookies = loginRes.headers['set-cookie'];
      if (setCookies && setCookies.length > 0) {
        sessionCookie = setCookies.map(c => c.split(';')[0]).join('; ');
      }
    } catch (e) {
      return { ok: false, message: `Falha ao realizar login no Pedidos Online: ${e.message}` };
    }

    if (!sessionCookie) {
      return { ok: false, message: "Não foi possível obter a sessão de login no Pedidos Online." };
    }

    let targetPromobName = null;

    // 2. Tentar localizar o .promob buscando pelo número do pedido (ex: 69371)
    if (orderNumber) {
      try {
        const searchUrl = `https://pedidosbartzmoveis.com.br/include/pd/consultas/busca_pedidos.php?filtro=${encodeURIComponent(orderNumber)}`;
        const searchBuf = await httpGetBuffer(searchUrl, sessionCookie);
        const searchJson = JSON.parse(searchBuf.toString('utf8'));

        if (searchJson && Array.isArray(searchJson.aaData) && searchJson.aaData.length > 0) {
          const row = searchJson.aaData.find((r) => r.Pedido === String(orderNumber)) || searchJson.aaData[0];
          const pkPedido = row.DT_RowId; // ex: 69217

          if (pkPedido) {
            // Abrir a página de detalhes do pedido
            const pedInfoUrl = `https://pedidosbartzmoveis.com.br/index.php?form=ped_info&filtro=${encodeURIComponent(pkPedido)}`;
            const pedInfoBuf = await httpGetBuffer(pedInfoUrl, sessionCookie);
            const pedInfoHtml = pedInfoBuf.toString('utf8');

            // Extrair id_arquivo do onclick (ex: onclick='arquivo_detalhes(112914);')
            const fileIdMatch = pedInfoHtml.match(/arquivo_detalhes\((\d+)\)/i);
            if (fileIdMatch && fileIdMatch[1]) {
              const idArquivo = fileIdMatch[1];
              // Chamar busca_arquivo_detalhes.php para pegar nome_promob
              const detRes = await httpPost('https://pedidosbartzmoveis.com.br/include/pd/consultas/busca_arquivo_detalhes.php', {
                id_arquivo: idArquivo
              }, sessionCookie);
              const detJson = JSON.parse(detRes.body);
              if (Array.isArray(detJson) && detJson[6]) {
                targetPromobName = detJson[6]; // ex: 2026-07-15_18-27_244882.promob
              }
            }

            // Se não encontrou via busca_arquivo_detalhes, procurar direto por .promob no HTML de ped_info
            if (!targetPromobName) {
              const matchPromob = pedInfoHtml.match(/([A-Za-z0-9_.-]+\.promob)/i);
              if (matchPromob) {
                targetPromobName = matchPromob[1];
              }
            }
          }
        }
      } catch (errSearch) {
        console.error("[downloadPromob] Erro na consulta do pedido:", errSearch.message);
      }
    }

    // 3. Se ainda não encontrou e temos um prefixo de data/hora no nome do XML, montar o nome padrão .promob
    if (!targetPromobName && datePrefix) {
      targetPromobName = `${datePrefix}.promob`;
    }

    if (!targetPromobName) {
      const idStr = orderNumber ? `pedido "${orderNumber}"` : `arquivo "${xmlFilename}"`;
      return { ok: false, message: `Não foi possível localizar o arquivo .promob para o ${idStr} no Pedidos Online.` };
    }

    // 4. Efetuar o download do arquivo .promob do servidor usando a sessão autenticada
    const downloadUrl = `https://pedidosbartzmoveis.com.br/arquivos/promob/${encodeURIComponent(targetPromobName)}`;
    const destPath = path.join(downloadFolder, targetPromobName);

    try {
      const promobBuffer = await httpGetBuffer(downloadUrl, sessionCookie);
      await fsp.writeFile(destPath, promobBuffer);

      return {
        ok: true,
        filename: targetPromobName,
        destPath: destPath,
        count: 1,
        files: [{ filename: targetPromobName, destPath }]
      };
    } catch (dlErr) {
      return { ok: false, message: `Falha ao baixar ${targetPromobName}: ${dlErr.message}` };
    }
  } catch (e) {
    return { ok: false, message: String(e && e.message || e) };
  }
});

/** ================== IPC: ANALYZER (watcher) ================== **/
ipcMain.handle("analyzer:start", async (_e, overrideCfg) => {
  try {
    const saved = state.currentCfg && Object.keys(state.currentCfg).length ? state.currentCfg : await loadCfg();
    const raw = overrideCfg && Object.keys(overrideCfg).length ? overrideCfg : saved;

    const cfg = sanitizeCfg(raw);

    for (const k of ["entrada", "exportacao", "ok", "erro"]) {
      if (!cfg[k]) { send("error", { where: "start", message: `Config inválida: '${k}' vazio.` }); return false; }
      await fse.ensureDir(cfg[k]);
    }
    state.currentCfg = cfg;

    if (state.watcher) { send("started", { watching: cfg.entrada }); return true; }

    const isUncEntrada = isUNC(cfg.entrada);
    state.watcher = chokidar.watch(cfg.entrada, {
      ignoreInitial: false,
      depth: 0,
      awaitWriteFinish: { stabilityThreshold: 600, pollInterval: 120 },
      usePolling: isUncEntrada,
      interval: isUncEntrada ? 800 : 100,
    });

    state.watcher.on("add", (p) => p.toLowerCase().endsWith(".xml") && processOne(p, cfg));
    state.watcher.on("change", (p) => p.toLowerCase().endsWith(".xml") && processOne(p, cfg));
    state.watcher.on("error", (err) => send("error", { where: "watch", message: String(err) }));

    send("started", { watching: cfg.entrada });
    return true;
  } catch (e) {
    send("error", { where: "start", message: String((e && e.message) || e) });
    return false;
  }
});

ipcMain.handle("analyzer:stop", async () => {
  try {
    if (state.watcher) { await state.watcher.close(); state.watcher = null; }
    send("stopped", {});
    return true;
  } catch (e) {
    send("error", { where: "stop", message: String((e && e.message) || e) });
    return false;
  }
});

ipcMain.handle("analyzer:scanOnce", async () => {
  try {
    const cfg = state.currentCfg || (await loadCfg());
    if (!cfg?.entrada) { send("error", { where: "scanOnce", message: "Entrada não configurada." }); return false; }
    const files = await fsp.readdir(cfg.entrada);
    for (const f of files) if (f.toLowerCase().endsWith(".xml")) await processOne(path.join(cfg.entrada, f), cfg);
    send("scan-finished", {});
    return true;
  } catch (e) {
    send("error", { where: "scanOnce", message: String((e && e.message) || e) });
    return false;
  }
});

/** --- abrir na pasta --- */
ipcMain.handle("analyzer:openInFolder", async (_e, fileFullPath) => {
  try {
    const cfg = state.currentCfg || (await loadCfg());
    const real = await resolveFilePathMaybeBase(fileFullPath, cfg);
    if (!real) {
      send("error", { where: "openInFolder", message: "Arquivo não encontrado." });
      return false;
    }

    const p = path.resolve(real);

    // API nativa do Electron: seleciona o arquivo no explorador de arquivos do SO
    // (evita passar caminhos por uma shell, ao contrário de child_process.exec)
    shell.showItemInFolder(p);

    return true;
  } catch (e) {
    send("error", { where: "openInFolder", message: String((e && e.message) || e) });
    return false;
  }
});

/** --- reprocessar --- */
ipcMain.handle("analyzer:reprocessOne", async (_e, fileFullPath) => {
  try {
    const cfg = state.currentCfg || (await loadCfg());
    if (!cfg?.exportacao) { send("error", { where: "reprocessOne", message: "Config faltando (Exportação)." }); return false; }

    const real = await resolveFilePathMaybeBase(fileFullPath, cfg);
    if (!real) { send("error", { where: "reprocessOne", message: "Arquivo não encontrado." }); return false; }

    await fse.ensureDir(cfg.exportacao);
    const base = path.basename(real);
    const staging = path.join(cfg.exportacao, base);

    await fse.copy(real, staging, { overwrite: true });
    await processOne(staging, cfg);
    return true;
  } catch (e) {
    send("error", { where: "reprocessOne", message: String((e && e.message) || e) });
    return false;
  }
});
