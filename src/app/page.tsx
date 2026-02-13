"use client";

import { useState, useMemo } from "react";
import { drugMaster, computeAll, getDrugByDisplayName, DRUG_CATEGORY_ORDER, CATEGORY_LABELS, type PrescriptionRow, type PrescriptionLEDDRow, type LEDDSummary } from "@/lib/ledd";
import { createEmptyTimeline, defaultCompanionSymptoms, type SymptomTimeline, type CompanionSymptoms } from "@/lib/symptoms";
import { generateProposals, getSleepinessWarning, type ProposalItem } from "@/lib/proposals";
import { SymptomTimeline as SymptomTimelineUI } from "@/components/SymptomTimeline";
import { SymptomCheckboxes } from "@/components/SymptomCheckboxes";
import { Logo } from "@/components/Logo";

const ACTIVE_DRUGS = drugMaster.filter((d) => d.isActive);

/** カテゴリごとにグループ化（表示順） */
const DRUGS_BY_CATEGORY = DRUG_CATEGORY_ORDER.map((cat) => ({
  category: cat,
  label: CATEGORY_LABELS[cat],
  drugs: ACTIVE_DRUGS.filter((d) => d.category === cat),
})).filter((g) => g.drugs.length > 0);
const emptyRow: PrescriptionRow = { drugId: "", displayName: "", dose: 0, freq: 1, times: [] };

const MEDLEY_SEARCH_BASE = "https://medley.life/medicines/search/?mode=21&q=";

/** 処方行から「同効薬含む」全ブランド名を重複なく取得 */
function getPrescribedBrands(rows: PrescriptionRow[]): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    if (!row.displayName || row.dose <= 0) continue;
    const drug = getDrugByDisplayName(row.displayName);
    if (!drug?.brandName) {
      set.add(row.displayName);
      continue;
    }
    for (const b of drug.brandName.split("、").map((s) => s.trim()).filter(Boolean)) {
      set.add(b);
    }
  }
  return Array.from(set).sort();
}

/** 提案文の本文に登場する薬剤マスタのブランド名を重複なく取得 */
function getProposalMentionedBrands(proposals: ProposalItem[]): string[] {
  const allBrands = new Set<string>();
  for (const d of drugMaster) {
    for (const b of d.brandName.split("、").map((s) => s.trim()).filter(Boolean)) {
      allBrands.add(b);
    }
  }
  const bodyText = proposals.map((p) => p.body).join("\n");
  return Array.from(allBrands).filter((brand) => bodyText.includes(brand)).sort();
}

function formatLEDD(n: number): string {
  return Number.isFinite(n) ? Math.round(n).toString() : "-";
}

/** 電子カルテ転写用テキスト：現在の処方・LEDD・提案処方例を1本の文字列に */
function buildTransferText(
  rxWithLEDD: PrescriptionLEDDRow[],
  summary: LEDDSummary,
  proposals: ProposalItem[]
): string {
  const lines: string[] = [
    "DopaPlan Tx",
    `日付: ${new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" })}`,
    "",
    "【処方・LEDD】",
  ];
  for (const row of rxWithLEDD) {
    if (!row.displayName || row.dose <= 0) continue;
    const drug = getDrugByDisplayName(row.displayName);
    const name = drug?.brandName?.split("、")[0]?.trim() ?? row.displayName;
    const ledd = Number.isFinite(row.leddValue) ? Math.round(row.leddValue) : 0;
    lines.push(`${name} ${row.dose}mg x${row.freq} L=${ledd}`);
  }
  lines.push(
    "",
    `Tot=${Math.round(summary.total)}`,
    "",
    "【提案処方】"
  );
  for (const p of proposals) {
    const match = p.body.match(/処方例[：:]\s*([\s\S]+)/);
    const raw = (match ? match[1] : p.body).replace(/\n/g, " ");
    const firstSentence = raw.split("。")[0] || raw;
    const example = firstSentence.slice(0, 60).trim();
    // 案名（案1・底上げなど）は省略し、処方変更内容だけをシンプルに記載
    lines.push(example);
  }
  return lines.join("\n");
}

export default function Home() {
  const [rows, setRows] = useState<PrescriptionRow[]>([{ ...emptyRow }]);
  const [timeline, setTimeline] = useState<SymptomTimeline>(createEmptyTimeline());
  const [companion, setCompanion] = useState<CompanionSymptoms>(defaultCompanionSymptoms);
  const { rxWithLEDD, summary } = useMemo(() => computeAll(rows), [rows]);
  const proposals = useMemo(() => generateProposals(summary, timeline, companion, rxWithLEDD), [summary, timeline, companion, rxWithLEDD]);
  const sleepinessWarning = useMemo(() => getSleepinessWarning(companion), [companion]);
  const transferText = useMemo(() => buildTransferText(rxWithLEDD, summary, proposals), [rxWithLEDD, summary, proposals]);
  const [qrDataUrls, setQrDataUrls] = useState<string[]>([]);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);

  const handleGenerateQr = async () => {
    const text = transferText.trim();
    if (!text) {
      setQrDataUrls([]);
      return;
    }
    setIsGeneratingQr(true);
    try {
      const { toDataURL } = await import("qrcode");
      const parts = 4;
      const len = text.length;
      const chunkSize = Math.ceil(len / parts);
      const urls: string[] = [];
      for (let i = 0; i < parts; i++) {
        const slice = text.slice(i * chunkSize, (i + 1) * chunkSize);
        const payload = `DopaPlan ${i + 1}/${parts}\n` + slice;
        const url = await toDataURL(payload, { margin: 2, width: 220 });
        urls.push(url);
      }
      setQrDataUrls(urls);
    } catch (e) {
      console.error(e);
      setQrDataUrls([]);
    } finally {
      setIsGeneratingQr(false);
    }
  };

  const addRow = () => setRows((r) => [...r, { ...emptyRow }]);
  const updateRow = (index: number, field: keyof PrescriptionRow, value: string | number | string[]) => {
    setRows((r) => {
      const next = [...r];
      const row = next[index];
      next[index] = { ...row, [field]: value };
      if (field === "displayName" && typeof value === "string") {
        const drug = drugMaster.find((d) => d.displayName === value);
        if (drug) next[index].drugId = drug.id;
      }
      return next;
    });
  };
  const removeRow = (index: number) => {
    if (rows.length <= 1) return;
    setRows((r) => r.filter((_, i) => i !== index));
  };

  const handleReset = () => {
    if (typeof window !== "undefined" && !window.confirm("入力内容をすべてリセットしますか？\n（処方・症状・タイムラインがクリアされます）")) return;
    setRows([{ ...emptyRow }]);
    setTimeline(createEmptyTimeline());
    setCompanion(defaultCompanionSymptoms);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl sm:text-5xl">
            <Logo className="leading-none" />
          </h1>
          <p className="text-sm text-gray-600 mt-1.5">パーキンソン病診療をサポートする診療補助ツール</p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
        >
          すべてリセット
        </button>
      </header>

      <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">処方入力</h2>
        <p className="text-sm text-gray-500 mb-4">薬剤名・1回量・1日回数を入力すると、総LEDDを即時計算します。</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-600">
                <th className="pb-2 pr-2 min-w-0">薬剤（商品名）</th>
                <th className="pb-2 pr-1 w-14 sm:w-20">1回量</th>
                <th className="pb-2 pr-1 w-10 sm:w-14">回数/日</th>
                <th className="pb-2 pr-1 w-10 sm:w-14">LEDD</th>
                <th className="pb-2 w-8 sm:w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-2 pr-1 sm:pr-2 min-w-0">
                    <select className="w-full min-w-0 rounded border border-gray-300 px-2 py-1.5 text-gray-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500" value={row.displayName} onChange={(e) => updateRow(i, "displayName", e.target.value)}>
                      <option value="">選択</option>
                      {DRUGS_BY_CATEGORY.map((group) => (
                        <optgroup key={group.category} label={group.label}>
                          {group.drugs.map((d) => (
                            <option key={d.id} value={d.displayName}>{d.brandName ? `${d.displayName}（${d.brandName}）` : d.displayName}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    {row.displayName && <div className="text-xs text-gray-500 mt-1">{getDrugByDisplayName(row.displayName)?.brandName}</div>}
                  </td>
                  <td className="py-2 pr-1 sm:pr-2 w-14 sm:w-20">
                    <input type="number" min={0} step={0.5} className="w-full rounded border border-gray-300 px-1.5 sm:px-2 py-1.5 text-gray-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500" value={row.dose || ""} onChange={(e) => updateRow(i, "dose", parseFloat(e.target.value) || 0)} placeholder="mg" />
                  </td>
                  <td className="py-2 pr-1 sm:pr-2 w-10 sm:w-14">
                    <input type="number" min={1} max={10} className="w-full rounded border border-gray-300 px-1.5 sm:px-2 py-1.5 text-gray-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500" value={row.freq || ""} onChange={(e) => updateRow(i, "freq", parseInt(e.target.value, 10) || 1)} />
                  </td>
                  <td className="py-2 pr-1 sm:pr-2 w-10 sm:w-14 text-gray-700 font-medium text-right">{formatLEDD(rxWithLEDD[i]?.leddValue ?? 0)}</td>
                  <td className="py-2 w-8 sm:w-10">
                    <button type="button" onClick={() => removeRow(i)} className="text-red-600 hover:underline text-xs whitespace-nowrap" aria-label="行を削除">削除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={addRow} className="mt-3 text-brand-600 hover:text-brand-800 text-sm font-medium">+ 薬剤を追加</button>
      </section>

      <section className="rounded-xl border border-brand-200 bg-brand-50/50 p-6 mb-8">
        <h2 className="text-lg font-semibold text-brand-900 mb-3">LEDD サマリ</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <div><dt className="text-gray-600">LEDD (L-dopa調整後)</dt><dd className="font-semibold text-gray-900">{formatLEDD(summary.ldopaAdjusted)}</dd></div>
          <div><dt className="text-gray-600">LEDD (Agonist)</dt><dd className="font-semibold text-gray-900">{formatLEDD(summary.agonist)}</dd></div>
          <div><dt className="text-gray-600">LEDD (Other)</dt><dd className="font-semibold text-gray-900">{formatLEDD(summary.other)}</dd></div>
          <div><dt className="text-gray-600">LEDD Total</dt><dd className="font-bold text-brand-800 text-lg">{formatLEDD(summary.total)}</dd></div>
        </dl>
      </section>

      <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">症状プロファイリング</h2>
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">1日のタイムライン</h3>
            <SymptomTimelineUI value={timeline} onChange={setTimeline} />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">随伴症状</h3>
            <SymptomCheckboxes value={companion} onChange={setCompanion} />
          </div>
        </div>
      </section>

      <section className="mb-8 rounded-xl border-2 border-brand-300 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-brand-900 mb-2">次の一手 提案</h2>
        <p className="text-sm text-gray-600 mb-4">入力内容に基づく診療補助案です。治療方針の決定は医師の判断で行ってください。</p>
        {sleepinessWarning && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm font-medium">
            {sleepinessWarning}
          </div>
        )}
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 border-b border-gray-200 pb-1">プラン1：既存薬の最適化</h3>
            <div className="space-y-3">
              {proposals.filter((p) => p.category === "optimize").map((p, i) => (
                <ProposalCard key={i} item={p} />
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 border-b border-gray-200 pb-1">プラン2：新規薬剤・スイッチング</h3>
            <div className="space-y-3">
              {proposals.filter((p) => p.category === "switch").map((p, i) => (
                <ProposalCard key={i} item={p} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">電子カルテ転写用（QRコード）</h2>
        <p className="text-sm text-gray-600 mb-4">
          現在の処方・LEDD・提案処方例をまとめたテキストを4分割し、連結QRコードとして生成します。電子カルテ側で順に読み取って転写してください。
        </p>
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          <div className="flex-1 min-w-0 w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">転写用テキスト（コピー可）</label>
            <textarea
              readOnly
              value={transferText}
              className="w-full h-48 rounded-lg border border-gray-300 bg-gray-50 p-3 text-sm font-mono text-gray-800 resize-none"
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
            <button
              type="button"
              onClick={handleGenerateQr}
              disabled={!transferText.trim() || isGeneratingQr}
              className="mt-3 inline-flex items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:bg-gray-300 disabled:text-gray-600"
            >
              {isGeneratingQr ? "QRコード作成中..." : "QRコードを作成"}
            </button>
          </div>
          {qrDataUrls.length > 0 && (
            <div className="flex-shrink-0 flex flex-col items-center">
              <span className="block text-sm font-medium text-gray-700 mb-2">連結QRコード（4分割）</span>
              <div className="grid grid-cols-2 gap-3">
                {qrDataUrls.map((url, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-1 text-xs text-gray-500">
                    <img src={url} alt={`電子カルテ転写用QRコード ${idx + 1}/4`} className="rounded-lg border border-gray-200" width={220} height={220} />
                    <span>{idx + 1}/4</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-gray-200 bg-gray-50/50 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">DI・相互作用の参照</h2>
        <p className="text-sm text-gray-600 mb-4">処方中の薬剤・提案に出てくる薬剤の相互作用・添付文書は各リンクから確認できます。</p>
        <div className="space-y-4">
          {(() => {
            const prescribedBrands = getPrescribedBrands(rows);
            const proposalBrands = getProposalMentionedBrands(proposals);
            const proposalBrandsOnly = proposalBrands.filter((b) => !prescribedBrands.includes(b));
            return (
              <>
                {prescribedBrands.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">処方中の薬剤（同効薬含む）で検索</h3>
                    <p className="text-xs text-gray-500 mb-2">選択中の薬剤とその同効薬の全ブランドを掲載しています。</p>
                    <ul className="flex flex-wrap gap-2">
                      {prescribedBrands.map((brand) => {
                        const url = `${MEDLEY_SEARCH_BASE}${encodeURIComponent(brand)}`;
                        return (
                          <li key={brand}>
                            <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-full bg-white border border-gray-300 px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50 hover:border-brand-400">
                              {brand}
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                {proposalBrandsOnly.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">提案に出てくる薬剤で検索</h3>
                    <p className="text-xs text-gray-500 mb-2">今回の提案文に記載された薬剤です（処方中と重複は除く）。併用・変更検討時に参照してください。</p>
                    <ul className="flex flex-wrap gap-2">
                      {proposalBrandsOnly.map((brand) => {
                        const url = `${MEDLEY_SEARCH_BASE}${encodeURIComponent(brand)}`;
                        return (
                          <li key={brand}>
                            <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-full bg-white border border-gray-300 px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50 hover:border-brand-400">
                              {brand}
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </section>

      <footer className="mt-8 text-xs text-gray-500">本ツールは診療補助目的であり、治療方針を決定するものではありません。各種薬剤の効能効果・副作用・禁忌は別途確認してください。</footer>
    </div>
  );
}

function ProposalCard({ item }: { item: ProposalItem }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 text-sm">
      <div className="font-semibold text-gray-800 mb-1">{item.title}</div>
      <p className="text-gray-700 leading-relaxed whitespace-pre-line">{item.body}</p>
    </div>
  );
}
