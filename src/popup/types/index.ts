export interface Filter {
  freq: number;
  gain: number;
  Q: number;
  type: BiquadFilterType;
}

export interface FilterPreset {
  name: string;
  filters: Filter[];
}

export interface SliderConfig {
  idx: number;
  freq: number;
}
