// src/main/main.ts
import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { Settings } from "./settings";
import { registerAnalyzerIPC } from "./analyzer";

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "../preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.VITE_DEV) {
    win.loadURL("http://localhost:5174/");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "../../index.html"));
  }

  // IPC – settings
  ipcMain.handle("settings:load", () => Settings.load());
  ipcMain.handle("settings:save", (_e, data) => Settings.save(data));
  ipcMain.handle("settings:testPaths", (_e, data) => Settings.testPaths(data));
  ipcMain.handle("settings:pickFolder", (_e, initial) => Settings.pickFolder(initial));

  // IPC – analyzer
  registerAnalyzerIPC(win);
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  