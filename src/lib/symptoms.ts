export const SLOTS_PER_DAY = 24;
export const MINUTES_PER_SLOT = 60;

export function slotToTime(slot: number): string {
  const h = Math.floor((slot * MINUTES_PER_SLOT) / 60);
  const m = (slot * MINUTES_PER_SLOT) % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export interface CompanionSymptoms {
  sleepiness: boolean;
  nausea: boolean;
  tremor: boolean;
  axial: boolean;
  cognitive: boolean;
  hallucination: boolean;
}

export const COMPANION_LABELS: Record<keyof CompanionSymptoms, string> = {
  sleepiness: "眠気", nausea: "嘔気", tremor: "振戦", axial: "体軸症状", cognitive: "認知機能低下", hallucination: "幻覚",
};

export const defaultCompanionSymptoms: CompanionSymptoms = {
  sleepiness: false, nausea: false, tremor: false, axial: false, cognitive: false, hallucination: false,
};

export interface SymptomTimeline {
  off: boolean[];
  dyskinesia: boolean[];
}

export function createEmptyTimeline(): SymptomTimeline {
  return { off: Array(SLOTS_PER_DAY).fill(false), dyskinesia: Array(SLOTS_PER_DAY).fill(false) };
}
