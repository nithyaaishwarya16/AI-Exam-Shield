const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("examShield", {
  isDesktopShell: true,
  checkProhibitedProcesses: () => ipcRenderer.invoke("examshield:check-prohibited-processes"),
});
