"use client";

import { useCallback, useState, useEffect } from "react";
import { SLOTS_PER_DAY, slotToTime, type SymptomTimeline } from "@/lib/symptoms";

type Kind = "off" | "dyskinesia";

/** 1本のバー（OFF または ジスキネジア） */
function TimelineBar({
  kind,
  value,
  onChange,
  label,
  barColorOn,
}: {
  kind: Kind;
  value: boolean[];
  onChange: (next: boolean[]) => void;
  label: string;
  barColorOn: string;
}) {
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ fillValue: boolean } | null>(null);

  const timeLabel = hoveredSlot !== null
    ? `${slotToTime(hoveredSlot)} ～ ${slotToTime(hoveredSlot + 1)}`
    : null;

  const setSlot = useCallback(
    (slot: number, toValue: boolean) => {
      onChange(value.map((v, i) => (i === slot ? toValue : v)));
    },
    [value, onChange]
  );

  const handleMouseDown = useCallback(
    (slot: number) => {
      const nextValue = !value[slot];
      setSlot(slot, nextValue);
      setDrag({ fillValue: nextValue });
    },
    [value, setSlot]
  );

  const handleMouseEnter = useCallback(
    (slot: number) => {
      setHoveredSlot(slot);
      if (drag) setSlot(slot, drag.fillValue);
    },
    [drag, setSlot]
  );

  const endDrag = useCallback(() => setDrag(null), []);

  useEffect(() => {
    if (!drag) return;
    const onUp = () => endDrag();
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, [drag]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-medium">{label}</span>
        {timeLabel && (
          <span className="text-xs text-gray-600 font-mono bg-gray-100 px-2 py-0.5 rounded">
            {timeLabel}
          </span>
        )}
      </div>
      <div
        className="flex border border-gray-200 rounded-lg overflow-hidden mt-1 select-none"
        onMouseLeave={() => setHoveredSlot(null)}
      >
        {Array.from({ length: SLOTS_PER_DAY }, (_, i) => (
          <div
            key={i}
            className={`flex-1 min-w-0 h-8 transition-colors cursor-pointer ${value[i] ? barColorOn : "bg-gray-100 hover:bg-gray-200"}`}
            onMouseDown={() => handleMouseDown(i)}
            onMouseEnter={() => handleMouseEnter(i)}
            title={`${slotToTime(i)} ～ ${slotToTime(i + 1)}`}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSlot(i, !value[i]);
              }
            }}
            aria-label={`${slotToTime(i)}～${slotToTime(i + 1)}`}
          />
        ))}
      </div>
    </div>
  );
}

export function SymptomTimeline({
  value,
  onChange,
}: {
  value: SymptomTimeline;
  onChange: (n: SymptomTimeline) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        1日のうち該当する時間帯をクリックで選択。ドラッグで連続選択できます。カーソルを合わせると時刻がバー上に表示されます。
      </p>
      <div>
        <TimelineBar
          kind="off"
          value={value.off}
          onChange={(next) => onChange({ ...value, off: next })}
          label="OFFが強い時間"
          barColorOn="bg-amber-500/70 hover:bg-amber-500"
        />
      </div>
      <div>
        <TimelineBar
          kind="dyskinesia"
          value={value.dyskinesia}
          onChange={(next) => onChange({ ...value, dyskinesia: next })}
          label="ジスキネジアが出る時間"
          barColorOn="bg-rose-500/70 hover:bg-rose-500"
        />
      </div>
      <div className="flex text-xs text-gray-500 justify-between px-0.5">
        <span>0:00</span>
        <span>6:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>24:00</span>
      </div>
    </div>
  );
}
