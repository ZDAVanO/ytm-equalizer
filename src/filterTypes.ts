export const filterTypes: BiquadFilterType[] = [
  "lowpass",
  "highpass",
  "bandpass",
  "lowshelf",
  "highshelf",
  "peaking",
  "notch",
  "allpass",
];

export const filterTypeShort: Record<BiquadFilterType, string> = {
  lowpass: "LP",
  highpass: "HP",
  bandpass: "BP",
  lowshelf: "LS",
  highshelf: "HS",
  peaking: "PK",
  notch: "NT",
  allpass: "AP",
};

export const filterTypeDescriptions: Record<string, string> = {
  lowpass: "Lowpass: Passes frequencies below cutoff.",
  highpass: "Highpass: Passes frequencies above cutoff.",
  bandpass: "Bandpass: Passes frequencies around center frequency.",
  lowshelf: "Lowshelf: Boosts/cuts frequencies below cutoff.",
  highshelf: "Highshelf: Boosts/cuts frequencies above cutoff.",
  peaking: "Peaking: Boosts/cuts frequencies around center frequency.",
  notch: "Notch: Attenuates frequencies around center frequency.",
  allpass: "Allpass: Passes all frequencies, changes phase only.",
};

export function filterHasGain(type: BiquadFilterType): boolean {
  return type === "peaking" || type === "lowshelf" || type === "highshelf";
}

export function filterHasQ(type: BiquadFilterType): boolean {
  return type !== "lowshelf" && type !== "highshelf";
}

export function formatFrequency(freq: number): string {
  if (freq >= 1000) {
    const k = freq / 1000;
    const formatted = k >= 10 ? Math.round(k).toString() : (Number.isInteger(k) ? k.toString() : k.toFixed(1));
    return `${formatted} kHz`;
  }
  return `${Math.round(freq)} Hz`;
}