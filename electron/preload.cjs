const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('raidHost', {
  readSave: () => ipcRenderer.invoke('save:read'),
  writeSave: (text) => ipcRenderer.invoke('save:write', text),
});
