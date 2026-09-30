import { contextBridge } from 'electron';

// Expose only immutable metadata. Add narrow, validated IPC methods when a feature needs them.
contextBridge.exposeInMainWorld('desktop', Object.freeze({
  platform: process.platform,
  electronVersion: process.versions.electron
}));
