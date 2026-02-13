/**
 * 意思決定エンジン：現在の処方＋症状に基づき「次の一手」6案を提案
 */

import { slotToTime } from "@/lib/symptoms";
import { getDrugByDisplayName, type LEDDSummary, type PrescriptionLEDDRow, type DrugCategory } from "@/lib/ledd";
import type { SymptomTimeline, CompanionSymptoms } from "@/lib/symptoms";

export interface ProposalItem {
  title: string;
  body: string;
  category: "optimize" | "switch";
}

/** 処方されている薬のうち、有効な行だけをリスト（表示名・カテゴリ・用量・回数） */
function getActiveRx(rx: PrescriptionLEDDRow[]): { displayName: string; category: DrugCategory; dose: number; freq: number }[] {
  return rx
    .filter((r) => r.displayName && r.dose > 0)
    .map((r) => ({ displayName: r.displayName, category: r.category, dose: r.dose, freq: r.freq }));
}

function hasCategory(rx: PrescriptionLEDDRow[], cat: DrugCategory): boolean {
  return rx.some((r) => r.displayName && r.category === cat);
}

function getDrugsByCategory(rx: PrescriptionLEDDRow[], cat: DrugCategory): string[] {
  return rx.filter((r) => r.displayName && r.category === cat).map((r) => r.displayName);
}

/** L-dopa がIRのみか、ER含むか、デュオドーパか */
function getLDOPARegimen(rx: PrescriptionLEDDRow[]): "none" | "IR_only" | "ER_or_mixed" | "duodopa" {
  const ldopa = getDrugsByCategory(rx, "LDOPA");
  if (ldopa.length === 0) return "none";
  if (ldopa.some((n) => n.includes("デュオドーパ") || n.includes("腸管"))) return "duodopa";
  if (ldopa.some((n) => n.includes("徐放") || n.includes("ER"))) return "ER_or_mixed";
  return "IR_only";
}

/** アゴニストが貼付・徐放か */
function hasLongActingAgonist(rx: PrescriptionLEDDRow[]): boolean {
  const names = getDrugsByCategory(rx, "AGONIST").join("");
  return /貼付|徐放|CR|L\/A|ER/.test(names);
}

/** 現在のアゴニストに合わせた増量・追加の処方例を生成（既存薬を優先） */
function getAgonistIncreaseExample(active: { displayName: string; category: DrugCategory; dose: number; freq: number }[]): string {
  const agonists = active.filter((a) => a.category === "AGONIST");
  if (agonists.length === 0) return "ビ・シフロールL/A 0.375mg 1日1回から開始、レキップCR2mg 1日1回から開始、ニュープロパッチ4.5mg 1日1貼付";
  const examples: string[] = [];
  for (const a of agonists) {
    const drug = getDrugByDisplayName(a.displayName);
    if (!drug) continue;
    const brand = drug.brandName.split("、")[0];
    const max = drug.maxSingleDoseMg || drug.maxDailyDoseMg;
    if (a.displayName.includes("ロピニロール貼付") || brand === "ハルロピ") {
      // ハルロピ: 8,16,24,32,48,64mg
      if (a.dose < 64) {
        const next = a.dose <= 16 ? 24 : a.dose <= 24 ? 32 : a.dose <= 32 ? 48 : 64;
        examples.push(`ハルロピ${a.dose}mg → ${next}mg`);
      }
    } else if (a.displayName.includes("ロチゴチン貼付") || brand === "ニュープロパッチ") {
      // ニュープロパッチ: 4.5,9,13.5,18mg
      if (a.dose < 18) {
        const next = a.dose < 9 ? 9 : a.dose < 13.5 ? 13.5 : 18;
        examples.push(`ニュープロパッチ${a.dose}mg → ${next}mg`);
      }
    } else if (a.displayName.includes("ロピニロール徐放") || brand === "レキップCR") {
      if (a.dose < 24) examples.push(`レキップCR ${a.dose}mg → ${Math.min(a.dose + 4, 24)}mg 1日1回`);
    } else if (a.displayName.includes("プラミペキソール徐放") || /ビ・シフロールL\/A|ミラペックスER/.test(brand)) {
      if (a.dose < 4.5) examples.push(`ビ・シフロールL/A ${a.dose}mg → ${(a.dose + 0.375).toFixed(2)}mg 1日1回`);
    }
  }
  if (examples.length > 0) return examples.join("、");
  return "ビ・シフロールL/A 0.375mg 1日1回、レキップCR2mg 1日1回、ニュープロパッチ4.5mg 1日1貼付";
}

/** 処方中のL-dopa製剤の商品名（カルビドパ配合→メネシット、ベンセラジド配合→マドパー）。提案文の処方例で使用 */
function getLdopaBrandForExample(rx: PrescriptionLEDDRow[]): string {
  const ldopaRow = rx.find((r) => r.displayName && r.category === "LDOPA");
  if (!ldopaRow) return "L-dopa";
  const drug = getDrugByDisplayName(ldopaRow.displayName);
  if (!drug?.brandName) return "L-dopa";
  // レボドパ/カルビドパはメネシット、レボドパ/ベンセラジドはマドパーで表記
  if (ldopaRow.displayName.includes("カルビドパ")) return "メネシット";
  if (ldopaRow.displayName.includes("ベンセラジド")) return "マドパー";
  return drug.brandName.split("、")[0].trim();
}

function hasOff(timeline: SymptomTimeline): boolean {
  return timeline.off.some(Boolean);
}

function hasDyskinesia(timeline: SymptomTimeline): boolean {
  return timeline.dyskinesia.some(Boolean);
}

function getOffRanges(timeline: SymptomTimeline): string {
  const ranges: string[] = [];
  let start: number | null = null;
  for (let i = 0; i <= timeline.off.length; i++) {
    if (timeline.off[i]) {
      if (start === null) start = i;
    } else {
      if (start !== null) {
        ranges.push(`${slotToTime(start)}～${slotToTime(i)}`);
        start = null;
      }
    }
  }
  return ranges.length ? ranges.join("、") : "なし";
}

function getDyskinesiaRanges(timeline: SymptomTimeline): string {
  const ranges: string[] = [];
  let start: number | null = null;
  for (let i = 0; i <= timeline.dyskinesia.length; i++) {
    if (timeline.dyskinesia[i]) {
      if (start === null) start = i;
    } else {
      if (start !== null) {
        ranges.push(`${slotToTime(start)}～${slotToTime(i)}`);
        start = null;
      }
    }
  }
  return ranges.length ? ranges.join("、") : "なし";
}

/**
 * 現在の処方・症状から6案を生成（処方内容を反映した提案にする）
 */
export function generateProposals(
  summary: LEDDSummary,
  timeline: SymptomTimeline,
  companion: CompanionSymptoms,
  currentRx: PrescriptionLEDDRow[]
): ProposalItem[] {
  const active = getActiveRx(currentRx);
  const offRanges = getOffRanges(timeline);
  const dyskRanges = getDyskinesiaRanges(timeline);
  const hasOffTime = hasOff(timeline);
  const hasDysk = hasDyskinesia(timeline);
  const total = summary.total;
  const sleepiness = companion.sleepiness;
  const hallucination = companion.hallucination;

  const hasCOMT = hasCategory(currentRx, "COMT");
  const hasMAOB = hasCategory(currentRx, "MAOB");
  const ldopaRegimen = getLDOPARegimen(currentRx);
  const hasLongAgonist = hasLongActingAgonist(currentRx);
  const agonistNames = getDrugsByCategory(currentRx, "AGONIST");

  const proposals: ProposalItem[] = [];
  const agonistExample = getAgonistIncreaseExample(active);
  const ldopaBrand = getLdopaBrandForExample(currentRx);

  // ----- プラン1：既存薬の最適化（3案） -----

  const ldopaFreq = active.filter((a) => a.category === "LDOPA").map((a) => a.freq)[0] ?? 3;
  const ldopaDose = active.filter((a) => a.category === "LDOPA").map((a) => a.dose)[0] ?? 100;
  proposals.push({
    category: "optimize",
    title: "案1（平準化）",
    body:
      active.length === 0
        ? "処方を入力すると、現在の薬に合わせた平準化案を表示します。"
        : hasDysk
          ? `ジスキネジア時間帯は${dyskRanges}。LEDD総量（${Math.round(total)}）は変えず、L-dopaの1回量を減らして回数を増やすことでピークを下げ、ジスキネジア軽減を図る。\n\n処方例：${ldopaBrand}${ldopaDose}mg×${ldopaFreq}回/日 → ${ldopaBrand}${Math.round(ldopaDose * 0.75)}～${Math.round(ldopaDose * 0.8)}mg×${ldopaFreq + 1}回/日。`
          : `LEDD総量（${Math.round(total)}）を維持しつつ、服薬間隔が長い場合は回数を増やして血中濃度の変動を小さくする。\n\n処方例：${ldopaBrand}${ldopaDose}mg×${ldopaFreq}回/日 → ${ldopaBrand}${ldopaDose}mg×${ldopaFreq + 1}回/日。`,
  });

  proposals.push({
    category: "optimize",
    title: "案2（オフ対策）",
    body:
      active.length === 0
        ? "処方とOFF時間帯を入力すると、オフ対策案を表示します。"
        : hasOffTime
          ? `OFFが強い時間帯は${offRanges}。総LEDDを10～15%増量するか、オフの30～60分前に投与を前倒し（朝のdelayed-onでは起床直後・食前30分）。${ldopaRegimen === "IR_only" ? "回数増やアゴニスト徐放・貼付薬の追加・増量も検討。" : ""}\n\n処方例：${ldopaBrand}50mgをオフ30分前に前倒し、${ldopaBrand}${ldopaDose}mg×${ldopaFreq}回 → ${ldopaBrand}${Math.round(ldopaDose * 1.1)}～${Math.round(ldopaDose * 1.15)}mg×${ldopaFreq}回${hasLongAgonist ? `、または${agonistExample}` : ""}。`
          : `朝の効きの悪さがあれば初回を起床直後・食前30分に寄せる時間調整を検討。\n\n処方例：${ldopaBrand}100mg×3回を、起床直後・昼食前・夕食前に均等間隔で。`,
  });

  const ldopaHint =
    ldopaRegimen === "IR_only" && hasOffTime
      ? "夜間～早朝OFFがあれば就寝前のアゴニスト徐放や貼付薬の追加を検討。\n\n処方例：" + agonistExample
      : ldopaRegimen === "ER_or_mixed"
        ? "用量は変えず、食事（蛋白）との兼ね合いや服用間隔の均等化を調整。\n\n処方例：L-dopaを食前30～60分に均等間隔で。"
        : `用量は変えず、食事との兼ね合い（食前30～60分）や服用間隔の調整を。\n\n処方例：${ldopaBrand}100mg×3回を 7:00・12:00・18:00 の食前30分に均等化。`;
  proposals.push({
    category: "optimize",
    title: "案3（時間調整）",
    body: active.length === 0 ? "処方を入力すると、時間調整案を表示します。" : ldopaHint,
  });

  // ----- プラン2：新規薬剤・スイッチング（3案） -----

  const agonistWarning = sleepiness ? " ※眠気ありのためアゴニスト増量・新規は非推奨。減量・中止を優先検討。" : "";

  let switch1 = "";
  if (hasCOMT && hasMAOB) {
    switch1 = `既にCOMT阻害薬・MAO-B阻害薬を使用中。L-dopaの時間調整・回数増、またはアゴニスト徐放・貼付薬の追加で持続化を図る。\n\n処方例：${ldopaBrand}100mg×3回 → 100mg×4回、または${agonistExample}。${agonistWarning}`;
  } else if (hasCOMT) {
    switch1 = `既にCOMT阻害薬を使用中。MAO-B阻害薬の追加、またはオンジェンティスへの変更でさらに持続化を検討。\n\n処方例：アジレクト1mg 1日1回、エクセロン50mg 1日1回、またはオンジェンティス25mg 1日1回へ変更。${agonistWarning}`;
  } else if (hasMAOB) {
    switch1 = `既にMAO-B阻害薬を使用中。COMT阻害薬の追加でL-dopa持続化・オフ短縮が期待できる。\n\n処方例：オンジェンティス25mg 1日1回、コムタン200mg 毎回のL-dopaに併用。${agonistWarning}`;
  } else {
    switch1 = `COMT阻害薬やMAO-B阻害薬の追加で、L-dopaの持続化・オフ短縮が期待できる。\n\n処方例：オンジェンティス25mg 1日1回、コムタン200mg 毎回のL-dopaに併用、アジレクト1mg 1日1回、エクセロン50mg 1日1回。${agonistWarning}`;
  }
  proposals.push({ category: "switch", title: "案1（持続化）", body: active.length === 0 ? "処方を入力すると、持続化の追加案を表示します。" : switch1 });

  let switch2 = "";
  if (agonistNames.length > 0 && sleepiness) {
    switch2 = `現在アゴニスト（${agonistNames.join("、")}）を使用中。眠気ありのため増量・長時間型への変更は非推奨。減量・中止を優先し、必要に応じてL-dopaで代行。\n\n処方例：レキップ2mg×3回 → 1.5mg×3回、または${ldopaBrand}50mg×1回追加で代行。`;
  } else if (hasLongAgonist) {
    switch2 = `既に長時間作用型アゴニストを使用中。夜間症状やオフ対策として、現在のアゴニスト増量を検討。\n\n処方例：${agonistExample}。${agonistWarning}`;
  } else if (agonistNames.length > 0) {
    switch2 = `現在のアゴニスト（${agonistNames.join("、")}）を長時間作用型への変更で底上げを検討。\n\n処方例：レキップ2mg×3回 → レキップCR4mg 1日1回、ミラペックス0.5mg×3回 → ビ・シフロールL/A 0.375mg 1日1回。${agonistWarning}`;
  } else {
    switch2 = `長時間作用型アゴニストの追加で底上げを検討。\n\n処方例：ビ・シフロールL/A 0.375mg 1日1回から開始、レキップCR2mg 1日1回から開始、ニュープロパッチ4.5mg 1日1貼付。${agonistWarning}`;
  }
  proposals.push({ category: "switch", title: "案2（底上げ）", body: active.length === 0 ? "処方を入力すると、底上げ案を表示します。" : switch2 });

  let switch3 = "";
  if (hallucination && agonistNames.length > 0) {
    switch3 = `幻覚が出現しているため、デバイス治療よりも前に現在のアゴニスト（${agonistNames.join("、")}）とL-dopaの減量で精神症状の安定化を優先する段階。安定後もOFFや生活の質の低下が強い場合には、デバイス治療を中長期的な選択肢として説明しておく。`;
  } else if (hallucination) {
    switch3 = `幻覚あり。L-dopa中心に減量しつつ、日常生活機能とのバランスを確認するフェーズ。精神症状がコントロールできない間はデバイス治療は慎重にし、まずは内服調整でのコントロールを目指す。`;
  } else if (ldopaRegimen === "duodopa") {
    switch3 = `デュオドーパ導入済み。現在のOFF時間（${offRanges}）やジスキネジア（${dyskRanges}）が目立つようであれば、流量・ボーラス設定や併用薬を含めた全体の見直しを検討するタイミング。`;
  } else if (hasOffTime || hasDysk) {
    if (total >= 800) {
      switch3 = `内服治療が複雑化（LEDD Tot=${Math.round(total)}）しており、OFF時間（${offRanges}）やジスキネジア（${dyskRanges}）が生活に影響している場合は、デュオドーパやDBSなどデバイス治療を「そろそろ候補として説明しておく」段階。`;
    } else {
      switch3 = `まだ内服調整の余地はあるが、OFF時間（${offRanges}）やジスキネジア（${dyskRanges}）が目立つようなら、将来的なデバイス治療（デュオドーパやDBS等）を一度情報提供しておき、本人・家族と中長期的な治療方針を共有しておく。`;
    }
  } else {
    switch3 = `現時点では内服でのコントロールは概ね良好で、デバイス治療の優先度は高くない。今後の進行を見据えた選択肢として概要のみ説明し、将来的な検討候補として共有しておく程度とする。`;
  }
  proposals.push({ category: "switch", title: "案3（デバイス/特殊）", body: active.length === 0 ? "処方・症状を入力すると、デバイス/特殊案を表示します。" : switch3 });

  return proposals;
}

export function getSleepinessWarning(companion: CompanionSymptoms): string | null {
  return companion.sleepiness
    ? "眠気あり → アゴニスト増量は非推奨。減量・中止を優先検討してください。"
    : null;
}
