// cjs-main.js — bootstrap do processo principal do Electron.
// A lógica de cada domínio (watcher, XML, DXF/muxarabi, ERP, relatórios,
// updater...) vive em módulos próprios dentro de main/. Este arquivo só
// cria a janela, liga o ciclo de vida do app e importa os módulos — cada
// um se registra sozinho (ipcMain.handle) ao ser importado.
const { app, BrowserWindow, ipcMain } = require("electron");
// Desabilitar aceleração de hardware para evitar erros de cache de GPU
app.disableHardwareAcceleration();
const path = require("path");
const { autoUpdater } = require("electron-updater");

const state = require("./main/state");

function createWindow() {
  state.win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  state.win.removeMenu();

  if (process.env.VITE_DEV) {
    state.win.loadURL("http://localhost:5174/");
    state.win.webContents.openDevTools({ mode: "detach" });
  } else {
    state.win.loadFile(path.join(__dirname, "dist/index.html"));
    // state.win.webContents.openDevTools({ mode: "detach" }); // Comentado para a versão final
  }
}

ipcMain.on('renderer-error', (_, err) => {
  console.error('[Renderer Error]', err);
});

// Cada módulo se auto-registra (ipcMain.handle) ao ser importado.
require("./main/settings");
require("./main/history");
require("./main/erp-search");
require("./main/xml-editor");
require("./main/watcher");
const dxfTools = require("./main/dxf-tools"); // eslint-disable-line no-unused-vars -- usado indiretamente via xml-processor
const { startAutomaticScheduler } = require("./main/reports-scheduler");
const { startPeriodicUpdateCheck } = require("./main/updater");

/** ----------------- lifecycle ----------------- **/
app.whenReady().then(() => {
  createWindow();
  startAutomaticScheduler();

  if (!process.env.VITE_DEV) {
    autoUpdater.checkForUpdatesAndNotify();
  }
  startPeriodicUpdateCheck();
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
