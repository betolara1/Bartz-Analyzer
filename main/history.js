// main/history.js
// Persistência do relatório de análises em disco, para que fechar o programa
// não perca as análises já feitas (reidratado pelo Dashboard ao abrir).
const fs = require("fs");
const fsp = fs.promises;
const fse = require("fs-extra");
const { ipcMain } = require("electron");
const state = require("./state");

ipcMain.handle("analyzer:loadHistory", async () => {
  try {
    const raw = await fsp.readFile(state.HISTORY_FILE, "utf8");
    const data = JSON.parse(raw);
    const rows = Array.isArray(data?.rows) ? data.rows : (Array.isArray(data) ? data : []);
    console.log(`[History] ${rows.length} análises restauradas de ${state.HISTORY_FILE}`);
    return rows;
  } catch {
    return []; // primeiro uso ou arquivo inexistente
  }
});

ipcMain.handle("analyzer:saveHistory", async (_e, rows) => {
  try {
    if (!Array.isArray(rows)) return { ok: false, message: "Formato inválido: esperado array de linhas." };
    const capped = rows.slice(0, state.HISTORY_MAX_ROWS);
    // escrita atômica: grava em .tmp e renomeia, para nunca corromper o histórico
    const tmp = `${state.HISTORY_FILE}.tmp`;
    await fsp.writeFile(tmp, JSON.stringify({ savedAt: new Date().toISOString(), rows: capped }), "utf8");
    await fse.move(tmp, state.HISTORY_FILE, { overwrite: true });
    return { ok: true, count: capped.length };
  } catch (e) {
    return { ok: false, message: String((e && e.message) || e) };
  }
});
