export interface Filter {
  id?: string;
  freq: number;
  gain: number;
  Q: number;
  type: BiquadFilterType;
  enabled?: boolean;
}

export interface FilterPreset {
  name: string;
  filters: Filter[];
}

export interface SliderConfig {
  idx: number;
  freq: number;
}

export type FilterMode = "blocklist" | "allowlist";

