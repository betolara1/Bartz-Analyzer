// main/updater.js
// Auto-atualização via GitHub Releases: notificação nativa do Windows,
// popup no app e verificação periódica (a cada 10 minutos) mesmo com o
// programa aberto, para o usuário saber assim que uma nova versão sair.
const { app, ipcMain, Notification } = require("electron");
const { autoUpdater } = require("electron-updater");
const state = require("./state");

autoUpdater.autoDownload = false; // Não baixa sozinho, pergunta antes
autoUpdater.autoInstallOnAppQuit = true;

/** Mostra a notificação nativa do Windows (Central de Ações) e foca a janela ao clicar. */
function notifyUpdate(title, body) {
  try {
    if (!Notification.isSupported()) return;
    const n = new Notification({ title, body, silent: false });
    n.on('click', () => {
      if (state.win) {
        if (state.win.isMinimized()) state.win.restore();
        state.win.show();
        state.win.focus();
      }
    });
    n.show();
  } catch (e) {
    console.error('[Notification] Falha ao exibir notificação nativa:', String((e && e.message) || e));
  }
}

// "sem atualização"/erro só interessam quando o usuário clicou no botão "Atualizar".
// Nas verificações periódicas silenciosas, não incomodar o usuário.
let manualCheckPending = false;
let updateDownloadInProgress = false;
let updateReadyToInstall = false;

autoUpdater.on('update-available', (info) => {
  console.log('Update available:', info);
  const isManual = manualCheckPending;
  manualCheckPending = false;
  if (state.win) state.win.webContents.send('updater:available', { ...(info || {}), isManual });
  notifyUpdate(
    'Atualização disponível',
    `A versão ${info?.version || 'nova'} do Bartz Analyzer já está disponível.`
  );
});

autoUpdater.on('download-progress', (progressObj) => {
  if (state.win) state.win.webContents.send('updater:progress', progressObj);
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Update downloaded:', info);
  updateDownloadInProgress = false;
  updateReadyToInstall = true;
  if (state.win) state.win.webContents.send('updater:downloaded', info);
  notifyUpdate(
    'Atualização pronta',
    `A versão ${info?.version || 'nova'} foi baixada. Reinicie o programa para instalar.`
  );
});

autoUpdater.on('update-not-available', (info) => {
  console.log('Update not available:', info);
  if (state.win && manualCheckPending) state.win.webContents.send('updater:not-available', info);
  manualCheckPending = false;
});

autoUpdater.on('error', (err) => {
  console.error('AutoUpdater Error:', err);
  updateDownloadInProgress = false;
  if (state.win && manualCheckPending) state.win.webContents.send('updater:error', String(err.message || err));
  manualCheckPending = false;
});

// Verificação periódica: assim que uma release for publicada no GitHub,
// o popup aparece para o usuário em até 10 minutos, mesmo com o programa aberto.
const UPDATE_CHECK_INTERVAL_MS = 10 * 60 * 1000;
let updateCheckTimer = null;

function startPeriodicUpdateCheck() {
  if (process.env.VITE_DEV || updateCheckTimer) return;
  updateCheckTimer = setInterval(() => {
    if (updateDownloadInProgress || updateReadyToInstall) return; // não interferir em download/instalação pendente
    Promise.resolve(autoUpdater.checkForUpdates())
      .catch((e) => console.error('[Updater] Verificação periódica falhou:', String((e && e.message) || e)));
  }, UPDATE_CHECK_INTERVAL_MS);
  console.log(`[Updater] Verificação automática de atualização a cada ${UPDATE_CHECK_INTERVAL_MS / 60000} minutos.`);
}

ipcMain.handle('updater:check', () => {
  if (!process.env.VITE_DEV) {
    manualCheckPending = true;
    autoUpdater.checkForUpdates();
  } else {
    if (state.win) state.win.webContents.send('updater:not-available', { version: app.getVersion() });
  }
});

ipcMain.handle('updater:start-download', () => {
  updateDownloadInProgress = true;
  autoUpdater.downloadUpdate();
});

ipcMain.handle('updater:install', () => {
  autoUpdater.quitAndInstall();
});

module.exports = { startPeriodicUpdateCheck };
