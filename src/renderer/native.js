import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { relaunch } from '@tauri-apps/plugin-process';
import { check } from '@tauri-apps/plugin-updater';

let pendingUpdate = null;

if (!window.kompres && window.__TAURI_INTERNALS__) {
  window.kompres = {
    selectFiles: (mode) => invoke('select_files', { mode }),
    selectVideos: () => invoke('select_files', { mode: 'video' }),
    selectSourceFolder: (mode) => invoke('select_source_folder', { mode }),
    selectFolder: () => invoke('select_folder'),
    selectSubtitle: () => invoke('select_subtitle'),
    inspectFiles: (payload) => invoke('inspect_files', { payload }),
    expandVideos: (paths) => invoke('expand_files', { payload: { paths, mode: 'video' } }),
    expandFiles: (payload) => invoke('expand_files', { payload }),
    checkFfmpeg: () => invoke('check_ffmpeg'),
    startCompression: (payload) => invoke('start_tool', { payload: { toolId: 'compress-video', mode: 'video', ...payload } }),
    startTool: (payload) => invoke('start_tool', { payload }),
    cancelCompression: () => invoke('cancel_job'),
    pauseCompression: () => invoke('pause_job'),
    resumeCompression: () => invoke('resume_job'),
    checkForUpdates: async () => {
      pendingUpdate = await check();
      return pendingUpdate ? { available: true, version: pendingUpdate.version, body: pendingUpdate.body || '' } : { available: false };
    },
    installUpdate: async () => {
      const update = pendingUpdate || await check();
      if (!update) return { ok: false, message: 'No update available.' };
      pendingUpdate = update;
      await update.downloadAndInstall();
      await relaunch();
      return { ok: true };
    },
    getPathForFile: (file) => file.path || file.name || '',
    on: (channel, callback) => {
      const unlistenPromise = listen(channel, (event) => callback(event.payload));
      return () => {
        unlistenPromise.then((unlisten) => unlisten());
      };
    },
  };
}
