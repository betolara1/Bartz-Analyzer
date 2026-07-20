// main/settings.js
// Configuração persistida do app: pastas de entrada/saída, agendador, limpeza automática.
const { ipcMain, dialog } = require("electron");
const state = require("./state");
const { normalizeWin, loadCfg, sanitizeCfg, saveCfg, testPaths } = require("./helpers");

ipcMain.handle("settings:load", async () => {
  const saved = await loadCfg();
  return {
    entrada: normalizeWin(saved.entrada || ""),
    exportacao: normalizeWin(saved.exportacao || saved.working || ""),
    ok: normalizeWin(saved.ok || ""),
    erro: normalizeWin(saved.erro || ""),
    drawings: normalizeWin(saved.drawings || ""),
    drawingsCopy: normalizeWin(saved.drawingsCopy || ""),
    simplificado: normalizeWin(saved.simplificado || ""),
    busca: normalizeWin(saved.busca || ""),
    enableAutoFix: saved.enableAutoFix !== undefined ? !!saved.enableAutoFix : true,
    schedulerEnabled: saved.schedulerEnabled !== undefined ? !!saved.schedulerEnabled : true,
    schedulerTimes: saved.schedulerTimes || "11:30, 17:30",
    schedulerDays: saved.schedulerDays || "seg-sex",
    cleanupEnabled: saved.cleanupEnabled !== undefined ? !!saved.cleanupEnabled : false,
    cleanupTime: saved.cleanupTime || "17:30",
    cleanupRetentionDays: saved.cleanupRetentionDays !== undefined ? Number(saved.cleanupRetentionDays) : 0,
    cleanupCleanOk: saved.cleanupCleanOk !== undefined ? !!saved.cleanupCleanOk : true,
    cleanupCleanErro: saved.cleanupCleanErro !== undefined ? !!saved.cleanupCleanErro : true,
  };
});

ipcMain.handle("settings:save", async (_e, obj) => {
  const next = sanitizeCfg(obj);
  await saveCfg(next);
  state.currentCfg = next;
  return { ok: true, saved: next };
});

ipcMain.handle("settings:testPaths", async (_e, obj) => {
  const cfg = sanitizeCfg(obj);
  return await testPaths(cfg);
});

ipcMain.handle("settings:pickFolder", async (_e, initial) => {
  const res = await dialog.showOpenDialog(state.win, {
    defaultPath: initial || undefined,
    properties: ["openDirectory", "createDirectory"],
  });
  if (res.canceled || !res.filePaths?.length) return null;
  return res.filePaths[0];
});
