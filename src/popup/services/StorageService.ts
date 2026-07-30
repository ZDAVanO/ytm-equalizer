import { FilterPreset, Filter, FilterMode } from '../types';
import { devLog } from '../../core/utils';

export function matchesDomain(hostname: string, targetDomain: string): boolean {
  if (!hostname || !targetDomain) return false;
  const h = hostname.toLowerCase().trim();
  const t = targetDomain.toLowerCase().trim();
  if (!h || !t) return false;
  return h === t || h.endsWith('.' + t);
}

export class StorageService {
  static async getUserPresets(): Promise<FilterPreset[]> {
    const data = await chrome.storage.local.get("userPresets");
    return Array.isArray(data.userPresets) ? data.userPresets : [];
  }

  static async setUserPresets(presets: FilterPreset[]): Promise<void> {
    await chrome.storage.local.set({ userPresets: presets });
  }

  static async getSelectedPreset(): Promise<string | null> {
    const data = await chrome.storage.local.get("selectedPreset");
    return typeof data.selectedPreset === "string" ? data.selectedPreset : null;
  }

  static async setSelectedPreset(name: string): Promise<void> {
    await chrome.storage.local.set({ selectedPreset: name });
  }

  static async getEqEnabled(): Promise<boolean> {
    const data = await chrome.storage.local.get("eqEnabled");
    return Boolean(data.eqEnabled);
  }

  static async setEqEnabled(enabled: boolean): Promise<void> {
    await chrome.storage.local.set({ eqEnabled: enabled });
  }

  static async getFilterMode(): Promise<FilterMode> {
    const data = await chrome.storage.local.get("filterMode");
    return data.filterMode === "allowlist" ? "allowlist" : "blocklist";
  }

  static async setFilterMode(mode: FilterMode): Promise<void> {
    await chrome.storage.local.set({ filterMode: mode });
  }

  static async getBlockList(): Promise<string[]> {
    const data = await chrome.storage.local.get("blockList");
    return Array.isArray(data.blockList) ? data.blockList : [];
  }

  static async setBlockList(list: string[]): Promise<void> {
    await chrome.storage.local.set({ blockList: list });
  }

  static async getAllowList(): Promise<string[]> {
    const data = await chrome.storage.local.get("allowList");
    return Array.isArray(data.allowList) ? data.allowList : [];
  }

  static async setAllowList(list: string[]): Promise<void> {
    await chrome.storage.local.set({ allowList: list });
  }

  static isSiteActive(
    hostname: string,
    eqEnabled: boolean,
    mode: FilterMode,
    blockList: string[],
    allowList: string[]
  ): boolean {
    if (!eqEnabled) return false;
    if (!hostname || hostname === "unknown" || hostname === "Browser page") return eqEnabled;

    if (mode === "blocklist") {
      const isBlocked = blockList.some((domain) => matchesDomain(hostname, domain));
      return !isBlocked;
    } else {
      const isAllowed = allowList.some((domain) => matchesDomain(hostname, domain));
      return isAllowed;
    }
  }

  static async getCurrentFilters(): Promise<Filter[]> {
    const data = await chrome.storage.local.get("currentFilters");
    return normalizeFilters(data.currentFilters);
  }

  static async setCurrentFilters(filters: Filter[]): Promise<void> {
    devLog('[StorageService] setCurrentFilters:', filters);
    await chrome.storage.local.set({ currentFilters: filters });
  }

  static async getVolume(hostname: string): Promise<number> {
    const data = await chrome.storage.local.get("siteVolumes");
    const siteVolumes: Record<string, number> = (data.siteVolumes as Record<string, number>) || {};
    return typeof siteVolumes[hostname] === "number" ? siteVolumes[hostname] : 1.0;
  }

  static async setVolume(hostname: string, volume: number): Promise<void> {
    const data = await chrome.storage.local.get("siteVolumes");
    const siteVolumes: Record<string, number> = (data.siteVolumes as Record<string, number>) || {};
    siteVolumes[hostname] = volume;
    await chrome.storage.local.set({ siteVolumes });
  }
}

export function normalizeFilters(filters: any[]): Filter[] {
  const stdFreqs = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
  if (!Array.isArray(filters)) {
    return stdFreqs.map((freq) => ({
      freq,
      gain: 0,
      Q: 1.0,
      type: "peaking",
    }));
  }

  return filters.map((f, i) => {
    if (typeof f === "number") {
      return {
        freq: stdFreqs[i] || 1000,
        gain: f,
        Q: 1.0,
        type: "peaking",
        enabled: true,
      };
    }
    return {
      freq: typeof f.freq === "number" ? f.freq : stdFreqs[i] || 1000,
      gain: typeof f.gain === "number" ? f.gain : 0,
      Q: typeof f.Q === "number" ? f.Q : 1.0,
      type: f.type || "peaking",
      enabled: f.enabled !== false,
    };
  });
}





