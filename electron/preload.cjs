const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bounceDeck', {
  companionChat: (payload) => ipcRenderer.invoke('companion:chat', payload),
});
