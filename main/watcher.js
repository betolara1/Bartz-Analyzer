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
