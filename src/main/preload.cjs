const { contextBridge, ipcRenderer, webUtils } = require('electron');

const validChannels = [
  'compress:progress',
  'compress:file-complete',
  'compress:file-error',
  'compress:complete',
  'compress:state',
];

contextBridge.exposeInMainWorld('kompres', {
  selectFiles: (mode) => ipcRenderer.invoke('dialog:select-files', mode),
  selectVideos: () => ipcRenderer.invoke('dialog:select-files', 'video'),
  selectSourceFolder: (mode) => ipcRenderer.invoke('dialog:select-source-folder', mode),
  selectFolder: () => ipcRenderer.invoke('dialog:select-folder'),
  selectSubtitle: () => ipcRenderer.invoke('dialog:select-subtitle'),
  inspectFiles: (payload) => ipcRenderer.invoke('files:inspect', payload),
  expandVideos: (paths) => ipcRenderer.invoke('files:expand', { paths, mode: 'video' }),
  expandFiles: (payload) => ipcRenderer.invoke('files:expand', payload),
  checkFfmpeg: () => ipcRenderer.invoke('ffmpeg:check'),
  startCompression: (payload) => ipcRenderer.invoke('tools:start', { toolId: 'compress-video', mode: 'video', ...payload }),
  startTool: (payload) => ipcRenderer.invoke('tools:start', payload),
  cancelCompression: () => ipcRenderer.invoke('compress:cancel'),
  pauseCompression: () => ipcRenderer.invoke('compress:pause'),
  resumeCompression: () => ipcRenderer.invoke('compress:resume'),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  on: (channel, callback) => {
    if (!validChannels.includes(channel)) return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
});
