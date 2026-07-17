// main/helpers.js
// Utilitários compartilhados: normalização de caminhos, configuração (load/save/sanitize),
// busca de arquivos, envio de eventos para o renderer e histórico de substituições.
const path = require("path");
const fs = require("fs");
const fsp = fs.promises;
const fse = require("fs-extra");
const state = require("./state");

function isUNC(p) { return typeof p === "string" && p.startsWith("\\\\"); }
function normalizeWin(p) { if (!p) return ""; return isUNC(p) ? p.replace(/\//g, "\\") : path.normalize(p); }

// Remove diacritics/accents from a string for robust matching
function removeAccents(str) {
  if (typeof str !== 'string') return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

async function loadCfg() { try { return JSON.parse(await fsp.readFile(state.CFG_FILE, "utf8")); } catch { return {}; } }

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

function send(evt, payload) {
  try { state.win && state.win.webContents.send("analyzer:event", { evt, payload }); } catch { }
}

/** Prepara objeto de config pronto para salvar (sanitizado) **/
function sanitizeCfg(obj) {
  return {
    entrada: normalizeWin(obj?.entrada || ""),
    exportacao: normalizeWin(obj?.exportacao || obj?.working || ""),
    ok: normalizeWin(obj?.ok || ""),
    erro: normalizeWin(obj?.erro || ""),
    drawings: normalizeWin(obj?.drawings || ""),
    simplificado: normalizeWin(obj?.simplificado || ""),
    busca: normalizeWin(obj?.busca || ""),
    enableAutoFix: obj?.enableAutoFix !== undefined ? !!obj.enableAutoFix : true,
    schedulerEnabled: obj?.schedulerEnabled !== undefined ? !!obj.schedulerEnabled : true,
    schedulerTimes: obj?.schedulerTimes || "11:30, 17:30",
    schedulerDays: obj?.schedulerDays || "seg-sex",
    cleanupEnabled: obj?.cleanupEnabled !== undefined ? !!obj.cleanupEnabled : false,
    cleanupTime: obj?.cleanupTime || "17:30",
    cleanupRetentionDays: obj?.cleanupRetentionDays !== undefined ? Number(obj.cleanupRetentionDays) : 0,
    cleanupCleanOk: obj?.cleanupCleanOk !== undefined ? !!obj.cleanupCleanOk : true,
    cleanupCleanErro: obj?.cleanupCleanErro !== undefined ? !!obj.cleanupCleanErro : true,
  };
}

/** Salvar config **/
async function saveCfg(obj) {
  const final = sanitizeCfg(obj);
  await fse.writeJson(state.CFG_FILE, final, { spaces: 2 });
  state.currentCfg = final;
  return final;
}

/** Objeto de teste p/ pasta **/
async function testPaths(obj) {
  const payload = sanitizeCfg(obj);
  const res = {};
  for (const k of ["entrada", "exportacao", "ok", "erro"]) {
    res[k] = await checkWrite(payload[k]);
  }
  for (const k of ["drawings", "simplificado", "busca"]) {
    res[k] = await checkWrite(payload[k]);
  }
  return res;
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

async function resolveFilePathMaybeBase(input, cfg) {
  if (!input) return null;
  if (await fse.pathExists(input)) return input;
  const base = path.basename(input);
  const candidates = [cfg?.entrada, cfg?.ok, cfg?.erro, cfg?.exportacao].filter(Boolean);
  for (const dir of candidates) {
    const full = path.join(dir, base);
    if (await fse.pathExists(full)) return full;
  }
  return null;
}

// função auxiliar para escapar caracteres especiais de regex
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&");
}

// --- histórico de substituições (replace/desfazer), usado pelas ferramentas de edição de XML ---
async function readReplaceHistory() {
  try { return JSON.parse(await fsp.readFile(state.REPLACE_HISTORY_FILE, 'utf8')); } catch { return []; }
}
async function writeReplaceHistory(arr) {
  try { await fse.ensureFile(state.REPLACE_HISTORY_FILE); await fsp.writeFile(state.REPLACE_HISTORY_FILE, JSON.stringify(arr || [], null, 2), 'utf8'); } catch { }
}
async function appendReplaceHistory(entry) {
  const h = await readReplaceHistory();
  h.push(entry);
  await writeReplaceHistory(h);
}

module.exports = {
  isUNC,
  normalizeWin,
  removeAccents,
  loadCfg,
  checkWrite,
  send,
  sanitizeCfg,
  saveCfg,
  testPaths,
  findFileRecursive,
  resolveFilePathMaybeBase,
  escapeRegExp,
  readReplaceHistory,
  writeReplaceHistory,
  appendReplaceHistory,
};
