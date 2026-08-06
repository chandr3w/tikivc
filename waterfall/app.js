import { allocateConsideration, computeEquityBridge, computeWaterfall, ratchetMultiplier } from "./waterfall-engine.js";
import { PRESETS, blankStakeholder, blankTranche, clonePreset } from "./presets.js";

const STORAGE_KEY = "tiki-exit-waterfall-v3";
const controls = document.querySelector("#controls");
const resultsContent = document.querySelector("#results-content");
const presetSelect = document.querySelector("#preset-select");
const importFile = document.querySelector("#import-file");
const methodsDialog = document.querySelector("#methods-dialog");
const sourcesDialog = document.querySelector("#sources-dialog");
const methodsContent = document.querySelector("#methods-content");
const sourcesContent = document.querySelector("#sources-content");

const GENERAL_SOURCES = [
  { label: "Wilson Sonsini: venture financing fundamentals", url: "https://www.wsgr.com/email/college-for-clients-series/2024/VC-Financing/PPT-2024-C4C-VC-Financing-Fundamentals.pdf", note: "Liquidation preference, participation, conversion and anti-dilution mechanics." },
  { label: "Y Combinator: SAFE user guide", url: "https://bookface-static.ycombinator.com/assets/ycdc/SAFE%20User%20Guide-a47c6588327d73aa2799e61ed7c2cae9f1a0ee9acfa9c43b62039dc06e715832.pdf", note: "SAFE capitalization and liquidity-event treatment." },
  { label: "NVCA: model legal documents", url: "https://nvca.org/model-legal-documents/", note: "Venture financing document framework." },
  { label: "SRS Acquiom: 2025 M&A terms study", url: "https://media.taftlaw.com/wp-content/uploads/2025/04/15175412/2025-SRS-Acquiom-MA-Deal-Terms-Study-2-page-quick-reference.pdf", note: "Market context for consideration mix, escrows, earnouts and option treatment." },
];

let state = loadSavedState() || clonePreset("airtable");
let activeInputTab = "deal";

const dealFields = [
  ["name", "Company / transaction", "text", true],
  ["enterpriseValue", "Enterprise value", "money"],
  ["cash", "Cash and investments", "money"],
  ["debt", "Debt payoff", "money"],
  ["debtLike", "Debt-like items", "money"],
  ["workingCapital", "Working-capital adjustment", "money"],
  ["transactionFees", "Transaction expenses", "money"],
  ["bonuses", "Change-in-control / carve-out", "money"],
  ["transferTaxes", "Transfer and entity-level taxes", "money"],
  ["otherAdjustment", "Other adjustment", "money"],
  ["discountRate", "PV discount rate", "percent"],
];

function loadSavedState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved?.deal && Array.isArray(saved.stakeholders) && Array.isArray(saved.tranches) ? saved : null;
  } catch {
    return null;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function renderAll() {
  presetSelect.value = state.meta?.preset in PRESETS ? state.meta.preset : "airtable";
  document.querySelectorAll(".input-tab").forEach((button) => button.classList.toggle("active", button.dataset.tab === activeInputTab));
  renderControls();
  renderResults();
  renderDialogs();
  saveState();
}

function renderControls() {
  if (activeInputTab === "deal") controls.innerHTML = renderDealControls();
  if (activeInputTab === "stakeholders") controls.innerHTML = renderStakeholderControls();
  if (activeInputTab === "consideration") controls.innerHTML = renderConsiderationControls();
}

function renderDealControls() {
  const bridge = computeEquityBridge(state.deal);
  const core = dealFields.slice(0, 4);
  const advanced = dealFields.slice(4);
  return `
    <div class="panel-heading"><div><span class="kicker">purchase price</span><h2>Deal bridge</h2></div><span class="panel-total">${formatMoney(bridge.equityValue)}</span></div>
    <p class="panel-note">Start with enterprise value, then bridge to the value available for the security waterfall.</p>
    <div class="form-grid">${core.map(renderDealField).join("")}</div>
    <details class="subsection">
      <summary>additional bridge adjustments</summary>
      <div class="subsection-body form-grid">${advanced.map(renderDealField).join("")}</div>
    </details>`;
}

function renderDealField([key, label, type, wide = false]) {
  return inputField({ label, value: state.deal[key], inputType: type, scope: "deal", field: key, wide });
}

function renderStakeholderControls() {
  return `
    <div class="panel-heading"><div><span class="kicker">priority stack</span><h2>Securities</h2></div><span class="panel-total">${state.stakeholders.length} rows</span></div>
    <p class="panel-note">Tier 1 is most senior. Equal tiers share an underfunded tier pari passu. Preference defaults to 0×.</p>
    ${state.stakeholders.map(renderStakeholderEditor).join("")}
    <button class="button add-row" type="button" data-action="add-stakeholder">add stakeholder or class</button>`;
}

function renderConsiderationControls() {
  return `
    <div class="panel-heading"><div><span class="kicker">form & timing</span><h2>Consideration</h2></div><span class="panel-total">${countActiveTranches()} active</span></div>
    <p class="panel-note">Leave every amount at zero for a clean cash acquisition. Incremental tranches add to bridge equity value.</p>
    ${state.tranches.map(renderTrancheEditor).join("")}
    <button class="button add-row" type="button" data-action="add-tranche">add consideration tranche</button>`;
}

function renderTrancheEditor(tranche, index) {
  return `
    <details class="editor-row">
      <summary class="editor-summary"><span class="editor-summary-main"><strong>${escapeHtml(tranche.label)}</strong><span>${escapeHtml(labelForType(tranche.type))} · ${tranche.treatment === "incremental" ? "incremental" : "included"}</span></span><span class="editor-amount">${formatMoney(tranche.amount)}</span></summary>
      <div class="editor-body"><div class="form-grid">
        ${indexedField(index, "tranche", "label", "Label", tranche.label, "text", true)}
        ${indexedField(index, "tranche", "amount", "Face amount", tranche.amount, "money")}
        ${selectField(index, "tranche", "type", "Form", tranche.type, [["stock","Buyer stock"],["escrow","Escrow / holdback"],["note","Seller note"],["earnout","Earnout"],["rollover","Rollover equity"],["other","Other"]])}
        ${selectField(index, "tranche", "treatment", "Price treatment", tranche.treatment || "included", [["included","Included in bridge"],["incremental","Incremental to bridge"]])}
        ${selectField(index, "tranche", "eligibility", "Eligible holders", tranche.eligibility, [["all","All holders"],["escrow","Escrow-eligible"],["deferred","Deferred-eligible"]])}
        ${indexedField(index, "tranche", "expectedPercent", "Expected realization", tranche.expectedPercent, "percent")}
        ${indexedField(index, "tranche", "years", "Timing (years)", tranche.years, "number")}
      </div><div class="editor-actions"><button class="button danger" type="button" data-action="remove-tranche" data-index="${index}">remove</button></div></div>
    </details>`;
}

function renderStakeholderEditor(holder, index) {
  const preferenceSecurity = ["preferred", "safe", "note"].includes(holder.securityType);
  const optionLike = ["option", "warrant"].includes(holder.securityType);
  const ratchet = holder.ratchetType && holder.ratchetType !== "none";
  return `
    <details class="editor-row">
      <summary class="editor-summary"><span class="editor-summary-main"><strong>${escapeHtml(holder.name)}</strong><span>${escapeHtml(labelForSecurity(holder.securityType))} · ${formatShares(holder.shares)}</span></span></summary>
      <div class="editor-body"><div class="form-grid">
        ${indexedField(index, "stakeholder", "name", "Stakeholder / class", holder.name, "text", true)}
        ${selectField(index, "stakeholder", "securityType", "Security", holder.securityType, [["common","Common stock"],["preferred","Preferred stock"],["safe","SAFE"],["note","Convertible note"],["rsu","RSU / restricted stock"],["option","Option"],["warrant","Warrant"]])}
        ${indexedField(index, "stakeholder", "shares", "As-converted shares", holder.shares, "shares")}
        ${indexedField(index, "stakeholder", "eligiblePercent", "Vested / eligible", holder.eligiblePercent, "percent")}
        ${optionLike ? indexedField(index, "stakeholder", "strike", "Strike per share", holder.strike, "number") : ""}
        ${preferenceSecurity ? `
          ${indexedField(index, "stakeholder", "invested", "Preference base", holder.invested, "money")}
          ${indexedField(index, "stakeholder", "preferenceMultiple", "Preference multiple", holder.preferenceMultiple, "number")}
          ${indexedField(index, "stakeholder", "seniority", "Seniority tier", holder.seniority, "number")}
          ${selectField(index, "stakeholder", "participation", "Participation", holder.participation, [["none","Non-participating"],["full","Fully participating"],["capped","Capped participation"]])}
          ${holder.participation === "capped" ? indexedField(index, "stakeholder", "capMultiple", "Participation cap", holder.capMultiple, "number") : ""}
          ${selectField(index, "stakeholder", "conversionPolicy", "Conversion election", holder.conversionPolicy, [["elective","Economically optimal"],["force-convert","Force conversion"],["force-preference","Force preference"]])}
          ${selectField(index, "stakeholder", "dividendType", "Cumulative dividend", holder.dividendType || "none", [["none","None"],["fixed","Fixed accrued"],["simple","Simple annual"],["compound","Compound annual"]])}
          ${holder.dividendType === "fixed" ? indexedField(index, "stakeholder", "accruedDividend", "Accrued dividend", holder.accruedDividend, "money") : ""}
          ${["simple","compound"].includes(holder.dividendType) ? indexedField(index, "stakeholder", "dividendRate", "Dividend rate", holder.dividendRate, "percent") : ""}
          ${["simple","compound"].includes(holder.dividendType) ? indexedField(index, "stakeholder", "dividendYears", "Accrual years", holder.dividendYears, "number") : ""}
          ${holder.dividendType === "compound" ? indexedField(index, "stakeholder", "dividendPeriods", "Periods per year", holder.dividendPeriods, "number") : ""}
          ${holder.dividendType !== "none" ? indexedField(index, "stakeholder", "paidDividends", "Dividends already paid", holder.paidDividends, "money") : ""}
          ${indexedField(index, "stakeholder", "secondaryPreferenceMultiple", "Split claim multiple", holder.secondaryPreferenceMultiple, "number")}
          ${Number(holder.secondaryPreferenceMultiple) > 0 ? indexedField(index, "stakeholder", "secondarySeniority", "Split claim tier", holder.secondarySeniority, "number") : ""}
          ${indexedField(index, "stakeholder", "priorDistributions", "Prior distributions", holder.priorDistributions, "money")}
          ${indexedField(index, "stakeholder", "waiverPercent", "Preference waiver", holder.waiverPercent, "percent")}
          ${selectField(index, "stakeholder", "ratchetType", "Anti-dilution ratchet", holder.ratchetType, [["none","None"],["full-ratchet","Full ratchet"],["weighted-average","Weighted average"],["custom","Custom multiplier"]])}
          ${ratchet && holder.ratchetType !== "custom" ? indexedField(index, "stakeholder", "originalPrice", "Original conversion price", holder.originalPrice, "number") : ""}
          ${ratchet && holder.ratchetType !== "custom" ? indexedField(index, "stakeholder", "downRoundPrice", "Down-round price", holder.downRoundPrice, "number") : ""}
          ${holder.ratchetType === "weighted-average" ? indexedField(index, "stakeholder", "preRoundShares", "Pre-round cap (A)", holder.preRoundShares, "shares") : ""}
          ${holder.ratchetType === "weighted-average" ? indexedField(index, "stakeholder", "newMoney", "Down-round new money", holder.newMoney, "money") : ""}
          ${holder.ratchetType === "custom" ? indexedField(index, "stakeholder", "conversionMultiplier", "Share multiplier", holder.conversionMultiplier, "number") : ""}
        ` : ""}
        ${checkboxField(index, "escrowEligible", "Contributes to escrows / holdbacks", holder.escrowEligible)}
        ${checkboxField(index, "deferredEligible", "Receives notes, earnouts or rollover", holder.deferredEligible)}
      </div><div class="editor-actions"><button class="button danger" type="button" data-action="remove-stakeholder" data-index="${index}">remove</button></div></div>
    </details>`;
}

function calculateModel() {
  const bridge = computeEquityBridge(state.deal);
  const incremental = incrementalConsideration();
  const grossProceeds = bridge.equityValue + incremental;
  const waterfall = computeWaterfall(state.stakeholders, grossProceeds);
  const consideration = allocateConsideration(state.stakeholders, waterfall.payouts, state.tranches, state.deal.discountRate);
  const rows = state.stakeholders.map((holder, index) => {
    const timing = consideration.results[holder.id] || { entitlement: 0, closingCash: 0, expectedPresentValue: 0, tranches: {} };
    const deferred = Object.values(timing.tranches).reduce((sum, amount) => sum + amount, 0);
    return { holder, index, timing, deferred };
  }).sort((a, b) => b.timing.entitlement - a.timing.entitlement);
  return { bridge, incremental, grossProceeds, waterfall, consideration, rows };
}

function renderResults() {
  const model = calculateModel();
  const { bridge, incremental, grossProceeds, waterfall, consideration, rows } = model;
  const totalClosing = rows.reduce((sum, row) => sum + row.timing.closingCash, 0);
  const totalDeferred = rows.reduce((sum, row) => sum + row.deferred, 0);
  const totalExpected = rows.reduce((sum, row) => sum + row.timing.expectedPresentValue, 0);
  const warnings = buildWarnings(bridge, waterfall, consideration);
  resultsContent.innerHTML = `
    <header class="result-header"><div><span class="kicker">transaction results</span><h2>${escapeHtml(state.deal.name || "Untitled transaction")}</h2><p>${escapeHtml(state.meta?.description || "Custom transaction model")}</p></div></header>
    ${warnings.length ? `<div class="alerts">${warnings.map((warning) => `<div class="alert ${warning.tone || ""}">${escapeHtml(warning.text)}</div>`).join("")}</div>` : ""}
    <section class="metrics" aria-label="Transaction summary">
      ${metric("gross waterfall value", formatMoney(grossProceeds), true)}
      ${metric("cash at close", formatMoney(totalClosing))}
      ${metric("non-cash / deferred", formatMoney(totalDeferred))}
      ${metric("expected present value", formatMoney(totalExpected))}
    </section>
    <div class="visual-grid">
      ${renderBridgeChart(bridge, incremental, grossProceeds)}
      ${renderAllocationDonut(rows, grossProceeds)}
      ${renderSensitivityChart()}
    </div>
    ${renderPayoutTable(rows, waterfall, grossProceeds)}
  `;
}

function renderBridgeChart(bridge, incremental, grossProceeds) {
  const deal = state.deal;
  const entries = [
    { label: "EV", total: number(deal.enterpriseValue) },
    { label: "cash", delta: number(deal.cash) },
    { label: "debt", delta: -(number(deal.debt) + number(deal.debtLike)) },
    { label: "WC", delta: number(deal.workingCapital) },
    { label: "costs", delta: -(number(deal.transactionFees) + number(deal.bonuses) + number(deal.transferTaxes)) },
    { label: "other", delta: number(deal.otherAdjustment) },
    { label: "equity", total: bridge.equityValue, final: incremental <= 0 },
  ];
  if (incremental > 0) entries.push({ label: "contingent", delta: incremental }, { label: "gross", total: grossProceeds, final: true });
  const maxValue = Math.max(1, ...entries.map((entry) => Math.abs(entry.total ?? entry.delta ?? 0)), grossProceeds, number(deal.enterpriseValue));
  const bottom = 157;
  const chartHeight = 122;
  const scale = chartHeight / maxValue;
  const gap = 720 / entries.length;
  const width = Math.min(46, gap * .56);
  let running = 0;
  const bars = entries.map((entry, index) => {
    const x = gap * index + gap / 2 - width / 2;
    const start = entry.total !== undefined ? 0 : running;
    const end = entry.total !== undefined ? entry.total : Math.max(0, running + entry.delta);
    if (entry.total !== undefined) running = entry.total; else running = end;
    const topValue = Math.max(start, end);
    const lowValue = Math.min(start, end);
    const height = Math.max(2, (topValue - lowValue) * scale);
    const y = bottom - topValue * scale;
    const className = entry.final ? "mint" : entry.total !== undefined ? "platinum" : "ghost";
    const value = entry.total !== undefined ? entry.total : entry.delta;
    const connector = index < entries.length - 1 ? `<line class="gridline" x1="${x + width}" y1="${bottom - running * scale}" x2="${gap * (index + 1) + gap / 2 - width / 2}" y2="${bottom - running * scale}"/>` : "";
    return `${connector}<rect class="${className}" x="${x}" y="${y}" width="${width}" height="${height}" opacity="${entry.final ? 1 : .68}" rx="2"><title>${escapeHtml(entry.label)}: ${formatMoney(value)}</title></rect><text class="value" x="${x + width / 2}" y="${Math.max(10, y - 6)}" text-anchor="middle">${escapeHtml(formatMoney(value))}</text><text class="label" x="${x + width / 2}" y="176" text-anchor="middle">${escapeHtml(entry.label)}</text>`;
  }).join("");
  return `<section class="viz-panel" aria-labelledby="bridge-chart-title"><div class="viz-heading"><div><span class="section-label">value bridge</span><h3 id="bridge-chart-title">From EV to proceeds</h3></div><p>${formatMoney(grossProceeds)} distributable</p></div><svg class="chart" viewBox="0 0 720 190" role="img" aria-label="Waterfall chart from enterprise value to gross proceeds"><line class="axis" x1="10" y1="157" x2="710" y2="157"/>${bars}</svg></section>`;
}

function renderAllocationDonut(rows, total) {
  const maxSegments = 5;
  const shown = rows.slice(0, maxSegments).map((row) => ({ name: row.holder.name, amount: row.timing.entitlement }));
  if (rows.length > maxSegments) shown.push({ name: "Other holders", amount: rows.slice(maxSegments).reduce((sum, row) => sum + row.timing.entitlement, 0) });
  const colors = ["#4ecd89", "#d5d9e2", "rgba(78,205,137,.62)", "rgba(213,217,226,.58)", "rgba(78,205,137,.34)", "rgba(213,217,226,.28)"];
  const circumference = 301.593;
  let offset = 0;
  const segments = shown.map((item, index) => {
    const ratio = total > 0 ? item.amount / total : 0;
    const length = ratio * circumference;
    const circle = `<circle cx="66" cy="66" r="48" stroke="${colors[index]}" stroke-dasharray="${length} ${circumference - length}" stroke-dashoffset="${-offset}"><title>${escapeHtml(item.name)}: ${formatMoney(item.amount)} (${formatPercent(ratio)})</title></circle>`;
    offset += length;
    return circle;
  }).join("");
  const legend = shown.map((item, index) => `<div class="legend-row"><span class="legend-dot" style="background:${colors[index]}"></span><span>${escapeHtml(item.name)}</span><strong>${formatPercent(total > 0 ? item.amount / total : 0)}</strong></div>`).join("");
  return `<section class="viz-panel" aria-labelledby="allocation-chart-title"><div class="viz-heading"><div><span class="section-label">holder outcomes</span><h3 id="allocation-chart-title">Proceeds ownership</h3></div><p>gross entitlement</p></div><div class="donut-layout"><svg class="donut" viewBox="0 0 132 132" role="img" aria-label="Donut chart of proceeds by stakeholder"><circle cx="66" cy="66" r="48" stroke="rgba(255,255,255,.08)"/>${segments}<text class="donut-total" x="66" y="64">${escapeHtml(formatMoney(total))}</text><text class="donut-caption" x="66" y="77">total</text></svg><div class="chart-legend">${legend}</div></div></section>`;
}

function sensitivityData() {
  return [0.5, 0.75, 1, 1.25, 1.5, 2].map((multiple) => {
    const deal = { ...state.deal, enterpriseValue: number(state.deal.enterpriseValue) * multiple };
    const gross = computeEquityBridge(deal).equityValue + incrementalConsideration();
    const waterfall = computeWaterfall(state.stakeholders, gross);
    return { multiple, gross, price: waterfall.pricePerShare };
  });
}

function renderSensitivityChart() {
  const data = sensitivityData();
  const maxGross = Math.max(1, ...data.map((point) => point.gross));
  const left = 42;
  const right = 690;
  const top = 18;
  const bottom = 152;
  const points = data.map((point, index) => ({ ...point, x: left + index * ((right - left) / (data.length - 1)), y: bottom - (point.gross / maxGross) * (bottom - top) }));
  const path = points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
  const areaPath = `${path} L${right},${bottom} L${left},${bottom} Z`;
  const grid = [0, .5, 1].map((ratio) => { const y = bottom - ratio * (bottom - top); return `<line class="gridline" x1="${left}" y1="${y}" x2="${right}" y2="${y}"/><text class="label" x="35" y="${y + 3}" text-anchor="end">${formatMoney(maxGross * ratio)}</text>`; }).join("");
  const labels = points.map((point) => `<circle class="point" cx="${point.x}" cy="${point.y}" r="${point.multiple === 1 ? 4 : 2.5}"><title>${point.multiple.toFixed(2)}× EV: ${formatMoney(point.gross)}</title></circle><text class="label" x="${point.x}" y="174" text-anchor="middle">${point.multiple.toFixed(2)}×</text>`).join("");
  return `<section class="viz-panel" aria-labelledby="sensitivity-chart-title"><div class="viz-heading"><div><span class="section-label">exit sensitivity</span><h3 id="sensitivity-chart-title">Value across EV cases</h3></div><p>bridge terms held constant</p></div><svg class="chart" viewBox="0 0 720 190" role="img" aria-label="Line chart of gross proceeds across enterprise value cases"><defs><linearGradient id="areaFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4ecd89" stop-opacity=".2"/><stop offset="1" stop-color="#4ecd89" stop-opacity="0"/></linearGradient></defs>${grid}<path class="area" d="${areaPath}"/><path class="line" d="${path}"/>${labels}</svg></section>`;
}

function renderPayoutTable(rows, waterfall, total) {
  const preferenceTotal = Object.values(waterfall.preferencePaid).reduce((sum, value) => sum + value, 0);
  return `<section class="payout-section" aria-labelledby="payout-title"><div class="table-heading"><div><span class="section-label">security waterfall</span><h3 id="payout-title">Stakeholder proceeds</h3></div><p>${formatMoney(preferenceTotal)} preference paid · ${formatMoney(waterfall.pricePerShare)} common / share</p></div><div class="table-wrap"><table><thead><tr><th>stakeholder</th><th>security / election</th><th>preference</th><th>gross payout</th><th>cash at close</th><th>other / deferred</th><th>share</th></tr></thead><tbody>${rows.map((row) => {
    const holder = row.holder;
    const preferenceSecurity = ["preferred","safe","note"].includes(holder.securityType);
    const multiplier = preferenceSecurity ? ratchetMultiplier(holder) : 1;
    const share = total > 0 ? row.timing.entitlement / total : 0;
    const detail = preferenceSecurity ? `${waterfall.choiceById[holder.id]} · tier ${holder.seniority}${multiplier > 1.0001 ? ` · ${multiplier.toFixed(3)}× ratchet` : ""}` : ["option","warrant"].includes(holder.securityType) ? `${formatMoney(holder.strike)} strike` : "as-converted";
    return `<tr><td><strong>${escapeHtml(holder.name)}</strong><span class="subtext">${formatShares(holder.shares)} · ${Number(holder.eligiblePercent || 0).toFixed(0)}% eligible</span></td><td>${escapeHtml(labelForSecurity(holder.securityType))}<span class="subtext">${escapeHtml(detail)}</span></td><td class="money">${formatMoney(waterfall.preferencePaid[holder.id] || 0)}</td><td class="money">${formatMoney(row.timing.entitlement)}</td><td class="money">${formatMoney(row.timing.closingCash)}</td><td class="money">${formatMoney(row.deferred)}</td><td class="money">${formatPercent(share)}<div class="allocation-meter" aria-hidden="true"><span style="width:${Math.min(100, share * 100)}%"></span></div></td></tr>`;
  }).join("")}</tbody><tfoot><tr><td>total</td><td></td><td>${formatMoney(preferenceTotal)}</td><td>${formatMoney(total)}</td><td>${formatMoney(rows.reduce((sum,row)=>sum+row.timing.closingCash,0))}</td><td>${formatMoney(rows.reduce((sum,row)=>sum+row.deferred,0))}</td><td>100.00%</td></tr></tfoot></table></div></section>`;
}

function renderDialogs() {
  const { waterfall } = calculateModel();
  const activePrefs = state.stakeholders.filter((holder) => ["preferred","safe","note"].includes(holder.securityType) && (number(holder.preferenceMultiple) > 0 || number(holder.secondaryPreferenceMultiple) > 0 || number(holder.accruedDividend) > 0 || number(holder.dividendRate) > 0));
  const tiers = [...new Set(activePrefs.map((holder) => number(holder.seniority)))].sort((a,b)=>a-b);
  methodsContent.innerHTML = `<div class="explainers">
    ${explainer("Enterprise-to-equity bridge", "Enterprise value plus available cash, less debt, debt-like items, seller expenses, carve-outs and taxes, plus working-capital and other agreed adjustments. Incremental contingent tranches are then added to gross waterfall value.")}
    ${explainer("Priority and pari passu", tiers.length ? `Active preference tiers: ${tiers.join(", ")}. Tier 1 pays first; claims sharing a tier split an underfunded pool pro rata by claim amount.` : "No liquidation preference claim is active. Eligible common equivalents share residual value.")}
    ${explainer("Conversion elections", waterfall.stableElection ? "The solver evaluates up to 4,096 preference and conversion combinations for 12 elective classes. A class takes preference when conversion would not improve its payout with the other elections held fixed." : "No stable election set was found. Review the displayed lowest-regret set against the transaction documents.")}
    ${explainer("Participation, caps and split claims", "Non-participating preferred chooses preference or conversion. Fully participating preferred receives its claim and residual participation. Capped participation stops at the selected multiple. A class may split claims across two priority tiers.")}
    ${explainer("Ratchets and dividends", "Full ratchet resets the conversion price to the down-round price. Weighted average uses CP2 = CP1 × (A + B) / (A + C). Fixed, simple or compounded cumulative dividends can increase preference; prior payments and waivers reduce it.")}
    ${explainer("Options, warrants and vesting", "Eligible options and warrants receive the positive spread between implied common value and strike. The eligible percentage can model vesting, acceleration, forfeiture or a negotiated cash-out subset.")}
    ${explainer("Consideration timing", "Stock, escrow, notes, earnouts and rollover replace cash at close for eligible holders. Probability and timing drive expected present value. Incremental tranches add to total proceeds; included tranches only change form or timing.")}
    ${explainer("Calculation boundary", "Ask deal counsel and tax advisers to model withholding, appraisal rights, election proration, collars, charter interpretation and enforceability.")}
  </div><p class="disclaimer">Illustrative modeling only. Confirm each mechanic against the charter, financing documents, equity plan, merger agreement and final closing funds-flow memorandum.</p>`;

  const sources = [...(state.meta?.sources || []), ...GENERAL_SOURCES];
  sourcesContent.innerHTML = `<div class="explainers">${state.meta?.asOf ? explainer("Preset dating", escapeHtml(state.meta.asOf)) : ""}${sources.map((source) => `<div class="explainer"><h3><a href="${escapeAttribute(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.label)} ↗</a></h3><p>${escapeHtml(source.note)}</p></div>`).join("")}</div><p class="disclaimer">Public facts and modeled transaction inputs are labeled separately. Market references are historical snapshots. Use current data for valuation decisions.</p>`;
}

function explainer(title, body) {
  return `<div class="explainer"><h3>${escapeHtml(title)}</h3><p>${body}</p></div>`;
}

function buildWarnings(bridge, waterfall, consideration) {
  const warnings = [];
  if (bridge.rawEquityValue < 0) warnings.push({ tone: "danger", text: "Bridge deductions exceed enterprise value plus available cash; distributable equity is floored at zero." });
  if (waterfall.unallocated > 1) warnings.push({ tone: "danger", text: `${formatMoney(waterfall.unallocated)} remains unallocated because no eligible security can receive it.` });
  waterfall.warnings.forEach((text) => warnings.push({ tone: "danger", text }));
  consideration.warnings.forEach((text) => warnings.push({ text }));
  const ids = state.stakeholders.map((holder) => holder.id);
  if (new Set(ids).size !== ids.length) warnings.push({ tone: "danger", text: "Stakeholder IDs must be unique." });
  state.stakeholders.filter((holder) => ["preferred","safe","note"].includes(holder.securityType) && holder.ratchetType !== "none").forEach((holder) => {
    const multiplier = ratchetMultiplier(holder);
    if (multiplier > 1.0001) warnings.push({ text: `${holder.name} anti-dilution increases as-converted shares by ${multiplier.toFixed(3)}×.` });
  });
  return warnings;
}

function inputField({ label, value, inputType, scope, field, wide = false }) {
  const display = ["money","shares"].includes(inputType) ? compactInput(value) : String(value ?? "");
  return `<label class="field ${wide ? "wide" : ""}"><span>${escapeHtml(label)}</span><input type="text" inputmode="${inputType === "text" ? "text" : "decimal"}" value="${escapeAttribute(display)}" data-scope="${scope}" data-field="${field}" data-value-type="${inputType}"></label>`;
}

function indexedField(index, scope, field, label, value, inputType, wide = false) {
  const display = ["money","shares"].includes(inputType) ? compactInput(value) : String(value ?? "");
  return `<label class="field ${wide ? "wide" : ""}"><span>${escapeHtml(label)}</span><input type="text" inputmode="${inputType === "text" ? "text" : "decimal"}" value="${escapeAttribute(display)}" data-scope="${scope}" data-index="${index}" data-field="${field}" data-value-type="${inputType}"></label>`;
}

function selectField(index, scope, field, label, value, options) {
  return `<label class="field"><span>${escapeHtml(label)}</span><select data-scope="${scope}" data-index="${index}" data-field="${field}" data-value-type="select">${options.map(([optionValue, optionLabel]) => `<option value="${escapeAttribute(optionValue)}" ${optionValue === value ? "selected" : ""}>${escapeHtml(optionLabel)}</option>`).join("")}</select></label>`;
}

function checkboxField(index, field, label, checked) {
  return `<label class="check-field"><input type="checkbox" data-scope="stakeholder" data-index="${index}" data-field="${field}" data-value-type="boolean" ${checked ? "checked" : ""}><span>${escapeHtml(label)}</span></label>`;
}

function metric(label, value, primary = false) {
  return `<div class="metric ${primary ? "primary" : ""}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function updateStateFromControl(target) {
  const { scope, field, valueType, index } = target.dataset;
  if (!scope || !field) return false;
  let value = target.value;
  if (valueType === "boolean") value = target.checked;
  else if (["money","shares","number","percent"].includes(valueType)) value = parseCompact(value);
  if (scope === "deal") state.deal[field] = value;
  if (scope === "tranche") state.tranches[number(index)][field] = value;
  if (scope === "stakeholder") state.stakeholders[number(index)][field] = value;
  state.meta = { ...(state.meta || {}), preset: "custom", title: "Custom model", description: "Edited transaction model" };
  renderResults();
  renderDialogs();
  saveState();
  return true;
}

controls.addEventListener("input", (event) => {
  if (event.target.matches("select, input[type='checkbox']")) return;
  updateStateFromControl(event.target);
});

controls.addEventListener("change", (event) => {
  if (!event.target.matches("select, input[type='checkbox']")) return;
  if (updateStateFromControl(event.target)) renderControls();
});

controls.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const index = number(button.dataset.index);
  if (button.dataset.action === "add-stakeholder") state.stakeholders.push(blankStakeholder(uniqueId("holder")));
  if (button.dataset.action === "remove-stakeholder") state.stakeholders.splice(index, 1);
  if (button.dataset.action === "add-tranche") state.tranches.push(blankTranche(uniqueId("tranche")));
  if (button.dataset.action === "remove-tranche") state.tranches.splice(index, 1);
  state.meta = { ...(state.meta || {}), preset: "custom", title: "Custom model", description: "Edited transaction model" };
  renderAll();
});

document.querySelector(".input-tabs").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-tab]");
  if (!button) return;
  activeInputTab = button.dataset.tab;
  document.querySelectorAll(".input-tab").forEach((tab) => tab.classList.toggle("active", tab === button));
  renderControls();
});

presetSelect.addEventListener("change", () => { state = clonePreset(presetSelect.value); renderAll(); });
document.querySelector("#reset-button").addEventListener("click", () => { const preset = state.meta?.preset in PRESETS ? state.meta.preset : presetSelect.value; state = clonePreset(preset); renderAll(); });
document.querySelector("#methods-button").addEventListener("click", () => methodsDialog.showModal());
document.querySelector("#sources-button").addEventListener("click", () => sourcesDialog.showModal());

document.querySelector("#export-button").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${slugify(state.deal.name || "exit-waterfall")}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
});

document.querySelector("#import-button").addEventListener("click", () => importFile.click());
importFile.addEventListener("change", async () => {
  const file = importFile.files?.[0];
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    if (!imported?.deal || !Array.isArray(imported.stakeholders) || !Array.isArray(imported.tranches)) throw new Error("Invalid model");
    state = imported;
    state.meta = { ...(state.meta || {}), preset: "custom", title: state.meta?.title || "Imported model" };
    renderAll();
  } catch {
    window.alert("That file is not a valid exit-waterfall model.");
  } finally {
    importFile.value = "";
  }
});

function countActiveTranches() { return state.tranches.filter((tranche) => number(tranche.amount) > 0).length; }
function incrementalConsideration() { return state.tranches.reduce((sum, tranche) => sum + (tranche.treatment === "incremental" ? Math.max(0, number(tranche.amount)) : 0), 0); }
function uniqueId(prefix) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }
function number(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }

function parseCompact(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const match = String(value).trim().toLowerCase().replace(/[,$%×\s]/g, "").match(/^(-?(?:\d+\.?\d*|\.\d+))([kmbt])?$/);
  if (!match) return 0;
  return number(match[1]) * ({ k: 1e3, m: 1e6, b: 1e9, t: 1e12 }[match[2]] || 1);
}

function compactInput(value) {
  const amount = number(value);
  for (const [threshold, suffix] of [[1e12,"t"],[1e9,"b"],[1e6,"m"],[1e3,"k"]]) if (Math.abs(amount) >= threshold && Math.abs(amount / threshold) < 10000) return `${trimZeros(amount / threshold)}${suffix}`;
  return trimZeros(amount);
}

function formatMoney(value) {
  const amount = number(value);
  const sign = amount < 0 ? "−" : "";
  const abs = Math.abs(amount);
  for (const [threshold, suffix] of [[1e12,"T"],[1e9,"B"],[1e6,"M"],[1e3,"K"]]) if (abs >= threshold) return `${sign}$${trimZeros(abs / threshold, abs / threshold < 10 ? 2 : 1)}${suffix}`;
  return `${sign}$${Math.round(abs).toLocaleString()}`;
}

function formatShares(value) {
  const amount = number(value);
  if (Math.abs(amount) >= 1e9) return `${trimZeros(amount / 1e9, 2)}B shares`;
  if (Math.abs(amount) >= 1e6) return `${trimZeros(amount / 1e6, 2)}M shares`;
  if (Math.abs(amount) >= 1e3) return `${trimZeros(amount / 1e3, 1)}K shares`;
  return `${Math.round(amount).toLocaleString()} shares`;
}

function formatPercent(value) { return `${(number(value) * 100).toFixed(2)}%`; }
function trimZeros(value, digits = 4) { return number(value).toFixed(digits).replace(/\.?0+$/, ""); }
function labelForSecurity(value) { return { common:"Common stock", preferred:"Preferred stock", safe:"SAFE", note:"Convertible note", rsu:"RSU / restricted stock", option:"Option", warrant:"Warrant" }[value] || value; }
function labelForType(value) { return { stock:"Buyer stock", escrow:"Escrow / holdback", note:"Seller note", earnout:"Earnout", rollover:"Rollover equity", other:"Other" }[value] || value; }
function slugify(value) { return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "exit-waterfall"; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[character])); }
function escapeAttribute(value) { return escapeHtml(value).replace(/`/g, "&#96;"); }

function updateClock() {
  document.querySelector("#clock").textContent = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date());
}
updateClock();
setInterval(updateClock, 1000);

if (matchMedia("(prefers-reduced-motion: no-preference)").matches && matchMedia("(pointer: fine)").matches) {
  document.documentElement.classList.add("has-dot");
  const dot = document.querySelector(".dot-cur");
  addEventListener("pointermove", (event) => { dot.style.transform = `translate3d(${event.clientX}px,${event.clientY}px,0)`; });
  addEventListener("pointerover", (event) => { if (event.target.closest("a,button,summary,input,select")) document.body.classList.add("hoverable"); });
  addEventListener("pointerout", () => document.body.classList.remove("hoverable"));
}

renderAll();
