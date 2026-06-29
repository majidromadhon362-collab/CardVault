import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { openUrl } from '@tauri-apps/plugin-opener';

const RELEASE_API = 'https://api.github.com/repos/majidromadhon362-collab/CardVault/releases/latest';
const RELEASE_PAGE = 'https://github.com/majidromadhon362-collab/CardVault/releases/latest';

function normalizeVersion(value) {
  return String(value || '').replace(/^v/i, '').split(/[+-]/)[0];
}

function compareVersions(left, right) {
  const a = normalizeVersion(left).split('.').map((part) => Number.parseInt(part, 10) || 0);
  const b = normalizeVersion(right).split('.').map((part) => Number.parseInt(part, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if ((a[i] || 0) > (b[i] || 0)) return 1;
    if ((a[i] || 0) < (b[i] || 0)) return -1;
  }
  return 0;
}

async function checkGitHubRelease() {
  const response = await fetch(RELEASE_API, { headers: { Accept: 'application/vnd.github+json' } });
  if (!response.ok) return { available: false };
  const release = await response.json();
  const latestVersion = normalizeVersion(release.tag_name || release.name);
  const currentVersion = import.meta.env.VITE_APP_VERSION || '0.1.5';
  if (!latestVersion || compareVersions(latestVersion, currentVersion) <= 0) return { available: false };
  const installer = Array.isArray(release.assets)
    ? release.assets.find((asset) => /setup\.exe$/i.test(asset.name))
    : null;
  return {
    available: true,
    version: latestVersion,
    body: release.body || '',
    url: installer?.browser_download_url || release.html_url || RELEASE_PAGE,
  };
}

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
    checkForUpdates: () => checkGitHubRelease().catch(() => ({ available: false })),
    installUpdate: async (url) => {
      await openUrl(url || RELEASE_PAGE);
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
