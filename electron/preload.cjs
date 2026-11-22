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

  // Smartphone Web Remote Control
  getRemoteInfo: () => ipcRenderer.invoke("get-remote-info"),
  getQrForUrl: (url) => ipcRenderer.invoke("get-qr-for-url", url),
  syncRemoteState: (state) => ipcRenderer.send("sync-remote-state", state),
  onRemoteConfigUpdate: (callback) => {
    const handler = (_event, configDelta) => callback(configDelta);
    ipcRenderer.on("remote-config-update", handler);
    return () => ipcRenderer.removeListener("remote-config-update", handler);
  },
  onRemoteActionTrigger: (callback) => {
    const handler = (_event, action) => callback(action);
    ipcRenderer.on("remote-action-trigger", handler);
    return () => ipcRenderer.removeListener("remote-action-trigger", handler);
  },
  onRemoteClientCountChange: (callback) => {
    const handler = (_event, count) => callback(Number(count || 0));
    ipcRenderer.on("remote-client-count", handler);
    return () => ipcRenderer.removeListener("remote-client-count", handler);
  },

  // ProPresenter Auto-Discovery & Connection Testing
  startDiscovery: () => ipcRenderer.send("start-propresenter-discovery"),
  stopDiscovery: () => ipcRenderer.send("stop-propresenter-discovery"),
  getDiscoveredDevices: () => ipcRenderer.invoke("get-discovered-propresenter-devices"),
  testProPresenterConnection: (payload) => ipcRenderer.invoke("test-propresenter-connection", payload),
  onDiscoveredDevicesChange: (callback) => {
    const handler = (_event, devices) => callback(devices);
    ipcRenderer.on("discovered-propresenter-devices", handler);
    return () => ipcRenderer.removeListener("discovered-propresenter-devices", handler);
  },

  // OBS-style Profil Acara Menu
  syncProfileMenu: (payload) => ipcRenderer.send("sync-profile-menu", payload),
  onProfileMenuAction: (callback) => {
    const handler = (_event, action) => callback(action);
    ipcRenderer.on("profile-menu-action", handler);
    return () => ipcRenderer.removeListener("profile-menu-action", handler);
  },
  exportProfileFile: (payload) => ipcRenderer.invoke("export-profile-file", payload),
  importProfileFile: () => ipcRenderer.invoke("import-profile-file"),

  isElectron: true
});
