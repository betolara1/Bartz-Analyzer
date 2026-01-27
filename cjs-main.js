// main.js (CJS)
const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const { exec } = require("child_process");
const fs = require("fs");
const fsp = fs.promises;
const chokidar = require("chokidar");
const fse = require("fs-extra");

let win = null;
let watcher = null;
let currentCfg = null;

const CFG_FILE = path.join(app.getPath("userData"), "settings.json");

function isUNC(p) { return typeof p === "string" && p.startsWith("\\\\"); }
function normalizeWin(p) { if (!p) return ""; return isUNC(p) ? p.replace(/\//g, "\\") : path.normalize(p); }

async function loadCfg() { try { return JSON.parse(await fsp.readFile(CFG_FILE, "utf8")); } catch { return {}; } }
async function saveCfg(obj) { await fse.ensureFile(CFG_FILE); await fsp.writeFile(CFG_FILE, JSON.stringify(obj || {}, null, 2), "utf8"); }

async function checkWrite(dir) {
  try {
    if (!dir) return { exist: false, write: false, error: "vazio" };
    const p = normalizeWin(dir);
    await fse.ensureDir(p);
    const probe = path.join(p, `.probe_${Date.now()}.tmp`);
    await fsp.writeFile(probe, "ok");
    await fsp.unlink(probe);
    return { exist: true, write: true };
  } catch (e) {
    const exist = await fse.pathExists(dir).catch(() => false);
    return { exist, write: false, error: String((e && e.message) || e) };
  }
}

async function testPathsAll(cfg) {
  const keys = ["entrada", "working", "ok", "erro", "logsErrors", "logsProcessed"];
  const out = {};
  for (const k of keys) out[k] = await checkWrite(cfg[k]);
  return out;
}

function send(evt, payload) {
  try { win && win.webContents.send("analyzer:event", { evt, payload }); } catch {}
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.VITE_DEV) {
    win.loadURL("http://localhost:5174/");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "dist/index.html"));
  }
}

// --- VALIDATION lendo conteúdo do XML e usando cfg.enableAutoFix ---
async function validateXml(fileFullPath, cfg = {}) {
  const raw = await fsp.readFile(fileFullPath, "utf8");
  let txt = raw;

  const payload = {
    arquivo: path.resolve(fileFullPath),
    erros: [],
    warnings: [],
    tags: [],
    autoFixes: [],
    meta: {},
  };

  // ===== BUILDER flags =====
  const hasBldrS = /\bBUILDER\s*=\s*"S"/i.test(txt);
  const hasBldrN = /\bBUILDER\s*=\s*"N"/i.test(txt);
  const isFerragensOnly = hasBldrN && !hasBldrS;
  if (isFerragensOnly) {
    payload.tags.push("ferragens");
    payload.meta.ferragensOnly = true; // usado no renderer p/ status
  }

  // ===== Regras fixas =====
  if (/\bREFERENCIA\s*=\s*""/i.test(txt)) payload.erros.push({ descricao: "ITEM SEM CÓDIGO" });
  if (/\bQUANTIDADE\s*=\s*"0(?:\.0+)?"/i.test(txt)) payload.erros.push({ descricao: "ITEM SEM QUANTIDADE" });
  if (/\bPRECO_TOTAL\s*=\s*"0(?:\.0+)?"/i.test(txt)) payload.erros.push({ descricao: "ITEM SEM PREÇO" });

  // Cor coringa
  const COR_CORINGA_LIST = [
    "PAINEL_CG1_06","PAINEL_CG1_18","PAINEL_CG1_37","PAINEL_CG1_15","PAINEL_CG1_25",
    "PAINEL_CG2_06","PAINEL_CG2_18","PAINEL_CG2_37","PAINEL_CG2_15","PAINEL_CG2_25",
    "FITA_CG1_22","FITA_CG1_35","FITA_CG1_42","FITA_CG1_50",
    "FITA_CG2_22","FITA_CG2_35","FITA_CG2_42","FITA_CG2_50",
    "CHAPA_CG1_06","CHAPA_CG1_18","CHAPA_CG1_37","CHAPA_CG1_15","CHAPA_CG1_25",
    "CHAPA_CG2_06","CHAPA_CG2_18","CHAPA_CG2_37","CHAPA_CG2_15","CHAPA_CG2_25",
    "TAPAFURO_CG1_06","TAPAFURO_CG1_18","TAPAFURO_CG1_37","TAPAFURO_CG1_15","TAPAFURO_CG1_25",
    "TAPAFURO_CG2_06","TAPAFURO_CG2_18","TAPAFURO_CG2_37","TAPAFURO_CG2_15","TAPAFURO_CG2_25",
  ];
  // detect and record all matching "cor coringa" tokens (unique, uppercase)
  try {
    const corRegex = new RegExp(`\\b(${COR_CORINGA_LIST.join("|")})\\b`, "gi");
    const corMatches = Array.from(new Set(Array.from(txt.matchAll(corRegex)).map(m => (m[1] || m[0] || '').toString().toUpperCase()))).filter(Boolean);
    if (corMatches.length) {
      payload.erros.push({ descricao: "CADASTRO DE COR CORINGA" });
      payload.tags.push("coringa");
      payload.meta = payload.meta || {};
      payload.meta.coringaMatches = corMatches;
    }
  } catch (e) { /* ignore regex problems */ }

  // Avisos (não erro) + flags
  const hasMuxarabi = /\bMX008001\b/i.test(txt) || /\bMX008002\b/i.test(txt);
  if (hasMuxarabi) {
    payload.warnings.push("MUXARABI NO PED");
    payload.tags.push("muxarabi");
  }
  if (/\bLR00(0[1-9]|1[01])\b/i.test(txt)) {
    payload.warnings.push("MÓD.CURVO  NO PED");
    payload.tags.push("curvo");
  }

  // ===== Máquinas detectadas (ID + Nome) =====
  // Ex.: <MAQUINA ... ID_PLUGIN="2341" NOME_PLUGIN="Cyflex 900" ... />
  const machines = [];
  for (const m of txt.matchAll(/<MAQUINA\b([^>]*\bID_PLUGIN\s*=\s*"([^"]+)"[^>]*\bNOME_PLUGIN\s*=\s*"([^"]+)")/gi)) {
    const id = (m[2] || "").trim();
    const name = (m[3] || "").trim();
    if (id) machines.push({ id, name });
  }
  // salva no meta p/ o Drawer
  payload.meta.machines = machines;

  // Máquinas obrigatórias quando NÃO for só ferragens
if (!isFerragensOnly) {
  const REQUIRED_PLUGINS = ["2530","2534","2341","2525"]; // Aspan, NCB612, Cyflex 900, MSZ600

  // coleta todos IDs de plugin presentes no XML
  const seen = new Set();
  for (const m of txt.matchAll(/<MAQUINA\b[^>]*\bID_PLUGIN\s*=\s*"([^"]+)"/gi)) {
    seen.add((m[1] || "").trim());
  }

  // erro apenas se faltar alguma obrigatória (quando aplicável)
  const allPresent = REQUIRED_PLUGINS.every(id => seen.has(id));
  if (!allPresent) payload.erros.push({ descricao: "PROBLEMA NA GERAÇÃO DE MÁQUINAS" });

  // mapeia nomes e já envia UMA de cada no payload.meta.machines
  const PLUGIN_NAMES = {
    "2341": "Cyflex 900",
    "2530": "Aspan",
    "2534": "NCB612",
    "2525": "MSZ600",
  };
  payload.meta.machines = Array.from(seen).map(id => ({
    id,
    name: PLUGIN_NAMES[id] || undefined,
  }));
}

  // ===== AUTO-FIX =====
  // ===== AUTO-FIX =====
if (cfg.enableAutoFix) {
  let changed = false;
  let priceFixCount = 0;
  let qtyFixCount = 0;

  // Passo por cada TAG <ITEM ...> e ajusto atributos dentro dela
  txt = txt.replace(/<ITEM\b([^>]*)>/gi, (full, attrs) => {
    let updated = attrs; // string só com os atributos
    const refMatch = updated.match(/\bREFERENCIA\s*=\s*"([^"]*)"/i);
    const ref = (refMatch?.[1] || "").trim();

    // 1) QUANTIDADE = 0 -> 1 (se tiver REFERENCIA preenchida no mesmo ITEM)
    const qtyMatch = updated.match(/\bQUANTIDADE\s*=\s*"([^"]*)"/i);
    if (qtyMatch) {
      const qtyVal = (qtyMatch[1] || "").trim();
      if (ref && /^0(?:\.0+)?$/.test(qtyVal)) {
        updated = updated.replace(
          /(\bQUANTIDADE\s*=\s*")0(?:\.0+)?(")/i,
          `$11$2`
        );
        qtyFixCount++;
        changed = true;
      }
    }

    // 2) PRECO_TOTAL 0 / 0.00 -> 0.10 (sempre que for zero)
    const priceMatch = updated.match(/\bPRECO_TOTAL\s*=\s*"([^"]*)"/i);
    if (priceMatch) {
      const pVal = (priceMatch[1] || "").trim();
      if (/^0(?:\.0+)?$/.test(pVal)) {
        updated = updated.replace(
          /(\bPRECO_TOTAL\s*=\s*")0(?:\.0+)?(")/i,
          `$10.10$2`
        );
        priceFixCount++;
        changed = true;
      }
    }

    // remonta a tag <ITEM ...>
    // (attrs capturado NÃO inclui o ">" final, então devolvemos igual ao original)
    return `<ITEM${updated}>`;
  });

  // se houve qualquer ajuste, limpamos os erros correspondentes e gravamos de volta
  if (qtyFixCount > 0) {
    payload.autoFixes.push(`Ajustes de QUANTIDADE aplicados em ${qtyFixCount} item(ns)`);
    // remove o erro de quantidade se existir
    payload.erros = (payload.erros || []).filter(
      (e) => (e.descricao || e).toUpperCase() !== "ITEM SEM QUANTIDADE"
    );
  }
  if (priceFixCount > 0) {
    payload.autoFixes.push(`Ajustes de PREÇO aplicados em ${priceFixCount} item(ns)`);
    // remove o erro de preço se existir
    payload.erros = (payload.erros || []).filter(
      (e) => (e.descricao || e).toUpperCase() !== "ITEM SEM PREÇO"
    );
  }

  if (changed) {
    await fsp.writeFile(fileFullPath, txt, "utf8");
  }
}

  // Dedup
  payload.tags = Array.from(new Set(payload.tags));
  const dedup = (arr) => {
    const s = new Set();
    return (arr || []).filter(x => {
      const k = (typeof x === "string" ? x : x?.descricao || String(x)).toLowerCase();
      if (s.has(k)) return false; s.add(k); return true;
    });
  };
  payload.erros = dedup(payload.erros);
  payload.warnings = dedup(payload.warnings);

  return payload;
}

async function processOne(fileFullPath, cfg) {
  try {
    const analysis = await validateXml(fileFullPath, cfg);
    const isOK = (analysis.erros || []).length === 0;

    const baseName = path.basename(fileFullPath);
    const destDir  = isOK ? (cfg.ok || cfg.working) : (cfg.erro || cfg.working);

    let finalPath = path.resolve(fileFullPath);
    let movedTo = null;

    if (destDir) {
      await fse.ensureDir(destDir);
      const target = path.join(destDir, baseName);
      if (path.resolve(target).toLowerCase() !== finalPath.toLowerCase()) {
        try { await fse.move(finalPath, target, { overwrite: true }); finalPath = path.resolve(target); movedTo = path.resolve(destDir); } catch {}
      }
    }

    const logDir = isOK ? cfg.logsProcessed : cfg.logsErrors;
    if (logDir) {
      await fse.ensureDir(logDir);
      const logName = baseName.replace(/\.xml$/i, '') + `_${isOK ? 'ok' : 'erro'}.json`;
      await fsp.writeFile(path.join(logDir, logName), JSON.stringify(analysis, null, 2), 'utf8');
    }

    send('file-validated', { ...analysis, arquivo: finalPath, movedTo });
  } catch (e) {
    send('error', { where: 'processOne', message: String(e?.message || e) });
  }
}


/** ================== IPC: SETTINGS (com enableAutoFix) ================== **/
ipcMain.handle("settings:load", async () => {
  const saved = await loadCfg();
  return {
    entrada: normalizeWin(saved.entrada || ""),
    working: normalizeWin(saved.working || ""),
    ok: normalizeWin(saved.ok || ""),
    erro: normalizeWin(saved.erro || ""),
    logsErrors: normalizeWin(saved.logsErrors || ""),
    logsProcessed: normalizeWin(saved.logsProcessed || ""),
    enableAutoFix: !!saved.enableAutoFix,
  };
});

ipcMain.handle("settings:save", async (_e, obj) => {
  const next = {
    entrada: normalizeWin(obj?.entrada || ""),
    working: normalizeWin(obj?.working || ""),
    ok: normalizeWin(obj?.ok || ""),
    erro: normalizeWin(obj?.erro || ""),
    logsErrors: normalizeWin(obj?.logsErrors || ""),
    logsProcessed: normalizeWin(obj?.logsProcessed || ""),
    enableAutoFix: !!obj?.enableAutoFix,
  };
  await saveCfg(next);
  currentCfg = next;
  return { ok: true, saved: next };
});
ipcMain.handle("settings:testPaths", async (_e, obj) => {
  const cfg = {
    entrada: normalizeWin(obj?.entrada || ""),
    working: normalizeWin(obj?.working || ""),
    ok: normalizeWin(obj?.ok || ""),
    erro: normalizeWin(obj?.erro || ""),
    logsErrors: normalizeWin(obj?.logsErrors || ""),
    logsProcessed: normalizeWin(obj?.logsProcessed || ""),
    enableAutoFix: !!obj?.enableAutoFix,
  };
  return await testPathsAll(cfg);
});

ipcMain.handle("settings:pickFolder", async (_e, initial) => {
  const res = await dialog.showOpenDialog(win, {
    defaultPath: initial || undefined,
    properties: ["openDirectory", "createDirectory"],
  });
  if (res.canceled || !res.filePaths?.length) return null;
  return res.filePaths[0];
});

/** ================== IPC: ANALYZER ================== **/
ipcMain.handle("analyzer:start", async (_e, overrideCfg) => {
  try {
    const saved = currentCfg && Object.keys(currentCfg).length ? currentCfg : await loadCfg();
    const raw = overrideCfg && Object.keys(overrideCfg).length ? overrideCfg : saved;

    const cfg = {
      entrada: normalizeWin(raw.entrada),
      working: normalizeWin(raw.working),
      ok: normalizeWin(raw.ok),
      erro: normalizeWin(raw.erro),
      logsErrors: normalizeWin(raw.logsErrors),
      logsProcessed: normalizeWin(raw.logsProcessed),
      enableAutoFix: !!raw.enableAutoFix,
    };

    for (const k of ["entrada", "working", "ok", "erro"]) {
      if (!cfg[k]) { send("error", { where: "start", message: `Config inválida: '${k}' vazio.` }); return false; }
      await fse.ensureDir(cfg[k]);
    }
    currentCfg = cfg;

    if (watcher) { send("started", { watching: cfg.entrada }); return true; }

    const isUncEntrada = isUNC(cfg.entrada);
    watcher = chokidar.watch(cfg.entrada, {
      ignoreInitial: false,
      depth: 0,
      awaitWriteFinish: { stabilityThreshold: 600, pollInterval: 120 },
      usePolling: isUncEntrada,
      interval: isUncEntrada ? 800 : 100,
    });

    watcher.on("add",    (p) => p.toLowerCase().endsWith(".xml") && processOne(p, cfg));
    watcher.on("change", (p) => p.toLowerCase().endsWith(".xml") && processOne(p, cfg));
    watcher.on("error",  (err) => send("error", { where: "watch", message: String(err) }));

    send("started", { watching: cfg.entrada });
    return true;
  } catch (e) {
    send("error", { where: "start", message: String((e && e.message) || e) });
    return false;
  }
});

ipcMain.handle("analyzer:stop", async () => {
  try {
    if (watcher) { await watcher.close(); watcher = null; }
    send("stopped", {});
    return true;
  } catch (e) {
    send("error", { where: "stop", message: String((e && e.message) || e) });
    return false;
  }
});

ipcMain.handle("analyzer:scanOnce", async () => {
  try {
    const cfg = currentCfg || (await loadCfg());
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

/** -------- helpers para openInFolder / reprocessOne -------- **/
function dirname(p) { try { return path.dirname(p); } catch { return ""; } }
async function resolveFilePathMaybeBase(input, cfg) {
  if (!input) return null;
  if (await fse.pathExists(input)) return input;
  const base = path.basename(input);
  const candidates = [cfg?.entrada, cfg?.ok, cfg?.erro, cfg?.working].filter(Boolean);
  for (const dir of candidates) {
    const full = path.join(dir, base);
    if (await fse.pathExists(full)) return full;
  }
  return null;
}

/** --- abrir na pasta --- */
ipcMain.handle("analyzer:openInFolder", async (_e, fileFullPath) => {
  try {
    const cfg  = currentCfg || (await loadCfg());
    const real = await resolveFilePathMaybeBase(fileFullPath, cfg);
    if (!real) {
      send("error", { where: "openInFolder", message: "Arquivo não encontrado." });
      return false;
    }

    const p = path.resolve(real);

    if (process.platform === "win32") {
      exec(`explorer.exe /select,"${p.replace(/\//g, "\\")}"`);
    } else if (process.platform === "darwin") {
      exec(`open -R "${p}"`);
    } else {
      const dir = path.dirname(p);
      try { await shell.openPath(dir); } catch {}
    }

    return true;
  } catch (e) {
    send("error", { where: "openInFolder", message: String((e && e.message) || e) });
    return false;
  }
});

/** --- reprocessar --- */
ipcMain.handle("analyzer:reprocessOne", async (_e, fileFullPath) => {
  try {
    const cfg = currentCfg || (await loadCfg());
    if (!cfg?.working) { send("error", { where: "reprocessOne", message: "Config faltando (working)." }); return false; }

    const real = await resolveFilePathMaybeBase(fileFullPath, cfg);
    if (!real) { send("error", { where: "reprocessOne", message: "Arquivo não encontrado." }); return false; }

    await fse.ensureDir(cfg.working);
    const base = path.basename(real);
    const staging = path.join(cfg.working, base);

    await fse.copy(real, staging, { overwrite: true });
    await processOne(staging, cfg);
    return true;
  } catch (e) {
    send("error", { where: "reprocessOne", message: String((e && e.message) || e) });
    return false;
  }
});

// helper to escape regex special chars
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&");
}
// backup/history files for replace/undo
const REPLACE_BACKUP_DIR = path.join(app.getPath('userData'), 'backups');
const REPLACE_HISTORY_FILE = path.join(app.getPath('userData'), 'replace-history.json');

async function readReplaceHistory() {
  try { return JSON.parse(await fsp.readFile(REPLACE_HISTORY_FILE, 'utf8')); } catch { return []; }
}
async function writeReplaceHistory(arr) {
  try { await fse.ensureFile(REPLACE_HISTORY_FILE); await fsp.writeFile(REPLACE_HISTORY_FILE, JSON.stringify(arr || [], null, 2), 'utf8'); } catch {}
}
async function appendReplaceHistory(entry) {
  const h = await readReplaceHistory();
  h.push(entry);
  await writeReplaceHistory(h);
}

/** --- replace a detected cor coringa in the given file (creates backup + history) --- **/
ipcMain.handle("analyzer:replaceCoringa", async (_e, obj) => {
  try {
    const { filePath, from, to } = obj || {};
    if (!filePath || !from || typeof to === 'undefined') { send('error', { where: 'replaceCoringa', message: 'Parâmetros inválidos.' }); return { ok: false, message: 'invalid-params' }; }

    const cfg = currentCfg || (await loadCfg());
    const real = await resolveFilePathMaybeBase(filePath, cfg);
    if (!real) { send('error', { where: 'replaceCoringa', message: 'Arquivo não encontrado.' }); return { ok: false, message: 'not-found' }; }

    // read original
    const raw = await fsp.readFile(real, 'utf8');

    const re = new RegExp(`\\b${escapeRegExp(String(from))}\\b`, 'gi');
    let count = 0;
    const replaced = raw.replace(re, (m) => { count++; return String(to); });
    if (count === 0) return { ok: false, message: 'no-match' };

    // ensure backup dir and write backup copy
    await fse.ensureDir(REPLACE_BACKUP_DIR);
    const base = path.basename(real);
    const backupName = `${base.replace(/\.xml$/i,'')}_backup_${Date.now()}.xml`;
    const backupPath = path.join(REPLACE_BACKUP_DIR, backupName);
    try { await fse.copy(real, backupPath, { overwrite: true }); } catch (e) { /* continue even if backup fails */ }

    // write replaced content
    await fsp.writeFile(real, replaced, 'utf8');

    // append history entry
    const entry = {
      id: Date.now(),
      file: path.resolve(real),
      backupPath: backupPath,
      timestamp: new Date().toISOString(),
      from: String(from),
      to: String(to),
      replaced: count,
      undone: false,
    };
    try { await appendReplaceHistory(entry); } catch (e) { /* ignore */ }

    // reprocess the updated file (will revalidate and move if needed)
    try { await processOne(real, cfg); } catch (e) { /* ignore */ }

    return { ok: true, replaced: count, backupPath };
  } catch (e) {
    send('error', { where: 'replaceCoringa', message: String((e && e.message) || e) });
    return { ok: false, message: String((e && e.message) || e) };
  }
});

/** --- undo last replace for a given file --- **/
ipcMain.handle('analyzer:undoReplace', async (_e, obj) => {
  try {
    const { filePath } = obj || {};
    if (!filePath) return { ok: false, message: 'invalid-params' };
    const real = path.resolve(filePath);
    const hist = await readReplaceHistory();
    // find last matching entry for this file that is not undone
    for (let i = hist.length - 1; i >= 0; i--) {
      const en = hist[i];
      if (!en || en.undone) continue;
      // match either exact path or same basename (in case file was moved after processing)
      if (path.resolve(en.file) === real || path.basename(en.file) === path.basename(real)) {
        const backup = en.backupPath;
        if (!backup || !(await fse.pathExists(backup))) return { ok: false, message: 'backup-not-found' };
        // restore
        try { await fse.copy(backup, real, { overwrite: true }); } catch (e) { return { ok: false, message: 'restore-failed' }; }
        // mark undone
        hist[i].undone = true;
        await writeReplaceHistory(hist);
        // reprocess
        try { await processOne(real, currentCfg || await loadCfg()); } catch (e) { /* ignore */ }
        return { ok: true, restored: true, entry: hist[i] };
      }
    }
    return { ok: false, message: 'no-history' };
  } catch (e) {
    send('error', { where: 'undoReplace', message: String((e && e.message) || e) });
    return { ok: false, message: String((e && e.message) || e) };
  }
});

/** ----------------- lifecycle ----------------- **/
app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
