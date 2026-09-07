const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bounceDeck', {
  companionChat: (payload) => ipcRenderer.invoke('companion:chat', payload),
  libraryGet: () => ipcRenderer.invoke('library:get'),
  libraryAddFolder: () => ipcRenderer.invoke('library:add-folder'),
  libraryRefresh: () => ipcRenderer.invoke('library:refresh'),
  libraryClear: () => ipcRenderer.invoke('library:clear'),
});
