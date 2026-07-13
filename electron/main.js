// main.js  (CommonJS)
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const fse = require('fs-extra');   // npm i fs-extra


let win = null;
let watcher = null;
let currentCfg = null;

const CFG_FILE = path.join(app.getPath('userData'), 'settings.json');

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  if (process.env.VITE_DEV) {
    win.loadURL('http://localhost:5174/');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, 'dist/index.html'));
  }
}

/* ---------------- utils --------------- */
function send(evt, payload) {
  try { win && win.webContents.send('analyzer:event', { evt, payload }); } catch { }
}
async function loadCfg() {
  try { return JSON.parse(await fsp.readFile(CFG_FILE, 'utf8')); } catch { return {}; }
}
async function saveCfg(obj) {
  await fse.ensureFile(CFG_FILE);
  await fsp.writeFile(CFG_FILE, JSON.stringify(obj || {}, null, 2), 'utf8');
}
function isUNC(p) { return typeof p === 'string' && p.startsWith('\\\\'); }
function normalizeWin(p) {
  if (!p) return '';
  return isUNC(p) ? p.replace(/\//g, '\\') : path.normalize(p);
}
async function checkWrite(dir) {
  try {
    if (!dir) return { exist: false, write: false, error: 'vazio' };
    const p = normalizeWin(dir);
    await fse.ensureDir(p);
    const probe = path.join(p, `.probe_${Date.now()}.tmp`);
    await fsp.writeFile(probe, 'ok');
    await fsp.unlink(probe);
    return { exist: true, write: true };
  } catch (e) {
    const exist = await fse.pathExists(dir).catch(() => false);
    return { exist, write: false, error: String(e && e.message || e) };
  }
}
async function testPaths(cfg) {
  const keys = ['entrada', 'exportacao', 'ok', 'erro', 'drawings'];
  const out = {};
  for (const k of keys) out[k] = await checkWrite(cfg[k]);
  return out;
}

function buildNormalizedConfig(obj) {
  if (!obj) obj = {};
  return {
    entrada: normalizeWin(obj.entrada || ''),
    exportacao: normalizeWin(obj.exportacao || obj.working || ''),
    ok: normalizeWin(obj.ok || ''),
    erro: normalizeWin(obj.erro || ''),
    drawings: normalizeWin(obj.drawings || ''),
  };
}

async function findFileRecursive(dir, filenameLower) {
  try {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = await findFileRecursive(fullPath, filenameLower);
        if (found) return found;
      } else if (entry.name.toLowerCase() === filenameLower) {
        return fullPath;
      }
    }
  } catch (e) { }
  return null;
}

/* ------ validação (stub) ------ */
async function validateXml(fileFullPath) {
  const payload = { arquivo: fileFullPath, erros: [], tags: [], autoFixes: [] };
  try {
    const base = path.basename(fileFullPath).toLowerCase();
    if (!base.includes('ok')) payload.erros.push({ descricao: 'Arquivo fora do padrão' });
    //if (base.includes('mux')) payload.tags.push('muxarabi');
    if (base.includes('ferr')) payload.tags.push('ferragens');
  } catch (e) {
    payload.erros.push({ descricao: `Falha ao ler: ${String(e && e.message || e)}` });
  }
  return payload;
}

/* ---------------- pipeline --------------- */
async function processOne(fileFullPath, cfg) {
  try {
    const payload = await validateXml(fileFullPath);
    send('file-validated', payload);

    const isOK = (payload.erros || []).length === 0;
    const base = path.basename(fileFullPath);
    const dest = isOK ? (cfg.ok || cfg.exportacao) : (cfg.erro || cfg.exportacao);
    if (dest) {
      await fse.ensureDir(dest);
      await fse.move(fileFullPath, path.join(dest, base), { overwrite: true }).catch(() => { });
    }
  } catch (e) {
    send('error', { where: 'processOne', message: String(e && e.message || e) });
  }
}

/* ---------------- IPC: Settings --------------- */
ipcMain.handle('settings:load', async () => (await loadCfg()));
ipcMain.handle('settings:save', async (_e, obj) => {
  const next = buildNormalizedConfig(obj);
  await saveCfg(next);
  currentCfg = next;
  return { ok: true, saved: next };
});
ipcMain.handle('settings:testPaths', async (_e, obj) => {
  const cfg = buildNormalizedConfig(obj);
  return await testPaths(cfg);
});
ipcMain.handle('settings:pickFolder', async (_e, initial) => {
  const res = await dialog.showOpenDialog(win, {
    defaultPath: initial || undefined,
    properties: ['openDirectory', 'createDirectory']
  });
  if (res.canceled || !res.filePaths?.length) return null;
  return res.filePaths[0];
});

/* ---------------- IPC: Analyzer --------------- */
ipcMain.handle('analyzer:start', async (_e, overrideCfg) => {
  try {
    const saved = currentCfg && Object.keys(currentCfg).length ? currentCfg : (await loadCfg());
    const raw = (overrideCfg && Object.keys(overrideCfg).length) ? overrideCfg : saved;

    const cfg = buildNormalizedConfig(raw);

    for (const k of ['entrada', 'exportacao', 'ok', 'erro']) {
      if (!cfg[k]) { send('error', { where: 'start', message: `Config inválida: '${k}' vazio.` }); return false; }
      await fse.ensureDir(cfg[k]);
    }
    currentCfg = cfg;

    if (watcher) { send('started', { watching: cfg.entrada }); return true; }

    const isUncEntrada = isUNC(cfg.entrada);
    watcher = chokidar.watch(cfg.entrada, {
      ignoreInitial: false,
      depth: 0,
      awaitWriteFinish: { stabilityThreshold: 600, pollInterval: 120 },
      usePolling: isUncEntrada,
      interval: isUncEntrada ? 800 : 100
    });

    watcher.on('add', (p) => p.toLowerCase().endsWith('.xml') && processOne(p, cfg));
    watcher.on('change', (p) => p.toLowerCase().endsWith('.xml') && processOne(p, cfg));
    watcher.on('error', (err) => send('error', { where: 'watch', message: String(err) }));

    send('started', { watching: cfg.entrada });
    return true;
  } catch (e) {
    send('error', { where: 'start', message: String(e && e.message || e) });
    return false;
  }
});

ipcMain.handle('analyzer:stop', async () => {
  try {
    if (watcher) { await watcher.close(); watcher = null; }
    send('stopped', {});
    return true;
  } catch (e) {
    send('error', { where: 'stop', message: String(e && e.message || e) });
    return false;
  }
});

ipcMain.handle('analyzer:scanOnce', async () => {
  try {
    const cfg = currentCfg || await loadCfg();
    if (!cfg?.entrada) { send('error', { where: 'scanOnce', message: 'Entrada não configurada.' }); return false; }
    const files = await fsp.readdir(cfg.entrada);
    for (const f of files) {
      if (f.toLowerCase().endsWith('.xml')) {
        await processOne(path.join(cfg.entrada, f), cfg);
      }
    }
    send('scan-finished', {});
    return true;
  } catch (e) {
    send('error', { where: 'scanOnce', message: String(e && e.message || e) });
    return false;
  }
});

ipcMain.handle('analyzer:findDrawingFile', async (_e, obj) => {
  try {
    const { drawingCode } = (typeof obj === 'string') ? { drawingCode: obj } : (obj || {});
    console.log('[DXF Search] ========== INICIANDO BUSCA ==========');
    console.log('[DXF Search] Código de desenho procurado:', drawingCode);

    const cfg = currentCfg || (await loadCfg()) || {};
    const dxfFolderPath = cfg?.drawings;

    if (!dxfFolderPath) {
      console.log('[DXF Search] ❌ Pasta de desenhos não configurada');
      return { found: false, path: null, message: "A pasta de desenhos não está configurada nas preferências." };
    }

    console.log('[DXF Search] DXF folder path:', dxfFolderPath);

    // Verificar se a pasta existe
    const folderExists = await fse.pathExists(dxfFolderPath);
    console.log('[DXF Search] Pasta existe?', folderExists);

    if (!folderExists) {
      console.log('[DXF Search] ❌ FALHA: Pasta não encontrada');
      return { found: false, path: null, message: `Pasta não encontrada: ${dxfFolderPath}` };
    }

    // Procurar arquivo recursivamente
    const exactFilename = `${drawingCode.toLowerCase()}.dxf`;
    console.log('[DXF Search] Buscando arquivo recursivamente:', exactFilename);
    const fullPath = await findFileRecursive(dxfFolderPath, exactFilename);

    if (fullPath) {
      const foundFile = path.basename(fullPath);
      console.log('[DXF Search] ✅ SUCESSO: Arquivo encontrado');
      console.log('[DXF Search] Nome:', foundFile);
      console.log('[DXF Search] Caminho completo:', fullPath);
      return { found: true, path: fullPath, name: foundFile };
    }

    console.log('[DXF Search] ❌ FALHA: Nenhum arquivo corresponde ao padrão nas subpastas');
    return { found: false, path: null, message: `Arquivo "${exactFilename}" não encontrado em ${dxfFolderPath} ou subpastas.` };
  } catch (e) {
    console.log('[DXF Search] ❌ ERRO DURANTE BUSCA:', e.message || e);
    console.error('[DXF Search] Stack:', e.stack);
    return { found: false, path: null, message: `Erro ao buscar: ${String(e && e.message || e)}` };
  }
});

/** ================== IPC: OPEN DRAWING FILE ================== **/
ipcMain.handle('analyzer:openDrawing', async (_e, arg) => {
  try {
    const drawingCode = (typeof arg === 'string') ? arg : (arg?.drawingCode || '');
    if (!drawingCode) {
      return { ok: false, message: "Código de desenho vazio ou inválido." };
    }
    const cfg = currentCfg || (await loadCfg()) || {};
    const dxfFolderPath = cfg?.drawings;
    
    if (!dxfFolderPath) {
      return { ok: false, message: "A pasta de desenhos não está configurada nas preferências." };
    }

    const folderExists = await fse.pathExists(dxfFolderPath);
    if (!folderExists) {
      return { ok: false, message: `Pasta de desenhos não encontrada: ${dxfFolderPath}` };
    }

    const exactFilename = `${drawingCode.toLowerCase()}.dxf`;
    const fullPath = await findFileRecursive(dxfFolderPath, exactFilename);

    if (!fullPath) {
      return { ok: false, message: `Desenho "${exactFilename}" não encontrado na pasta de desenhos ou subpastas.` };
    }
    const errorMsg = await shell.openPath(fullPath);
    if (errorMsg) {
      return { ok: false, message: `Erro ao abrir o arquivo: ${errorMsg}` };
    }
    return { ok: true, path: fullPath };
  } catch (e) {
    return { ok: false, message: String(e && e.message || e) };
  }
});

/** ================== IPC: OPEN MUXARABI DRAWING FILE ================== **/
ipcMain.handle('analyzer:openMuxarabiDrawing', async (_e, arg) => {
  try {
    const sizeCode = (typeof arg === 'string') ? arg : (arg?.sizeCode || '');
    if (!sizeCode) {
      return { ok: false, message: "Código de tamanho vazio ou inválido." };
    }
    const muxarabiDirPath = app.isPackaged
      ? path.join(process.resourcesPath, 'Muxarabi')
      : path.join(app.getAppPath(), 'Muxarabi');
    const folderExists = await fse.pathExists(muxarabiDirPath);
    if (!folderExists) {
      return { ok: false, message: `Pasta "Muxarabi" não encontrada na raiz do projeto ou recursos: ${muxarabiDirPath}` };
    }

    // Buscar o arquivo de desenho (ex: "50x50.dxf") recursivamente dentro da pasta Muxarabi na raiz
    const exactFilename = `${sizeCode.toLowerCase()}.dxf`;
    const fullPath = await findFileRecursive(muxarabiDirPath, exactFilename);

    if (!fullPath) {
      return { ok: false, message: `Desenho "${exactFilename}" não encontrado na pasta Muxarabi da raiz do projeto.` };
    }

    const errorMsg = await shell.openPath(fullPath);
    if (errorMsg) {
      return { ok: false, message: `Erro ao abrir o arquivo: ${errorMsg}` };
    }
    return { ok: true, path: fullPath };
  } catch (e) {
    return { ok: false, message: String(e && e.message || e) };
  }
});

/* --------------- lifecycle --------------- */
app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
