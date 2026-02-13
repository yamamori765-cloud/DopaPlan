"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { SLOTS_PER_DAY, slotToTime, type SymptomTimeline } from "@/lib/symptoms";

type Kind = "off" | "dyskinesia";

/** 1本のバー（OFF または ジスキネジア） */
function TimelineBar({
  kind,
  value,
  onChange,
  label,
  barColorOn,
  onReset,
}: {
  kind: Kind;
  value: boolean[];
  onChange: (next: boolean[]) => void;
  label: string;
  barColorOn: string;
  onReset?: () => void;
}) {
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ fillValue: boolean } | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const timeLabel = hoveredSlot !== null
    ? `${slotToTime(hoveredSlot)} ～ ${slotToTime(hoveredSlot + 1)}`
    : null;

  const setSlot = useCallback(
    (slot: number, toValue: boolean) => {
      const base = value.length >= SLOTS_PER_DAY ? value.slice(0, SLOTS_PER_DAY) : [...value, ...Array(SLOTS_PER_DAY - value.length).fill(false)];
      onChange(base.map((v, i) => (i === slot ? toValue : v)));
    },
    [value, onChange]
  );

  const getSlotFromClientX = useCallback((clientX: number): number => {
    const el = barRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    return Math.min(SLOTS_PER_DAY - 1, Math.floor(ratio * SLOTS_PER_DAY));
  }, []);

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

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      const slot = getSlotFromClientX(touch.clientX);
      const nextValue = !value[slot];
      setSlot(slot, nextValue);
      setDrag({ fillValue: nextValue });
    },
    [value, setSlot, getSlotFromClientX]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!drag) return;
      e.preventDefault();
      const touch = e.touches[0];
      const slot = getSlotFromClientX(touch.clientX);
      setSlot(slot, drag.fillValue);
    },
    [drag, setSlot, getSlotFromClientX]
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
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">{label}</span>
          {timeLabel && (
            <span className="text-xs text-gray-600 font-mono bg-gray-100 px-2 py-0.5 rounded">
              {timeLabel}
            </span>
          )}
        </div>
        {onReset && (
          <button type="button" onClick={onReset} className="text-xs text-gray-500 hover:text-gray-700 underline flex-shrink-0">
            リセット
          </button>
        )}
      </div>
      <div
        ref={barRef}
        className="flex border border-gray-200 rounded-lg overflow-hidden mt-1 select-none touch-none"
        onMouseLeave={() => setHoveredSlot(null)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={endDrag}
        onTouchCancel={endDrag}
        style={{ touchAction: "none" }}
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
        1時間刻みで該当する時間帯をタップ・クリックで選択。なぞると連続選択できます（スマホ対応）。
      </p>
      <div>
        <TimelineBar
          kind="off"
          value={value.off}
          onChange={(next) => onChange({ ...value, off: next })}
          label="OFFが強い時間"
          barColorOn="bg-amber-500/70 hover:bg-amber-500"
          onReset={() => onChange({ ...value, off: Array(SLOTS_PER_DAY).fill(false) })}
        />
      </div>
      <div>
        <TimelineBar
          kind="dyskinesia"
          value={value.dyskinesia}
          onChange={(next) => onChange({ ...value, dyskinesia: next })}
          label="ジスキネジアが出る時間"
          barColorOn="bg-rose-500/70 hover:bg-rose-500"
          onReset={() => onChange({ ...value, dyskinesia: Array(SLOTS_PER_DAY).fill(false) })}
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
