// main.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const watcher = require('./watcher');

let win;
let currentFolder = null;
let isWatching = false;
let cachedFiles = [];

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });

  const isDev = process.env.VITE_DEV === '1'; // ← chave!

  if (isDev) {
    // DEV: usar Vite
    win.loadURL('http://localhost:5174');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    // PROD: apontar para o build do Vite
    const indexPath = path.join(__dirname, 'build', 'index.html');
    win.loadFile(indexPath);
  }
}

app.whenReady().then(createWindow);

// ===== Handlers IPC 'watch:*' =====
// (mantém exatamente como te mandei antes; deixei só um resumo aqui)
ipcMain.handle('watch:pickFolder', async () => {
  const res = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
  if (res.canceled || !res.filePaths?.[0]) return { folder: null };
  currentFolder = res.filePaths[0];
  if (typeof watcher.setFolder === 'function') await watcher.setFolder(currentFolder);
  return { folder: currentFolder };
});

ipcMain.handle('watch:getState', async () => ({ folder: currentFolder, isWatching }));
ipcMain.handle('watch:start', async () => {
  if (!currentFolder && typeof watcher.getFolder !== 'function') throw new Error('Selecione uma pasta antes de iniciar.');
  if (isWatching) return { started: true };
  await watcher.startWatch((result) => {
    cachedFiles.unshift(result);
    win?.webContents.send('watch:file-processed', result);
  });
  isWatching = true;
  return { started: true };
});

ipcMain.handle('watch:stop', async () => {
  if (typeof watcher.stopWatch === 'function') await watcher.stopWatch();
  isWatching = false;
  return { started: false };
});

ipcMain.handle('watch:reanalyzeAll', async () => {
  const results = await watcher.reanalyzeAll?.();
  if (Array.isArray(results)) results.forEach(r => {
    cachedFiles.unshift(r);
    win?.webContents.send('watch:file-processed', r);
  });
  return { ok: true, count: Array.isArray(results) ? results.length : 0 };
});

ipcMain.handle('watch:reanalyzeErrors', async () => {
  const results = await watcher.reanalyzeErrors?.();
  if (Array.isArray(results)) results.forEach(r => {
    cachedFiles.unshift(r);
    win?.webContents.send('watch:file-processed', r);
  });
  return { ok: true, count: Array.isArray(results) ? results.length : 0 };
});

ipcMain.handle('watch:listFiles', async () => {
  if (typeof watcher.listFiles === 'function') {
    const list = await watcher.listFiles();
    cachedFiles = list;
    return list;
  }
  return cachedFiles;
});
