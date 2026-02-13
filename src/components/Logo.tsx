/**
 * ロゴ（DOPA Plan）
 * DOPA: 角ばった極太・紫背景白抜き（主役）
 * Plan: 細身・控えめな青（脇役）、グラデーションなしフラット
 */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-0 ${className}`}
      style={{ letterSpacing: "-0.03em" }}
      aria-label="DOPA Plan"
    >
      {/* DOPA: 主役 — 紫ボックス・白抜き・角わずかに丸め・字間やや詰め */}
      <span
        style={{
          fontFamily: "var(--font-logo), Impact, sans-serif",
          backgroundColor: "#9c27b0",
          color: "#fff",
          padding: "0.2em 0.2em 0.12em",
          marginRight: "0.12em",
          borderRadius: "4px",
          letterSpacing: "0.02em",
          fontWeight: 900,
        }}
      >
        DOPA
      </span>
      {/* Plan: 脇役 — DOPA高さの約7割・暗めグレー・少し下に配置 */}
      <span
        style={{
          fontFamily: "var(--font-logo-plan), system-ui, sans-serif",
          color: "#455a64",
          fontSize: "0.7em",
          letterSpacing: "-0.02em",
          fontWeight: 500,
          marginTop: "0.12em",
        }}
      >
        Plan
      </span>
    </span>
  );
}
