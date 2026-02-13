/**
 * LEDD (Levodopa Equivalent Daily Dose) 計算ロジック
 */

export type DrugCategory =
  | "LDOPA"
  | "AGONIST"
  | "MAOB"
  | "COMT"
  | "OTHER";

/** 薬剤選択のセクション見出し（表示順） */
export const DRUG_CATEGORY_ORDER: DrugCategory[] = ["LDOPA", "AGONIST", "MAOB", "COMT", "OTHER"];

export const CATEGORY_LABELS: Record<DrugCategory, string> = {
  LDOPA: "L-dopa製剤",
  AGONIST: "ドパミンアゴニスト",
  MAOB: "MAO-B阻害薬",
  COMT: "COMT阻害薬",
  OTHER: "その他",
};

export type LEDDMode = "DIRECT" | "MULTIPLY_LDOPA" | "FIXED";

export interface DrugMasterRow {
  id: string;
  displayName: string;
  brandName: string;
  category: DrugCategory;
  unit: string;
  leddMode: LEDDMode;
  leddFactor: number;
  ldopaMultiplier: number;
  maxSingleDoseMg: number;
  maxDailyDoseMg: number;
  warnings: string;
  isActive: boolean;
}

export interface PrescriptionRow {
  drugId: string;
  displayName: string;
  dose: number;
  freq: number;
  times: string[];
}

export interface PrescriptionLEDDRow extends PrescriptionRow {
  leddValue: number;
  category: DrugCategory;
}

export interface LEDDSummary {
  ldopaAdjusted: number;
  agonist: number;
  other: number;
  total: number;
}

export const drugMaster: DrugMasterRow[] = [
  // L-dopa 系
  { id: "LDOPA_IR", displayName: "レボドパ/カルビドパ", brandName: "メネシット、ネオドパストン", category: "LDOPA", unit: "mg", leddMode: "DIRECT", leddFactor: 1.0, ldopaMultiplier: 1.0, maxSingleDoseMg: 200, maxDailyDoseMg: 1200, warnings: "-", isActive: true },
  { id: "LDOPA_BEN_IR", displayName: "レボドパ/ベンセラジド", brandName: "マドパー", category: "LDOPA", unit: "mg", leddMode: "DIRECT", leddFactor: 1.0, ldopaMultiplier: 1.0, maxSingleDoseMg: 200, maxDailyDoseMg: 1200, warnings: "-", isActive: true },
  { id: "STALEVO", displayName: "レボドパ/カルビドパ/エンタカポン", brandName: "スタレボ", category: "LDOPA", unit: "mg", leddMode: "DIRECT", leddFactor: 1.33, ldopaMultiplier: 1.0, maxSingleDoseMg: 150, maxDailyDoseMg: 1200, warnings: "L-dopa・COMT合剤、レボドパ含量で入力", isActive: true },
  { id: "DUODOPA", displayName: "デュオドーパ（レボドパ/カルビドパ腸管用）", brandName: "デュオドーパ", category: "LDOPA", unit: "mL/日", leddMode: "DIRECT", leddFactor: 1.11, ldopaMultiplier: 1.0, maxSingleDoseMg: 0, maxDailyDoseMg: 0, warnings: "持続投与・設定変更は専門施設で", isActive: true },

  // ドパミンアゴニスト
  { id: "ROPINIROLE", displayName: "ロピニロール", brandName: "レキップ", category: "AGONIST", unit: "mg", leddMode: "DIRECT", leddFactor: 20, ldopaMultiplier: 1.0, maxSingleDoseMg: 15, maxDailyDoseMg: 15, warnings: "-", isActive: true },
  { id: "ROPINIROLE_CR", displayName: "ロピニロール徐放", brandName: "レキップCR", category: "AGONIST", unit: "mg", leddMode: "DIRECT", leddFactor: 20, ldopaMultiplier: 1.0, maxSingleDoseMg: 16, maxDailyDoseMg: 24, warnings: "1日1回", isActive: true },
  { id: "ROPINIROLE_PATCH", displayName: "ロピニロール貼付", brandName: "ハルロピ", category: "AGONIST", unit: "patch", leddMode: "DIRECT", leddFactor: 7.5, ldopaMultiplier: 1.0, maxSingleDoseMg: 64, maxDailyDoseMg: 64, warnings: "24hr持続、換算は参考表に基づく概算", isActive: true },
  { id: "PRAMIPEXOLE", displayName: "プラミペキソール", brandName: "ビ・シフロール、ミラペックス", category: "AGONIST", unit: "mg", leddMode: "DIRECT", leddFactor: 100, ldopaMultiplier: 1.0, maxSingleDoseMg: 4.5, maxDailyDoseMg: 4.5, warnings: "-", isActive: true },
  { id: "PRAMIPEXOLE_ER", displayName: "プラミペキソール徐放", brandName: "ビ・シフロールL/A、ミラペックスER", category: "AGONIST", unit: "mg", leddMode: "DIRECT", leddFactor: 100, ldopaMultiplier: 1.0, maxSingleDoseMg: 4.5, maxDailyDoseMg: 4.5, warnings: "24hr持続", isActive: true },
  { id: "ROTIGOTINE", displayName: "ロチゴチン貼付", brandName: "ニュープロパッチ", category: "AGONIST", unit: "patch", leddMode: "DIRECT", leddFactor: 13.3, ldopaMultiplier: 1.0, maxSingleDoseMg: 18, maxDailyDoseMg: 18, warnings: "24hr持続", isActive: true },

  // MAO-B阻害薬
  { id: "SELEGILINE", displayName: "セレギリン", brandName: "エフピー", category: "MAOB", unit: "mg/day", leddMode: "DIRECT", leddFactor: 10, ldopaMultiplier: 1.0, maxSingleDoseMg: 10, maxDailyDoseMg: 10, warnings: "-", isActive: true },
  { id: "RASAGILINE", displayName: "ラサギリン", brandName: "アジレクト", category: "MAOB", unit: "mg/day", leddMode: "DIRECT", leddFactor: 100, ldopaMultiplier: 1.0, maxSingleDoseMg: 1, maxDailyDoseMg: 1, warnings: "-", isActive: true },
  { id: "SAFINAMIDE", displayName: "サフィナミド", brandName: "エクセロン", category: "MAOB", unit: "mg/day", leddMode: "DIRECT", leddFactor: 80, ldopaMultiplier: 1.0, maxSingleDoseMg: 100, maxDailyDoseMg: 100, warnings: "-", isActive: true },

  // COMT阻害薬（エンタカポン系）
  { id: "ENTACAPONE", displayName: "エンタカポン", brandName: "コムタン", category: "COMT", unit: "mg", leddMode: "MULTIPLY_LDOPA", leddFactor: 0, ldopaMultiplier: 1.33, maxSingleDoseMg: 200, maxDailyDoseMg: 1600, warnings: "LDOPA併用", isActive: true },
  { id: "OPICAPONE", displayName: "オピカポン", brandName: "オンジェンティス", category: "COMT", unit: "mg", leddMode: "MULTIPLY_LDOPA", leddFactor: 0, ldopaMultiplier: 1.45, maxSingleDoseMg: 25, maxDailyDoseMg: 25, warnings: "LDOPA併用", isActive: true },

  // その他（L-dopa換算に含めるが非ドパミン系）
  { id: "AMANTADINE", displayName: "アマンタジン", brandName: "シンメトレル、パーキン", category: "OTHER", unit: "mg", leddMode: "DIRECT", leddFactor: 1.0, ldopaMultiplier: 1.0, maxSingleDoseMg: 300, maxDailyDoseMg: 300, warnings: "-", isActive: true },
  { id: "ZONISAMIDE", displayName: "ゾニサミド", brandName: "トレリーフ", category: "OTHER", unit: "mg", leddMode: "FIXED", leddFactor: 0, ldopaMultiplier: 1.0, maxSingleDoseMg: 50, maxDailyDoseMg: 100, warnings: "PD適応", isActive: true },
  { id: "ISTRADEFYLLINE", displayName: "イストラデフィリン", brandName: "ノウリアスト", category: "OTHER", unit: "mg", leddMode: "FIXED", leddFactor: 0, ldopaMultiplier: 1.0, maxSingleDoseMg: 20, maxDailyDoseMg: 40, warnings: "A2A拮抗薬", isActive: true },
];

export function getDrugByDisplayName(displayName: string): DrugMasterRow | undefined {
  return drugMaster.find((d) => d.displayName === displayName);
}

export function computeLEDDForRx(rows: PrescriptionRow[]): PrescriptionLEDDRow[] {
  const result: PrescriptionLEDDRow[] = [];
  for (const row of rows) {
    if (!row.displayName || row.dose <= 0) {
      result.push({ ...row, leddValue: 0, category: "OTHER" });
      continue;
    }
    const drug = getDrugByDisplayName(row.displayName);
    if (!drug) {
      result.push({ ...row, leddValue: 0, category: "OTHER" });
      continue;
    }
    const freq = row.freq > 0 ? row.freq : 1;
    const leddValue = drug.leddMode === "DIRECT" ? row.dose * freq * drug.leddFactor : 0;
    result.push({ ...row, leddValue, category: drug.category });
  }
  return result;
}

export function computeLEDDSummary(rxRows: PrescriptionLEDDRow[]): LEDDSummary {
  let sumLDOPA = 0, sumAgonist = 0, sumOther = 0, ldopaMultiplier = 1;
  for (const row of rxRows) {
    switch (row.category) {
      case "LDOPA": sumLDOPA += row.leddValue; break;
      case "AGONIST": sumAgonist += row.leddValue; break;
      case "MAOB": case "OTHER": sumOther += row.leddValue; break;
      case "COMT": {
        const drug = getDrugByDisplayName(row.displayName);
        if (drug?.leddMode === "MULTIPLY_LDOPA" && drug.ldopaMultiplier > ldopaMultiplier)
          ldopaMultiplier = drug.ldopaMultiplier;
        break;
      }
      default:
        break;
    }
  }
  const ldopaAdjusted = sumLDOPA * ldopaMultiplier;
  return { ldopaAdjusted, agonist: sumAgonist, other: sumOther, total: ldopaAdjusted + sumAgonist + sumOther };
}

export function computeAll(rows: PrescriptionRow[]): { rxWithLEDD: PrescriptionLEDDRow[]; summary: LEDDSummary } {
  const rxWithLEDD = computeLEDDForRx(rows);
  return { rxWithLEDD, summary: computeLEDDSummary(rxWithLEDD) };
}
