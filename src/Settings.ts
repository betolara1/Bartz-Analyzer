// src/main/settings.ts
import { dialog } from "electron";
import Store from "electron-store";
import fs from "fs/promises";

export type AppSettings = {
  entrada: string;
  working: string;
  ok: string;
  erro: string;
  logsErrors: string;
  logsProcessed: string;
  drawings: string;
};

const store = new Store<AppSettings>({
  name: "bartz-settings",
  defaults: {
    entrada: "",
    working: "",
    ok: "",
    erro: "",
    logsErrors: "",
    logsProcessed: "",
    drawings: "",
  },
});

export const Settings = {
  load(): AppSettings {
    return {
      entrada: store.get("entrada") ?? "",
      working: store.get("working") ?? "",
      ok: store.get("ok") ?? "",
      erro: store.get("erro") ?? "",
      logsErrors: store.get("logsErrors") ?? "",
      logsProcessed: store.get("logsProcessed") ?? "",
      drawings: store.get("drawings") ?? "",
    };
  },
  save(data: Partial<AppSettings>) {
    const current = Settings.load();
    const merged = { ...current, ...data };
    Object.entries(merged).forEach(([k, v]) => {
      // @ts-ignore
      store.set(k, v ?? "");
    });
    return Settings.load();
  },
  async testPaths(data: Partial<AppSettings>) {
    const payload = { ...(Settings.load()), ...(data || {}) };
    const chk = {
      entrada: false, working: false, ok: false, erro: false, logsErrors: false, logsProcessed: false, drawings: false,
    };
    async function canWrite(p?: string) {
      if (!p) return false;
      try {
        await fs.access(p);
        await fs.mkdir(p, { recursive: true });
        await fs.access(p);
        return true;
      } catch {
        return false;
      }
    }
    chk.entrada = await canWrite(payload.entrada);
    chk.working = await canWrite(payload.working);
    chk.ok = await canWrite(payload.ok);
    chk.erro = await canWrite(payload.erro);
    chk.logsErrors = await canWrite(payload.logsErrors);
    chk.logsProcessed = await canWrite(payload.logsProcessed);
    chk.drawings = await canWrite(payload.drawings);
    return chk;
  },
  async pickFolder(initial = "") {
    const res = await dialog.showOpenDialog({
      defaultPath: initial || undefined,
      properties: ["openDirectory", "createDirectory"],
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    return res.filePaths[0];
  },
};
