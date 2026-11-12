const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getScreens: () => ipcRenderer.invoke("get-screens"),
  launchProjector: (displayIndex) => ipcRenderer.send("launch-projector", displayIndex),
  closeProjector: () => ipcRenderer.send("close-projector"),
  getProjectorStatus: () => ipcRenderer.invoke("get-projector-status"),
  onProjectorStatusChange: (callback) => {
    const handler = (_event, isLive) => callback(Boolean(isLive));
    ipcRenderer.on("projector-status", handler);
    return () => ipcRenderer.removeListener("projector-status", handler);
  },

  launchLivePopout: (bounds) => ipcRenderer.send("launch-live-popout", bounds),
  closeLivePopout: () => ipcRenderer.send("close-live-popout"),
  getLivePopoutStatus: () => ipcRenderer.invoke("get-live-popout-status"),
  onLivePopoutStatusChange: (callback) => {
    const handler = (_event, isOpen) => callback(Boolean(isOpen));
    ipcRenderer.on("live-popout-status", handler);
    return () => ipcRenderer.removeListener("live-popout-status", handler);
  },

  // ProPresenter .pro, Theme & Media Bin parser
  resolveSlideTheme: (payload) => ipcRenderer.invoke("resolve-slide-theme", payload),
  resolveMediaItem: (payload) => ipcRenderer.invoke("resolve-media-item", payload),
  getDefaultProScreen: () => ipcRenderer.invoke("get-default-pro-screen"),
  getMediaTransition: () => ipcRenderer.invoke("get-media-transition"),
  getLayerTransitions: () => ipcRenderer.invoke("get-layer-transitions"),
  getMediaCatalog: (payload) => ipcRenderer.invoke("get-media-catalog", payload),

  isElectron: true
});
