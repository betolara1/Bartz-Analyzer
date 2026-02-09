// preload.js  (CJS)
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  analyzer: {
    start: (cfg) => ipcRenderer.invoke('analyzer:start', cfg || {}),
    stop: () => ipcRenderer.invoke('analyzer:stop'),
    scanOnce: () => ipcRenderer.invoke('analyzer:scanOnce'),
    onEvent: (cb) => {
      ipcRenderer.removeAllListeners('analyzer:event');
      ipcRenderer.on('analyzer:event', (_e, msg) => cb && cb(msg));
    },
    openInFolder: (p) => ipcRenderer.invoke('analyzer:openInFolder', p),
    reprocessOne: (p) => ipcRenderer.invoke('analyzer:reprocessOne', p),
    replaceCoringa: (filePath, from, to) => ipcRenderer.invoke('analyzer:replaceCoringa', { filePath, from, to }),
    undoReplace: (filePath) => ipcRenderer.invoke('analyzer:undoReplace', { filePath }),
    replaceCgGroups: (filePath, map) => ipcRenderer.invoke('analyzer:replaceCgGroups', { filePath, map }),
    fillReferencia: (filePath, value) => ipcRenderer.invoke('analyzer:fillReferencia', { filePath, value }),
    fillReferenciaByIds: (filePath, replacements) => ipcRenderer.invoke('analyzer:fillReferenciaByIds', { filePath, replacements }),
    findDrawingFile: (drawingCode, xmlFilePath) => ipcRenderer.invoke('analyzer:findDrawingFile', { drawingCode, xmlFilePath }),
    fixFresa37to18: (dxfFilePath) => ipcRenderer.invoke('analyzer:fixFresa37to18', dxfFilePath),
    exportReport: (reportData) => ipcRenderer.invoke('analyzer:exportReport', reportData),
    searchCsvProduct: (colorName, productType) => ipcRenderer.invoke('analyzer:searchCsvProduct', { colorName, productType }),
    searchErpProduct: (params) => ipcRenderer.invoke('analyzer:searchErpProduct', params),
  },

  settings: {
    load: () => ipcRenderer.invoke('settings:load'),
    save: (data) => ipcRenderer.invoke('settings:save', data),
    testPaths: (data) => ipcRenderer.invoke('settings:testPaths', data),
    pickFolder: (initial) => ipcRenderer.invoke('settings:pickFolder', initial || ''),
  },
});
