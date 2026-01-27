// main.js  (CommonJS)
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
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
  try { win && win.webContents.send('analyzer:event', { evt, payload }); } catch {}
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
    if (!dir) return { exist:false, write:false, error:'vazio' };
    const p = normalizeWin(dir);
    await fse.ensureDir(p);
    const probe = path.join(p, `.probe_${Date.now()}.tmp`);
    await fsp.writeFile(probe, 'ok');
    await fsp.unlink(probe);
    return { exist:true, write:true };
  } catch (e) {
    const exist = await fse.pathExists(dir).catch(()=>false);
    return { exist, write:false, error:String(e && e.message || e) };
  }
}
async function testPaths(cfg) {
  const keys = ['entrada','working','ok','erro','logsErrors','logsProcessed'];
  const out = {};
  for (const k of keys) out[k] = await checkWrite(cfg[k]);
  return out;
}

/* ------ validação (stub) ------ */
async function validateXml(fileFullPath) {
  const payload = { arquivo: fileFullPath, erros: [], tags: [], autoFixes: [] };
  try {
    const base = path.basename(fileFullPath).toLowerCase();
    if (!base.includes('ok')) payload.erros.push({ descricao: 'Arquivo fora do padrão' });
    if (base.includes('mux')) payload.tags.push('muxarabi');
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
    const dest = isOK ? (cfg.ok || cfg.working) : (cfg.erro || cfg.working);
    if (dest) {
      await fse.ensureDir(dest);
      await fse.move(fileFullPath, path.join(dest, base), { overwrite: true }).catch(()=>{});
    }

    const logDir = isOK ? cfg.logsProcessed : cfg.logsErrors;
    if (logDir) {
      await fse.ensureDir(logDir);
      const logName = base.replace(/\.xml$/i, '') + `_${isOK ? 'ok' : 'erro'}.json`;
      await fsp.writeFile(path.join(logDir, logName), JSON.stringify(payload, null, 2), 'utf8');
    }
  } catch (e) {
    send('error', { where: 'processOne', message: String(e && e.message || e) });
  }
}

/* ---------------- IPC: Settings --------------- */
ipcMain.handle('settings:load', async () => (await loadCfg()));
ipcMain.handle('settings:save', async (_e, obj) => {
  const next = {
    entrada: normalizeWin(obj?.entrada || ''),
    working: normalizeWin(obj?.working || ''),
    ok:      normalizeWin(obj?.ok || ''),
    erro:    normalizeWin(obj?.erro || ''),
    logsErrors:    normalizeWin(obj?.logsErrors || ''),
    logsProcessed: normalizeWin(obj?.logsProcessed || ''),
  };
  await saveCfg(next);
  currentCfg = next;
  return { ok:true, saved: next };
});
ipcMain.handle('settings:testPaths', async (_e, obj) => {
  const cfg = {
    entrada: normalizeWin(obj?.entrada || ''),
    working: normalizeWin(obj?.working || ''),
    ok:      normalizeWin(obj?.ok || ''),
    erro:    normalizeWin(obj?.erro || ''),
    logsErrors:    normalizeWin(obj?.logsErrors || ''),
    logsProcessed: normalizeWin(obj?.logsProcessed || ''),
  };
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

    const cfg = {
      entrada: normalizeWin(raw.entrada),
      working: normalizeWin(raw.working),
      ok:      normalizeWin(raw.ok),
      erro:    normalizeWin(raw.erro),
      logsErrors:    normalizeWin(raw.logsErrors),
      logsProcessed: normalizeWin(raw.logsProcessed),
    };

    for (const k of ['entrada','working','ok','erro']) {
      if (!cfg[k]) { send('error', { where:'start', message:`Config inválida: '${k}' vazio.` }); return false; }
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

    watcher.on('add',    (p) => p.toLowerCase().endsWith('.xml') && processOne(p, cfg));
    watcher.on('change', (p) => p.toLowerCase().endsWith('.xml') && processOne(p, cfg));
    watcher.on('error',  (err) => send('error', { where:'watch', message:String(err) }));

    send('started', { watching: cfg.entrada });
    return true;
  } catch (e) {
    send('error', { where:'start', message:String(e && e.message || e) });
    return false;
  }
});

ipcMain.handle('analyzer:stop', async () => {
  try {
    if (watcher) { await watcher.close(); watcher = null; }
    send('stopped', {});
    return true;
  } catch (e) {
    send('error', { where:'stop', message:String(e && e.message || e) });
    return false;
  }
});

ipcMain.handle('analyzer:scanOnce', async () => {
  try {
    const cfg = currentCfg || await loadCfg();
    if (!cfg?.entrada) { send('error', { where:'scanOnce', message:'Entrada não configurada.' }); return false; }
    const files = await fsp.readdir(cfg.entrada);
    for (const f of files) {
      if (f.toLowerCase().endsWith('.xml')) {
        await processOne(path.join(cfg.entrada, f), cfg);
      }
    }
    send('scan-finished', {});
    return true;
  } catch (e) {
    send('error', { where:'scanOnce', message:String(e && e.message || e) });
    return false;
  }
});

/* --------------- lifecycle --------------- */
app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
