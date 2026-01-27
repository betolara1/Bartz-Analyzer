// preload.js  (CommonJS)
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  analyzer: {
    start: (cfg) => ipcRenderer.invoke('analyzer:start', cfg || {}),
    stop:  () => ipcRenderer.invoke('analyzer:stop'),
    scanOnce: () => ipcRenderer.invoke('analyzer:scanOnce'),
    onEvent: (cb) => {
      ipcRenderer.removeAllListeners('analyzer:event');
      ipcRenderer.on('analyzer:event', (_e, data) => cb?.(data));
    }
  },
  settings: {
    load: () => ipcRenderer.invoke('settings:load'),
    save: (data) => ipcRenderer.invoke('settings:save', data),
    testPaths: (data) => ipcRenderer.invoke('settings:testPaths', data),
    pickFolder: (initial) => ipcRenderer.invoke('settings:pickFolder', initial || '')
  }
});
