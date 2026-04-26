import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronSettings", {
  get: (): Promise<unknown> => ipcRenderer.invoke("settings-get"),
  set: (data: unknown): Promise<void> => ipcRenderer.invoke("settings-set", data),
});
