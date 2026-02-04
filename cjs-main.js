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
  const keys = ["entrada", "working", "ok", "erro", "logsErrors", "logsProcessed", "drawings"];
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
  // ITEM SEM CÓDIGO: REFERENCIA="" E ITEM_BASE="" (ambas vazias)
  let hasMissingCode = false;
  // Procurar por tags ITEM, considerando que podem estar em múltiplas linhas
  const itemMatches = Array.from(txt.matchAll(/<ITEM\b[\s\S]*?>/gi));
  for (const m of itemMatches) {
    const itemTag = m[0];
    const hasEmptyRef = /\bREFERENCIA\s*=\s*""/i.test(itemTag);
    const hasEmptyBase = /\bITEM_BASE\s*=\s*""/i.test(itemTag);
    const hasNoRef = !/\bREFERENCIA\s*=\s*"/i.test(itemTag);
    const hasNoBase = !/\bITEM_BASE\s*=\s*"/i.test(itemTag);
    
    // Apenas marca erro se:
    // 1. REFERENCIA="" E ITEM_BASE="" (ambas explicitamente vazias)
    // 2. Ou REFERENCIA está vazia E ITEM_BASE não existe
    // 3. Ou REFERENCIA não existe E ITEM_BASE está vazio
    const refIsMissing = hasEmptyRef || hasNoRef;
    const baseIsMissing = hasEmptyBase || hasNoBase;
    
    if (refIsMissing && baseIsMissing) {
      hasMissingCode = true;
      break;
    }
  }
  if (hasMissingCode) payload.erros.push({ descricao: "ITEM SEM CÓDIGO" });
  
  if (/\bQUANTIDADE\s*=\s*"0(?:\.0+)?"/i.test(txt)) payload.erros.push({ descricao: "ITEM SEM QUANTIDADE" });
  if (/\bPRECO_TOTAL\s*=\s*"0(?:\.0+)?"/i.test(txt)) payload.erros.push({ descricao: "ITEM SEM PREÇO" });

  // coletar ocorrências de REFERENCIA="" E ITEM_BASE="" (ambas vazias/ausentes) para permitir preenchimento manual
  try {
    const refEmptyMatches = [];
    const itemMatches = Array.from(txt.matchAll(/<ITEM\b[\s\S]*?>/gi));
    for (const m of itemMatches) {
      const itemTag = m[0];
      const hasEmptyRef = /\bREFERENCIA\s*=\s*""/i.test(itemTag);
      const hasEmptyBase = /\bITEM_BASE\s*=\s*""/i.test(itemTag);
      const hasNoRef = !/\bREFERENCIA\s*=\s*"/i.test(itemTag);
      const hasNoBase = !/\bITEM_BASE\s*=\s*"/i.test(itemTag);
      
      // Coleta apenas se ambas forem vazias ou ausentes
      const refIsMissing = hasEmptyRef || hasNoRef;
      const baseIsMissing = hasEmptyBase || hasNoBase;
      
      if (refIsMissing && baseIsMissing) {
        const snippet = ((itemTag || '').trim()).slice(0, 400);
        const idMatch = snippet.match(/\bID\s*=\s*"([^"]+)"/i);
        const id = idMatch ? idMatch[1] : null;
        refEmptyMatches.push({ id, snippet });
      }
    }
    if (refEmptyMatches.length) {
      payload.meta = payload.meta || {};
      // dedupe by id or snippet
      const map = new Map();
      for (const r of refEmptyMatches) {
        const key = r.id ? `id:${r.id}` : `sn:${r.snippet}`;
        if (!map.has(key)) map.set(key, r);
      }
      payload.meta.referenciaEmpty = Array.from(map.values());
    }
  } catch (e) { /* ignore */ }

  // ===== ITEM_BASE="ES08" (DUPLADO 37MM) =====
  try {
    const es08Matches = [];
    for (const m of txt.matchAll(/<ITEM\b[^>]*\bITEM_BASE\s*=\s*"ES08"[^>]*>/gi)) {
      const snippet = ((m[0] || '').trim()).slice(0, 400);
      const idMatch = snippet.match(/\bID\s*=\s*"([^"]+)"/i);
      const id = idMatch ? idMatch[1] : null;
      const refMatch = snippet.match(/\bREFERENCIA\s*=\s*"([^"]*)"/i);
      const referencia = refMatch ? refMatch[1] : null;
      const desenhoMatch = snippet.match(/\bDESENHO\s*=\s*"([^"]*)"/i);
      const desenho = desenhoMatch ? desenhoMatch[1] : null;
      es08Matches.push({ id, referencia, desenho, snippet });
    }
    if (es08Matches.length) {
      payload.erros.push({ descricao: "ITEM DUPLADO 37MM" });
      payload.tags.push("duplado37mm");
      payload.meta = payload.meta || {};
      // dedupe by id or snippet
      const map = new Map();
      for (const r of es08Matches) {
        const key = r.id ? `id:${r.id}` : `sn:${r.snippet}`;
        if (!map.has(key)) map.set(key, r);
      }
      payload.meta.es08Matches = Array.from(map.values());
    }
  } catch (e) { /* ignore */ }

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
    "CAPA_CG1","CAPA_CG1", "FITA_CG1_19", "FITA_CG2_19", "TAPAFURO_CG1", "TAPAFURO_CG2", "CAPA_CG1", "CAPA_CG2",
  ];
  // detectar e registrar todos os tokens "cor coringa" correspondidos (únicos, maiúsculos)
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
    const originalPath = path.resolve(fileFullPath); // Guardar caminho original
    let movedTo = null;

    if (destDir) {
      await fse.ensureDir(destDir);
      const target = path.join(destDir, baseName);
      if (path.resolve(target).toLowerCase() !== finalPath.toLowerCase()) {
        try { 
          await fse.move(finalPath, target, { overwrite: true }); 
          finalPath = path.resolve(target); 
          movedTo = path.resolve(destDir);
          
          // ✅ DELETAR arquivo antigo de ERRO se foi movido para OK
          if (isOK && originalPath.toLowerCase() !== finalPath.toLowerCase()) {
            try {
              await fse.remove(originalPath);
            } catch (delErr) {
              // Falha ao deletar é aceitável
            }
          }
        } catch {}
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
    drawings: normalizeWin(saved.drawings || ""),
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
    drawings: normalizeWin(obj?.drawings || ""),
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

// função auxiliar para escapar caracteres especiais de regex
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&");
}
// arquivos de backup/histórico para replace/desfazer
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

    // garantir diretório de backup e escrever cópia de backup
    await fse.ensureDir(REPLACE_BACKUP_DIR);
    const base = path.basename(real);
    const backupName = `${base.replace(/\.xml$/i,'')}_backup_${Date.now()}.xml`;
    const backupPath = path.join(REPLACE_BACKUP_DIR, backupName);
    try { await fse.copy(real, backupPath, { overwrite: true }); } catch (e) { /* continuar mesmo se backup falhar */ }

    // escrever conteúdo substituído
    await fsp.writeFile(real, replaced, 'utf8');

    // adicionar entrada ao histórico
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
    try { await appendReplaceHistory(entry); } catch (e) { /* ignorar */ }

    // reprocessar arquivo atualizado (vai revalidar e mover se necessário)
    try { await processOne(real, cfg); } catch (e) { /* ignorar */ }

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
    // encontrar última entrada correspondente para este arquivo que não foi desfeita
    for (let i = hist.length - 1; i >= 0; i--) {
      const en = hist[i];
      if (!en || en.undone) continue;
      // corresponder caminho exato ou mesmo nome base (caso arquivo foi movido após processamento)
      if (path.resolve(en.file) === real || path.basename(en.file) === path.basename(real)) {
        const backup = en.backupPath;
        if (!backup || !(await fse.pathExists(backup))) return { ok: false, message: 'backup-not-found' };
        // restaurar
        try { await fse.copy(backup, real, { overwrite: true }); } catch (e) { return { ok: false, message: 'restore-failed' }; }
        // marcar desfeito
        hist[i].undone = true;
        await writeReplaceHistory(hist);
        // reprocessar
        try { await processOne(real, currentCfg || await loadCfg()); } catch (e) { /* ignorar */ }
        return { ok: true, restored: true, entry: hist[i] };
      }
    }
    return { ok: false, message: 'no-history' };
  } catch (e) {
    send('error', { where: 'undoReplace', message: String((e && e.message) || e) });
    return { ok: false, message: String((e && e.message) || e) };
  }
});

/** --- replace all CG1/CG2 occurrences in a file according to provided map --- **/
ipcMain.handle('analyzer:replaceCgGroups', async (_e, obj) => {
  try {
    const { filePath, map } = obj || {};
    if (!filePath || !map || (typeof map !== 'object')) { return { ok: false, message: 'invalid-params' }; }

    const cfg = currentCfg || (await loadCfg());
    const real = await resolveFilePathMaybeBase(filePath, cfg);
    if (!real) return { ok: false, message: 'not-found' };

    const raw = await fsp.readFile(real, 'utf8');
    let replacedText = raw;
    const counts = {};
    // aplicar substituições para chaves conhecidas (cg1, cg2) -- case-insensitive
    for (const key of Object.keys(map)) {
      const val = map[key];
      if (!val) { counts[key] = 0; continue; }
      const re = new RegExp(escapeRegExp(key.toString()), 'gi');
      let c = 0;
      replacedText = replacedText.replace(re, (m) => { c++; return String(val); });
      counts[key] = c;
    }

    const total = Object.values(counts).reduce((s, n) => s + (n || 0), 0);
    if (total === 0) return { ok: false, message: 'no-match' };

    // backup
    await fse.ensureDir(REPLACE_BACKUP_DIR);
    const base = path.basename(real);
    const backupName = `${base.replace(/\.xml$/i,'')}_backup_cg_${Date.now()}.xml`;
    const backupPath = path.join(REPLACE_BACKUP_DIR, backupName);
    try { await fse.copy(real, backupPath, { overwrite: true }); } catch (e) { /* continuar */ }

    // escrever substituído
    await fsp.writeFile(real, replacedText, 'utf8');

    // entrada do histórico
    const entry = {
      id: Date.now(),
      file: path.resolve(real),
      backupPath,
      timestamp: new Date().toISOString(),
      type: 'cg-groups',
      map,
      counts,
      undone: false,
    };
    try { await appendReplaceHistory(entry); } catch (e) { /* ignorar */ }

    // reprocessar
    try { await processOne(real, cfg); } catch (e) { /* ignorar */ }

    return { ok: true, counts, backupPath };
  } catch (e) {
    send('error', { where: 'replaceCgGroups', message: String((e && e.message) || e) });
    return { ok: false, message: String((e && e.message) || e) };
  }
});

/** --- fill empty REFERENCIA attributes (REFERENCIA="" -> REFERENCIA="<value>") --- **/
ipcMain.handle('analyzer:fillReferencia', async (_e, obj) => {
  try {
    const { filePath, value } = obj || {};
    if (!filePath || typeof value === 'undefined') return { ok: false, message: 'invalid-params' };

    const cfg = currentCfg || (await loadCfg());
    const real = await resolveFilePathMaybeBase(filePath, cfg);
    if (!real) return { ok: false, message: 'not-found' };

    const raw = await fsp.readFile(real, 'utf8');
    const re = /\bREFERENCIA\s*=\s*""/gi;
    let count = 0;
    const replaced = raw.replace(re, (m) => { count++; return `REFERENCIA="${String(value)}"`; });
    if (count === 0) return { ok: false, message: 'no-match' };

    // backup
    await fse.ensureDir(REPLACE_BACKUP_DIR);
    const base = path.basename(real);
    const backupName = `${base.replace(/\.xml$/i,'')}_backup_ref_${Date.now()}.xml`;
    const backupPath = path.join(REPLACE_BACKUP_DIR, backupName);
    try { await fse.copy(real, backupPath, { overwrite: true }); } catch (e) { /* continue */ }

    await fsp.writeFile(real, replaced, 'utf8');

    const entry = {
      id: Date.now(),
      file: path.resolve(real),
      backupPath,
      timestamp: new Date().toISOString(),
      type: 'fill-referencia',
      value: String(value),
      replaced: count,
      undone: false,
    };
    try { await appendReplaceHistory(entry); } catch (e) { /* ignore */ }

    try { await processOne(real, cfg); } catch (e) { /* ignore */ }

    return { ok: true, replaced: count, backupPath };
  } catch (e) {
    send('error', { where: 'fillReferencia', message: String((e && e.message) || e) });
    return { ok: false, message: String((e && e.message) || e) };
  }
});

/** --- preencher REFERENCIA apenas para IDs específicas de ITEM --- **/
ipcMain.handle('analyzer:fillReferenciaByIds', async (_e, obj) => {
  try {
    const { filePath, replacements } = obj || {};
    // replacements: [{ id: string, value: string }, ...]
    if (!filePath || !Array.isArray(replacements) || replacements.length === 0) return { ok: false, message: 'invalid-params' };

    const cfg = currentCfg || (await loadCfg());
    const real = await resolveFilePathMaybeBase(filePath, cfg);
    if (!real) return { ok: false, message: 'not-found' };

    let raw = await fsp.readFile(real, 'utf8');
    const counts = {};

    for (const rep of replacements) {
      const id = rep?.id;
      const value = rep?.value;
      if (!id || typeof value === 'undefined') { counts[id] = 0; continue; }
      
      // Encontrar a tag ITEM com ID correspondente e substituir REFERENCIA dentro dela
      // FIX CRÍTICO: Não usar [\s\S]*? sem terminação apropriada
      // Em vez disso, corresponder apenas até /> ou fechamento > 
      const escapedId = escapeRegExp(String(id));
      
      // Este regex lida adequadamente com tags multi-linha ao:
      // 1. Começar com <ITEM
      // 2. Usar [^<]* para corresponder atributos (qualquer coisa exceto outra tag)
      // 3. Permitir quebras de linha nos atributos com \s explícito
      // 4. Corresponder atributo ID
      // 5. Corresponder resto dos atributos até > ou />
      const itemRegex = new RegExp(`<ITEM(?:[^<]|\\n)*?ID\\s*=\\s*"${escapedId}"(?:[^<]|\\n)*?(?:>|/>)`, 'gi');
      
      let c = 0;
      const originalRaw = raw; // Guardar para debug
      raw = raw.replace(itemRegex, (itemMatch) => {
        // Passo 2: Substituir REFERENCIA dentro dessa tag ITEM específica
        // Lidar com casos onde REFERENCIA talvez não exista ainda (adicionar se necessário)
        let updated = itemMatch;
        // Procurar atributo REFERENCIA - usar [\s\S] para lidar com quebras de linha
        if (/REFERENCIA\s*=\s*"[^"]*"/i.test(updated)) {
          updated = updated.replace(
            /REFERENCIA\s*=\s*"[^"]*"/i,
            `REFERENCIA="${String(value)}"`
          );
        } else {
          // Atributo REFERENCIA não existe, adiciona antes do fechamento
          // Encontrar o > no final, tratando possível espaçamento/quebras de linha antes dele
          updated = updated.replace(/[\s\S]*?>/, (match) => {
            return match.replace(/[\s\n]*>/, ` REFERENCIA="${String(value)}"`);
          });
        }
        c++;
        return updated;
      });
      
      counts[id] = c;
      
      if (c === 0) {
        // Nenhuma correspondência encontrada
      }
    }

    const total = Object.values(counts).reduce((s, n) => s + (n || 0), 0);
    if (total === 0) return { ok: false, message: 'no-match' };

    // backup
    await fse.ensureDir(REPLACE_BACKUP_DIR);
    const base = path.basename(real);
    const backupName = `${base.replace(/\.xml$/i,'')}_backup_refids_${Date.now()}.xml`;
    const backupPath = path.join(REPLACE_BACKUP_DIR, backupName);
    try { await fse.copy(real, backupPath, { overwrite: true }); } catch (e) { /* continue */ }

    // escrever arquivo
    await fsp.writeFile(real, raw, 'utf8');
    
    // Verificar se foi escrito
    const writtenContent = await fsp.readFile(real, 'utf8');

    // history
    const entry = {
      id: Date.now(),
      file: path.resolve(real),
      backupPath,
      timestamp: new Date().toISOString(),
      type: 'fill-referencia-ids',
      replacements,
      counts,
      undone: false,
    };
    try { await appendReplaceHistory(entry); } catch (e) { /* ignorar */ }

    // Reprocessar arquivo (isso também o moverá se necessário)
    // Mas precisamos rastrear o novo caminho se ele se mover
    let finalPath = path.resolve(real);
    const originalPath = finalPath; // Guardar caminho original para limpeza
    try { 
      const analysis = await validateXml(real, cfg);
      const isOK = (analysis.erros || []).length === 0;
      const baseName = path.basename(real);
      const destDir  = isOK ? (cfg.ok || cfg.working) : (cfg.erro || cfg.working);

      if (destDir) {
        await fse.ensureDir(destDir);
        const target = path.join(destDir, baseName);
        if (path.resolve(target).toLowerCase() !== finalPath.toLowerCase()) {
          try { 
            await fse.move(finalPath, target, { overwrite: true }); 
            finalPath = path.resolve(target);
            
            // DELETAR arquivo antigo de ERRO se foi movido para OK
            if (isOK && originalPath.toLowerCase() !== finalPath.toLowerCase()) {
              try {
                await fse.remove(originalPath);
              } catch (delErr) {
                // Falha ao deletar é aceitável
              }
            }
          } catch {}
        }
      }

      const logDir = isOK ? cfg.logsProcessed : cfg.logsErrors;
      if (logDir) {
        await fse.ensureDir(logDir);
        const logName = baseName.replace(/\.xml$/i, '') + `_${isOK ? 'ok' : 'erro'}.json`;
        await fsp.writeFile(path.join(logDir, logName), JSON.stringify(analysis, null, 2), 'utf8');
      }

      send('file-validated', { ...analysis, arquivo: finalPath });
    } catch (e) { 
      send('error', { where: 'fillReferenciaByIds-processOne', message: String(e?.message || e) });
    }

    return { ok: true, counts, backupPath, arquivo: finalPath };
  } catch (e) {
    send('error', { where: 'fillReferenciaByIds', message: String((e && e.message) || e) });
    return { ok: false, message: String((e && e.message) || e) };
  }
});

/** ================== IPC: FIND DRAWING FILE ================== **/
ipcMain.handle('analyzer:findDrawingFile', async (_e, obj) => {
  try {
    const { drawingCode, xmlFilePath } = obj || {};
    
    console.log('[DXF Search] ========== INICIANDO BUSCA ==========');
    console.log('[DXF Search] Código de desenho procurado:', drawingCode);
    console.log('[DXF Search] Arquivo XML:', xmlFilePath);
    
    const cfg = (await loadCfg()) || {};
    const drawingsFolder = cfg?.drawings;
    
    console.log('[DXF Search] Pasta de desenhos configurada:', drawingsFolder);
    
    // Se a pasta não foi configurada, usar Desktop/desenho_dxf como fallback
    let dxfFolderPath = drawingsFolder;
    if (!dxfFolderPath) {
      const desktopPath = path.join(app.getPath('home'), 'Desktop');
      dxfFolderPath = path.join(desktopPath, 'desenho_dxf');
      console.log('[DXF Search] Pasta não configurada, usando fallback:', dxfFolderPath);
    }
    
    console.log('[DXF Search] Caminho final a buscar:', dxfFolderPath);
    
    // Verificar se a pasta existe
    const folderExists = await fse.pathExists(dxfFolderPath);
    console.log('[DXF Search] Pasta existe?', folderExists);
    
    if (!folderExists) {
      console.log('[DXF Search] ❌ FALHA: Pasta não encontrada');
      return { found: false, path: null, message: `Pasta não encontrada: ${dxfFolderPath}` };
    }
    
    // Ler arquivos da pasta
    const files = await fsp.readdir(dxfFolderPath);
    console.log('[DXF Search] Total de arquivos na pasta:', files.length);
    console.log('[DXF Search] Arquivos encontrados:');
    files.forEach((f, i) => {
      console.log(`  [${i + 1}] ${f}`);
    });
    
    // Procurar arquivo que comece com o código de desenho (case-insensitive)
    const searchPattern = drawingCode.toLowerCase();
    console.log('[DXF Search] Padrão de busca (lowercase):', searchPattern);
    console.log('[DXF Search] Procurando arquivo que comece com:', searchPattern);
    
    const foundFile = files.find(f => {
      const lowerF = f.toLowerCase();
      const matches = lowerF.startsWith(searchPattern);
      console.log(`  [Comparação] "${f}" (${lowerF}) -> começa com "${searchPattern}"? ${matches}`);
      return matches;
    });
    
    if (!foundFile) {
      console.log('[DXF Search] ❌ FALHA: Nenhum arquivo corresponde ao padrão');
      return { found: false, path: null, message: `Arquivo "${drawingCode}" não encontrado em ${dxfFolderPath}` };
    }
    
    const fullPath = path.join(dxfFolderPath, foundFile);
    console.log('[DXF Search] ✅ ARQUIVO DXF ENCONTRADO');
    console.log('[DXF Search] Nome do arquivo:', foundFile);
    console.log('[DXF Search] Caminho completo:', fullPath);
    
    // ===== ANALISAR ARQUIVO DXF =====
    let panelInfo = null;
    let fresaInfo = null;
    
    try {
      console.log('[DXF Analysis] Lendo arquivo DXF:', fullPath);
      const dxfContent = await fsp.readFile(fullPath, 'utf8');
      const lines = dxfContent.split(/\r?\n/);
      
      console.log('[DXF Analysis] Total de linhas no DXF:', lines.length);
      
      // 1. PROCURAR PRIMEIRO PANEL e extrair o valor de 39 (dimensão)
      let panelFound = false;
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        if (line.toUpperCase() === 'PANEL' && !panelFound) {
          console.log('[DXF Analysis] ✓ PANEL encontrado na linha', i);
          panelFound = true;
          
          // Procurar o próximo "39" para pegar a dimensão
          for (let j = i + 1; j < lines.length; j++) {
            const codeLine = lines[j].trim();
            if (codeLine === '39') {
              const dimensionLine = j + 1 < lines.length ? lines[j + 1].trim() : null;
              if (dimensionLine) {
                const dimension = dimensionLine.startsWith('-') ? dimensionLine : '-' + dimensionLine;
                panelInfo = {
                  panelCode: 'PANEL',
                  dimension: dimension
                };
                console.log('[DXF Analysis] ✓ Dimensão do PANEL encontrada:', dimension);
                break;
              }
            }
          }
          break;
        }
      }
      
      if (!panelFound) {
        console.log('[DXF Analysis] ✗ Nenhum PANEL encontrado no DXF');
      }
      
      // 2. PROCURAR FRESA_12_37 ou FRESA_12_18
      let fresa37Found = false;
      let fresa18Found = false;
      let fresa37Count = 0;
      let fresa18Count = 0;
      let firstFresa37Info = null;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim().toUpperCase();
        if (line === 'FRESA_12_37') {
          fresa37Found = true;
          fresa37Count++;
          
          // Se for a primeira FRESA_12_37, extrair detalhes
          if (fresa37Count === 1) {
            console.log('[DXF Analysis] ✓ PRIMEIRA FRESA_12_37 encontrada na linha', i);
            
            // Procurar pelos códigos 30 (-37) e 39 (37 ou -37) após essa linha
            let hasNegative37 = false;
            let hasPositive37 = false;
            
            for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
              const codeLine = lines[j].trim();
              
              if (codeLine === '30') {
                const valueLine = j + 1 < lines.length ? lines[j + 1].trim() : null;
                if (valueLine === '-37') {
                  hasNegative37 = true;
                  console.log('[DXF Analysis]   ✓ Código 30 = -37 encontrado na linha', j);
                }
              }
              
              if (codeLine === '39') {
                const valueLine = j + 1 < lines.length ? lines[j + 1].trim() : null;
                if (valueLine === '37' || valueLine === '-37') {
                  hasPositive37 = true;
                  console.log('[DXF Analysis]   ✓ Código 39 =', valueLine, 'encontrado na linha', j);
                }
              }
            }
            
            firstFresa37Info = {
              hasNegative37,
              hasPositive37
            };
            
            console.log('[DXF Analysis]   Resumo FRESA_12_37: -37?', hasNegative37, '| 37?', hasPositive37);
          }
          
          console.log('[DXF Analysis] ✓ FRESA_12_37 encontrada na linha', i);
        } else if (line === 'FRESA_12_18') {
          fresa18Found = true;
          fresa18Count++;
          console.log('[DXF Analysis] ✓ FRESA_12_18 encontrada na linha', i);
        }
      }
      
      if (fresa37Found && fresa18Found) {
        fresaInfo = {
          fresaCode: `FRESA_12_37 (${fresa37Count}x) e FRESA_12_18 (${fresa18Count}x)`,
          status: 'Estado misto (contém ambas as versões)',
          count37: fresa37Count,
          count18: fresa18Count,
          firstFresa37: firstFresa37Info
        };
        console.log('[DXF Analysis] ✓ FRESA: Ambas as versões presentes');
      } else if (fresa37Found) {
        fresaInfo = {
          fresaCode: `FRESA_12_37 (${fresa37Count}x)`,
          status: 'Status: ⚠️ Ainda está DUPLICADO em 37MM',
          count37: fresa37Count,
          count18: 0,
          firstFresa37: firstFresa37Info
        };
        console.log('[DXF Analysis] ✓ FRESA: 37MM (DUPLICADO)');
      } else if (fresa18Found) {
        fresaInfo = {
          fresaCode: `FRESA_12_18 (${fresa18Count}x)`,
          status: 'Status: ✅ Corrigido para 18MM',
          count37: 0,
          count18: fresa18Count,
          firstFresa37: null
        };
        console.log('[DXF Analysis] ✓ FRESA: 18MM (CORRIGIDO)');
      } else {
        console.log('[DXF Analysis] ✗ Nenhuma FRESA_12_?? encontrada');
      }
      
    } catch (dxfErr) {
      console.log('[DXF Analysis] ✗ Erro ao ler DXF:', dxfErr.message);
    }
    
    return { 
      found: true, 
      path: fullPath, 
      name: foundFile,
      panelInfo,
      fresaInfo
    };
  } catch (e) {
    console.log('[DXF Search] ❌ ERRO DURANTE BUSCA:', e.message || e);
    console.error('[DXF Search] Stack completo:', e.stack);
    return { found: false, path: null, message: `Erro ao buscar: ${String(e && e.message || e)}` };
  }
});

/** ================== IPC: FIX FRESA 37 TO 18 ================== **/
ipcMain.handle('analyzer:fixFresa37to18', async (_e, dxfFilePath) => {
  try {
    console.log('[DXF Fix] ========== INICIANDO CORREÇÃO ==========');
    console.log('[DXF Fix] Arquivo DXF:', dxfFilePath);
    
    if (!dxfFilePath || !(await fse.pathExists(dxfFilePath))) {
      console.log('[DXF Fix] ❌ Arquivo não encontrado');
      return { ok: false, message: 'Arquivo não encontrado' };
    }
    
    // Ler arquivo
    const content = await fsp.readFile(dxfFilePath, 'utf8');
    const lines = content.split(/\r?\n/);
    
    console.log('[DXF Fix] Total de linhas:', lines.length);
    
    let modified = false;
    let panelModified = false;
    let fresaModified = false;
    let firstPanelFound = false;
    let firstFresa37Found = false;
    
    // Processar linhas
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // 1. Alterar primeiro PANEL: valor 39 de 37 ou -37 para 18 ou -18
      if (!firstPanelFound && line.toUpperCase() === 'PANEL') {
        console.log('[DXF Fix] ✓ PANEL encontrado na linha', i);
        firstPanelFound = true;
        
        // Procurar o código 39 após essa linha
        for (let j = i + 1; j < lines.length && j < i + 20; j++) {
          if (lines[j].trim() === '39') {
            const nextIdx = j + 1;
            if (nextIdx < lines.length) {
              const value = lines[nextIdx].trim();
              // Alterar 37 → 18 ou -37 → -18
              if (value === '37') {
                lines[nextIdx] = '18';
                console.log('[DXF Fix]   ✓ Código 39: 37 → 18 na linha', nextIdx);
                panelModified = true;
                modified = true;
              } else if (value === '-37') {
                lines[nextIdx] = '-18';
                console.log('[DXF Fix]   ✓ Código 39: -37 → -18 na linha', nextIdx);
                panelModified = true;
                modified = true;
              }
            }
            break;
          }
        }
      }
      
      // 2. Alterar primeira FRESA_12_37: valores 30 (-37→-18 ou 37→18) e 39 (37→18 ou -37→-18)
      if (!firstFresa37Found && line.toUpperCase() === 'FRESA_12_37') {
        console.log('[DXF Fix] ✓ PRIMEIRA FRESA_12_37 encontrada na linha', i);
        firstFresa37Found = true;
        
        // Procurar códigos 30 e 39 após essa linha
        for (let j = i + 1; j < lines.length && j < i + 20; j++) {
          const codeLine = lines[j].trim();
          
          // Alterar código 30: -37 → -18 ou 37 → 18
          if (codeLine === '30') {
            const nextIdx = j + 1;
            if (nextIdx < lines.length) {
              const value = lines[nextIdx].trim();
              if (value === '-37') {
                lines[nextIdx] = '-18';
                console.log('[DXF Fix]   ✓ Código 30: -37 → -18 na linha', nextIdx);
                fresaModified = true;
                modified = true;
              } else if (value === '37') {
                lines[nextIdx] = '18';
                console.log('[DXF Fix]   ✓ Código 30: 37 → 18 na linha', nextIdx);
                fresaModified = true;
                modified = true;
              }
            }
          }
          
          // Alterar código 39: 37 → 18 ou -37 → -18
          if (codeLine === '39') {
            const nextIdx = j + 1;
            if (nextIdx < lines.length) {
              const value = lines[nextIdx].trim();
              if (value === '37') {
                lines[nextIdx] = '18';
                console.log('[DXF Fix]   ✓ Código 39: 37 → 18 na linha', nextIdx);
                fresaModified = true;
                modified = true;
              } else if (value === '-37') {
                lines[nextIdx] = '-18';
                console.log('[DXF Fix]   ✓ Código 39: -37 → -18 na linha', nextIdx);
                fresaModified = true;
                modified = true;
              }
            }
          }
        }
      }
    }
    
    // 3. Substituir todas as ocorrências de FRESA_12_37 por FRESA_12_18
    let fresa37Replacements = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().toUpperCase() === 'FRESA_12_37') {
        lines[i] = lines[i].replace(/FRESA_12_37/i, 'FRESA_12_18');
        fresa37Replacements++;
        console.log('[DXF Fix] ✓ FRESA_12_37 → FRESA_12_18 na linha', i);
      }
    }
    
    if (fresa37Replacements > 0) {
      modified = true;
    }
    
    if (!modified) {
      console.log('[DXF Fix] ⚠️ Nenhuma alteração foi feita');
      return { ok: false, message: 'Nenhuma alteração foi necessária' };
    }
    
    // Escrever arquivo de volta
    const newContent = lines.join('\n');
    await fsp.writeFile(dxfFilePath, newContent, 'utf8');
    
    console.log('[DXF Fix] ✅ ARQUIVO CORRIGIDO COM SUCESSO');
    console.log('[DXF Fix] Alterações:');
    console.log('[DXF Fix]   - PANEL modificado:', panelModified);
    console.log('[DXF Fix]   - Primeira FRESA_12_37 modificada:', fresaModified);
    console.log('[DXF Fix]   - FRESA_12_37 → FRESA_12_18:', fresa37Replacements, 'ocorrências');
    
    return { 
      ok: true, 
      message: 'Arquivo corrigido com sucesso',
      changes: {
        panelModified,
        fresaModified,
        fresa37Replacements
      }
    };
  } catch (e) {
    console.log('[DXF Fix] ❌ ERRO NA CORREÇÃO:', e.message || e);
    console.error('[DXF Fix] Stack:', e.stack);
    return { ok: false, message: `Erro ao corrigir: ${String(e && e.message || e)}` };
  }
});

/** ----------------- lifecycle ----------------- **/
app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
