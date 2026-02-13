"use client";

import { COMPANION_LABELS, type CompanionSymptoms } from "@/lib/symptoms";

const KEYS = Object.keys(COMPANION_LABELS) as (keyof CompanionSymptoms)[];

export function SymptomCheckboxes({ value, onChange }: { value: CompanionSymptoms; onChange: (n: CompanionSymptoms) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {KEYS.map((key) => (
        <label key={key} className="flex items-center gap-2 rounded border border-gray-200 bg-white px-3 py-2 cursor-pointer hover:bg-gray-50">
          <input type="checkbox" checked={value[key]} onChange={(e) => onChange({ ...value, [key]: e.target.checked })} className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
          <span className="text-sm text-gray-800">{COMPANION_LABELS[key]}</span>
        </label>
      ))}
    </div>
  );
}
