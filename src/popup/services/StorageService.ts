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
    return normalizeFilters(Array.isArray(data.currentFilters) ? data.currentFilters : []);
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

  // Site Override Methods
  static async isSiteOverrideActive(hostname: string): Promise<boolean> {
    if (!hostname || hostname === "unknown" || hostname === "Browser page") return false;
    const data = await chrome.storage.local.get("siteOverrides");
    const siteOverrides: Record<string, boolean> = (data.siteOverrides as Record<string, boolean>) || {};
    return Boolean(siteOverrides[hostname]);
  }

  static async setSiteOverrideActive(hostname: string, active: boolean): Promise<void> {
    if (!hostname || hostname === "unknown" || hostname === "Browser page") return;
    const data = await chrome.storage.local.get("siteOverrides");
    const siteOverrides: Record<string, boolean> = (data.siteOverrides as Record<string, boolean>) || {};
    siteOverrides[hostname] = active;
    await chrome.storage.local.set({ siteOverrides });
  }

  static async getSiteFilters(hostname: string): Promise<Filter[] | null> {
    if (!hostname) return null;
    const data = await chrome.storage.local.get("siteFilters");
    const siteFilters: Record<string, Filter[]> = (data.siteFilters as Record<string, Filter[]>) || {};
    if (Array.isArray(siteFilters[hostname])) {
      return normalizeFilters(siteFilters[hostname]);
    }
    return null;
  }

  static async setSiteFilters(hostname: string, filters: Filter[]): Promise<void> {
    if (!hostname) return;
    const data = await chrome.storage.local.get("siteFilters");
    const siteFilters: Record<string, Filter[]> = (data.siteFilters as Record<string, Filter[]>) || {};
    siteFilters[hostname] = filters;
    await chrome.storage.local.set({ siteFilters });
  }

  static async getSitePreset(hostname: string): Promise<string | null> {
    if (!hostname) return null;
    const data = await chrome.storage.local.get("sitePresets");
    const sitePresets: Record<string, string> = (data.sitePresets as Record<string, string>) || {};
    return typeof sitePresets[hostname] === "string" ? sitePresets[hostname] : null;
  }

  static async setSitePreset(hostname: string, name: string): Promise<void> {
    if (!hostname) return;
    const data = await chrome.storage.local.get("sitePresets");
    const sitePresets: Record<string, string> = (data.sitePresets as Record<string, string>) || {};
    sitePresets[hostname] = name;
    await chrome.storage.local.set({ sitePresets });
  }

  static async getEffectiveFilters(hostname: string): Promise<Filter[]> {
    const isOverride = await StorageService.isSiteOverrideActive(hostname);
    if (isOverride) {
      const siteFilters = await StorageService.getSiteFilters(hostname);
      if (siteFilters) return siteFilters;
    }
    return StorageService.getCurrentFilters();
  }

  static async setEffectiveFilters(hostname: string, filters: Filter[]): Promise<void> {
    const isOverride = await StorageService.isSiteOverrideActive(hostname);
    if (isOverride) {
      await StorageService.setSiteFilters(hostname, filters);
    } else {
      await StorageService.setCurrentFilters(filters);
    }
  }

  static async getEffectivePreset(hostname: string): Promise<string | null> {
    const isOverride = await StorageService.isSiteOverrideActive(hostname);
    if (isOverride) {
      const sitePreset = await StorageService.getSitePreset(hostname);
      if (sitePreset) return sitePreset;
    }
    return StorageService.getSelectedPreset();
  }

  static async setEffectivePreset(hostname: string, name: string): Promise<void> {
    const isOverride = await StorageService.isSiteOverrideActive(hostname);
    if (isOverride) {
      await StorageService.setSitePreset(hostname, name);
    } else {
      await StorageService.setSelectedPreset(name);
    }
  }

  static async getGlobalVolume(): Promise<number> {
    const data = await chrome.storage.local.get("globalVolume");
    return typeof data.globalVolume === "number" ? data.globalVolume : 1.0;
  }

  static async setGlobalVolume(volume: number): Promise<void> {
    await chrome.storage.local.set({ globalVolume: volume });
  }

  static async getEffectiveVolume(hostname: string): Promise<number> {
    const isOverride = await StorageService.isSiteOverrideActive(hostname);
    if (isOverride) {
      const data = await chrome.storage.local.get("siteVolumes");
      const siteVolumes: Record<string, number> = (data.siteVolumes as Record<string, number>) || {};
      if (typeof siteVolumes[hostname] === "number") {
        return siteVolumes[hostname];
      }
    }
    return StorageService.getGlobalVolume();
  }

  static async setEffectiveVolume(hostname: string, volume: number): Promise<void> {
    const isOverride = await StorageService.isSiteOverrideActive(hostname);
    if (isOverride) {
      await StorageService.setVolume(hostname, volume);
    } else {
      await StorageService.setGlobalVolume(volume);
    }
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





