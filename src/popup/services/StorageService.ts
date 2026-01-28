import { FilterPreset, Filter } from '../types';
import { devLog } from '../../core/utils';

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




