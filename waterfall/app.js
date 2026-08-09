import { applySharedTerms, comparisonBarWidth, computeAnnualizedIrr, computeEquityBridge, computeExitModel, computeInvestorAttribution, computePeopleCohortOutcome, ratchetMultiplier } from "./waterfall-engine.js?v=22";
import { PRESETS, applySecurityTypeDefaults, blankPeopleCohort, blankStakeholder, blankTranche, clonePreset } from "./presets.js?v=22";

const STORAGE_KEY = "tiki-exit-waterfall-v22";
const controls = document.querySelector("#controls");
const resultsContent = document.querySelector("#results-content");
const presetSelect = document.querySelector("#preset-select");
const importFile = document.querySelector("#import-file");
const methodsDialog = document.querySelector("#methods-dialog");
const sourcesDialog = document.querySelector("#sources-dialog");
const methodsContent = document.querySelector("#methods-content");
const sourcesContent = document.querySelector("#sources-content");
const workspace = document.querySelector(".workspace");
const inputsPanel = document.querySelector("#inputs");
const resultsPanel = document.querySelector("#results");
const mobileWorkspaceQuery = matchMedia("(max-width: 960px)");

const GENERAL_SOURCES = [
  { label: "Wilson Sonsini: venture financing fundamentals", url: "https://www.wsgr.com/email/college-for-clients-series/2024/VC-Financing/PPT-2024-C4C-VC-Financing-Fundamentals.pdf", note: "Liquidation preference, participation, conversion and anti-dilution mechanics." },
  { label: "Y Combinator: SAFE user guide", url: "https://bookface-static.ycombinator.com/assets/ycdc/SAFE%20User%20Guide-a47c6588327d73aa2799e61ed7c2cae9f1a0ee9acfa9c43b62039dc06e715832.pdf", note: "SAFE capitalization and liquidity-event treatment." },
  { label: "NVCA: model legal documents", url: "https://nvca.org/model-legal-documents/", note: "Venture financing document framework." },
  { label: "SRS Acquiom: 2026 M&A deal terms study", url: "https://www.srsacquiom.com/our-insights/deal-terms-study/", note: "Research across more than 2,300 private-target acquisitions informs the modeled transaction assumptions." },
  { label: "SRS Acquiom: escrow and payments trends", url: "https://www.srsacquiom.com/our-insights/ma-escrows-and-payments/", note: "Market reference for RWI retention size, general escrow size and typical 12–18 month duration." },
  { label: "SRS Acquiom: working-capital PPA trends", url: "https://www.srsacquiom.com/our-insights/ma-deals/", note: "Market reference for purchase-price-adjustment prevalence and the roughly 1% median separate PPA escrow." },
  { label: "SEC-filed updated distribution waterfall", url: "https://www.sec.gov/Archives/edgar/data/1636422/000163642225000028/exhibit21agreementandplano.htm", note: "Primary-source example using an updated cumulative waterfall for adjustments and earnouts, but fixed closing-payment shares for escrow and representative-fund releases." },
  { label: "SEC-filed preferred-stock charter", url: "https://www.sec.gov/Archives/edgar/data/830656/000083065611000006/ex3-1.pdf", note: "Primary-source example of preferred series sharing an underfunded pari passu tier ahead of common stock." },
];

let state = normalizeState(loadSavedState() || clonePreset("airtable"));
let activeInputTab = "deal";
let activeResultTab = "investors";
let calculationCacheKey = "";
let calculationCacheValue = null;

const SERIES_OPTIONS = [
  ["common", "Common / founders"], ["formation", "Formation"], ["pre-seed", "Pre-seed"], ["seed", "Seed"],
  ["series-a", "Series A"], ["series-b", "Series B"], ["series-c", "Series C"], ["series-d", "Series D"],
  ["series-e", "Series E"], ["series-f", "Series F"], ["series-g", "Series G"], ["series-h", "Series H"],
  ["series-i", "Series I"], ["series-j", "Series J"], ["growth", "Growth / crossover"], ["other", "Other"],
];

const SENIORITY_OPTIONS = [
  ["1", "1 · first paid"], ["2", "2"], ["3", "3"], ["4", "4"], ["5", "5"],
  ["6", "6"], ["7", "7"], ["8", "8"], ["9", "9"], ["10", "10"], ["11", "11"], ["12", "12 · last paid"],
];

const dealFields = [
  ["name", "Company / transaction", "text", true],
  ["enterpriseValue", "Enterprise value", "money"],
  ["cash", "Cash and investments", "money"],
  ["debt", "Debt payoff", "money"],
  ["debtLike", "Debt-like items", "money"],
  ["workingCapital", "Working-capital adjustment", "money"],
  ["transactionFees", "Transaction expenses", "money"],
  ["bonuses", "Seller-funded management carveout", "money"],
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

function normalizeState(model) {
  const defaults = clonePreset("clean").terms;
  const holderDefaults = blankStakeholder("defaults");
  const stakeholderIds = new Set();
  const stakeholders = (model.stakeholders || []).map((holder) => {
    const id = ensureUniqueId(holder.id, "holder", stakeholderIds);
    return {
      ...holderDefaults,
      ...holder,
      id,
      series: holder.series || inferSeries(holder),
      roundSize: number(holder.roundSize ?? holder.invested),
      investorInvestment: number(holder.investorInvestment ?? holder.roundSize ?? holder.invested),
      invested: number(holder.invested ?? holder.roundSize),
      useSharedTerms: holder.useSharedTerms !== false,
      preferenceEnabled: holder.preferenceEnabled ?? number(holder.preferenceMultiple) > 0,
      optimalConversion: holder.optimalConversion !== false,
      participatingPreferred: holder.participatingPreferred ?? ["full", "capped"].includes(holder.participation),
      cappedParticipation: holder.cappedParticipation ?? holder.participation === "capped",
      cumulativeDividends: holder.cumulativeDividends ?? (holder.dividendType && holder.dividendType !== "none"),
      antiDilution: holder.antiDilution ?? (holder.ratchetType && holder.ratchetType !== "none"),
    };
  });
  const cohortIds = new Set();
  const peopleCohorts = (model.peopleCohorts || []).map((cohort) => {
    const id = ensureUniqueId(cohort.id, "cohort", cohortIds);
    return {
      ...blankPeopleCohort(id),
      ...cohort,
      id,
      exercisedPercent: cohort.exercisedPercent ?? (cohort.alreadyExercised === true ? 100 : 0),
      recoveryFloorMultiple: number(cohort.recoveryFloorMultiple),
    };
  });
  const trancheIds = new Set();
  const tranches = (model.tranches || []).map((tranche) => {
    const id = ensureUniqueId(tranche.id, "tranche", trancheIds);
    return {
      ...blankTranche(id),
      ...tranche,
      id,
      allocationBasis: ["cumulative", "pro-rata"].includes(tranche.allocationBasis)
        ? tranche.allocationBasis
        : (tranche.type === "earnout" || tranche.treatment === "incremental" ? "cumulative" : "pro-rata"),
      expectedPercent: tranche.expectedPercent ?? 100,
      years: number(tranche.years),
    };
  });
  const savedPreset = model.meta?.preset;
  const basePreset = model.meta?.basePreset in PRESETS
    ? model.meta.basePreset
    : (savedPreset in PRESETS ? savedPreset : "airtable");
  return {
    ...model,
    meta: { ...(model.meta || {}), basePreset },
    stakeholders,
    tranches,
    peopleCohorts,
    terms: { ...defaults, ...(model.terms || {}) },
  };
}

function renderAll() {
  presetSelect.value = state.meta?.preset in PRESETS ? state.meta.preset : state.meta?.basePreset || "airtable";
  document.querySelectorAll(".input-tab").forEach((button) => {
    const active = button.dataset.tab === activeInputTab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  });
  renderControls();
  renderResults();
  saveState();
}

function renderControls() {
  if (activeInputTab === "deal") controls.innerHTML = renderDealControls();
  if (activeInputTab === "stakeholders") controls.innerHTML = renderStakeholderControls();
  if (activeInputTab === "consideration") controls.innerHTML = renderConsiderationControls();
  if (activeInputTab === "people") controls.innerHTML = renderPeopleControls();
}

function renderDealControls() {
  const bridge = computeEquityBridge(state.deal);
  const core = dealFields.slice(0, 4);
  const advanced = dealFields.slice(4);
  return `
    <div class="panel-heading"><div><span class="kicker">purchase price</span><h2>Deal bridge</h2></div><span class="panel-total">${formatMoney(bridge.equityValue)}</span></div>
    <p class="panel-note">Start with enterprise value, then bridge to the value available for the security waterfall.</p>
    <div class="form-grid">${core.map(renderDealField).join("")}</div>
    <details class="subsection" open>
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
    <p class="panel-note">Add one row per financing class. Preference basis drives the class claim; financing round size is context, while the modeled check attributes an investor's proportional return.</p>
    ${renderSharedTerms()}
    ${renderEditorTools("security rows")}
    ${state.stakeholders.map(renderStakeholderEditor).join("")}
    <button class="button add-row" type="button" data-action="add-stakeholder">add investor round</button>`;
}

function renderSharedTerms() {
  const terms = state.terms;
  const pariNote = usesPreset("airtable")
    ? (terms.pariPassu
      ? "This Airtable preset enables pari passu because the filing-derived charter terms support it. The round-based seniority selections are the fallback if pari passu is turned off."
      : "Pari passu is off, so the Airtable fallback stack applies from Series F first through Seed last.")
    : (terms.pariPassu ? "This scenario explicitly enables pari passu." : "Pari passu is off unless selected.");
  const impactNote = describePariImpact();
  return `<section class="shared-terms" aria-labelledby="shared-terms-title">
    <header class="shared-terms-heading"><div><span class="kicker">blanket settings</span><h3 id="shared-terms-title">Shared transaction terms</h3></div><span>preferred equity + eligibility</span></header>
    <div class="shared-checks">
      ${booleanField("terms", "liquidationPreference", "Enable liquidation preference", terms.liquidationPreference)}
      ${booleanField("terms", "pariPassu", "Pari passu across preferred stock classes", terms.pariPassu, !terms.liquidationPreference)}
      ${booleanField("terms", "optimalConversion", "Use financially optimal conversion", terms.optimalConversion, !terms.liquidationPreference)}
      ${booleanField("terms", "participatingPreferred", "Participating preferred", terms.participatingPreferred, !terms.liquidationPreference)}
      ${booleanField("terms", "cappedParticipation", "Cap participation", terms.cappedParticipation, !terms.liquidationPreference || !terms.participatingPreferred)}
      ${booleanField("terms", "cumulativeDividends", "Cumulative dividends", terms.cumulativeDividends, !terms.liquidationPreference)}
      ${booleanField("terms", "dividendsCountTowardCap", "Paid dividends count toward participation cap", terms.dividendsCountTowardCap, !terms.cumulativeDividends || !terms.cappedParticipation)}
      ${booleanField("terms", "antiDilution", "Anti-dilution ratchet", terms.antiDilution)}
      ${booleanField("terms", "escrowEligibleAll", "All holders share escrows / holdbacks", terms.escrowEligibleAll)}
      ${booleanField("terms", "deferredEligibleAll", "All holders share deferred consideration", terms.deferredEligibleAll)}
    </div>
    <div class="form-grid shared-term-values">
      ${terms.liquidationPreference ? inputField({ label: "Preference multiple", value: terms.preferenceMultiple, inputType: "number", scope: "terms", field: "preferenceMultiple" }) : ""}
      ${terms.liquidationPreference && terms.participatingPreferred && terms.cappedParticipation ? inputField({ label: "Participation cap", value: terms.participationCap, inputType: "number", scope: "terms", field: "participationCap" }) : ""}
      ${terms.liquidationPreference && terms.cumulativeDividends ? selectSimpleField("terms", "dividendType", "Dividend method", terms.dividendType, [["fixed","Fixed accrued"],["simple","Simple annual"],["compound","Compound annual"]]) : ""}
      ${terms.liquidationPreference && terms.cumulativeDividends && terms.dividendType === "fixed" ? inputField({ label: "Accrued dividend", value: terms.accruedDividend, inputType: "money", scope: "terms", field: "accruedDividend" }) : ""}
      ${terms.liquidationPreference && terms.cumulativeDividends && ["simple","compound"].includes(terms.dividendType) ? inputField({ label: "Dividend rate", value: terms.dividendRate, inputType: "percent", scope: "terms", field: "dividendRate" }) : ""}
      ${terms.liquidationPreference && terms.cumulativeDividends && ["simple","compound"].includes(terms.dividendType) ? inputField({ label: "Accrual years", value: terms.dividendYears, inputType: "number", scope: "terms", field: "dividendYears" }) : ""}
      ${terms.liquidationPreference && terms.cumulativeDividends ? inputField({ label: "Dividends already paid", value: terms.paidDividends, inputType: "money", scope: "terms", field: "paidDividends" }) : ""}
      ${terms.liquidationPreference && terms.cumulativeDividends && terms.dividendType === "compound" ? inputField({ label: "Compounding periods / year", value: terms.dividendPeriods, inputType: "number", scope: "terms", field: "dividendPeriods" }) : ""}
      ${terms.antiDilution ? selectSimpleField("terms", "ratchetType", "Ratchet method", terms.ratchetType, [["full-ratchet","Full ratchet"],["weighted-average","Weighted average"],["custom","Custom multiplier"]]) : ""}
      ${terms.antiDilution && terms.ratchetType !== "custom" ? inputField({ label: "Original conversion price", value: terms.originalPrice, inputType: "number", scope: "terms", field: "originalPrice" }) : ""}
      ${terms.antiDilution && terms.ratchetType !== "custom" ? inputField({ label: "Down-round price", value: terms.downRoundPrice, inputType: "number", scope: "terms", field: "downRoundPrice" }) : ""}
      ${terms.antiDilution && terms.ratchetType === "weighted-average" ? inputField({ label: "Pre-round cap (A)", value: terms.preRoundShares, inputType: "shares", scope: "terms", field: "preRoundShares" }) : ""}
      ${terms.antiDilution && terms.ratchetType === "weighted-average" ? inputField({ label: "Down-round new money", value: terms.newMoney, inputType: "money", scope: "terms", field: "newMoney" }) : ""}
      ${terms.antiDilution && terms.ratchetType === "custom" ? inputField({ label: "Share multiplier", value: terms.conversionMultiplier, inputType: "number", scope: "terms", field: "conversionMultiplier" }) : ""}
    </div>
    <p class="shared-terms-note">Universal preference terms apply to preferred stock classes, not common or outstanding notes. Standard SAFEs retain their contractual claim and rank alongside preferred when pari passu is selected. Notes retain their individual debt-senior terms. ${pariNote}${impactNote ? ` ${impactNote}` : ""}</p>
  </section>`;
}

function describePariImpact() {
  const sharedPreferred = state.stakeholders.filter((holder) => holder.useSharedTerms !== false && holder.securityType === "preferred");
  if (!state.terms.liquidationPreference || sharedPreferred.length < 2 || sharedPreferred.length > 12) return "";
  const current = calculateModel();
  const alternative = computeExitModel({ ...state, terms: { ...state.terms, pariPassu: !state.terms.pariPassu } });
  const reallocated = sharedPreferred.reduce((sum, holder) => (
    sum + Math.abs(number(current.waterfall.payouts[holder.id]) - number(alternative.waterfall.payouts[holder.id]))
  ), 0) / 2;
  if (reallocated <= .01) return `At the current ${formatMoney(current.grossProceeds)} waterfall value, this switch does not change payouts because the active preference claims are fully funded or the selected tiers are economically equivalent.`;
  return `At the current waterfall value, switching pari passu ${state.terms.pariPassu ? "off" : "on"} reallocates ${formatMoney(reallocated)} among preferred classes.`;
}

function renderConsiderationControls() {
  return `
    <div class="panel-heading"><div><span class="kicker">form & timing</span><h2>Consideration</h2></div><span class="panel-total">${countActiveTranches()} active</span></div>
    <p class="panel-note">Leave every amount at zero for a clean cash acquisition. Incremental tranches add to bridge equity value.</p>
    ${renderEditorTools("consideration rows")}
    ${state.tranches.map(renderTrancheEditor).join("")}
    <button class="button add-row" type="button" data-action="add-tranche">add consideration tranche</button>`;
}

function renderTrancheEditor(tranche, index) {
  return `
    <details class="editor-row" open>
      <summary class="editor-summary"><span class="editor-summary-main"><strong>${escapeHtml(tranche.label)}</strong><span>${escapeHtml(labelForType(tranche.type))} · ${tranche.treatment === "incremental" ? "incremental" : "included"}</span></span><span class="editor-amount">${formatMoney(tranche.amount)}</span></summary>
      <div class="editor-body"><div class="form-grid">
        ${indexedField(index, "tranche", "label", "Label", tranche.label, "text", true)}
        ${indexedField(index, "tranche", "amount", "Face amount", tranche.amount, "money")}
        ${selectField(index, "tranche", "type", "Form", tranche.type, [["stock","Buyer stock"],["escrow","Escrow / holdback"],["note","Seller note"],["earnout","Earnout"],["rollover","Rollover equity"],["other","Other"]])}
        ${selectField(index, "tranche", "treatment", "Price treatment", tranche.treatment || "included", [["included","Included in bridge"],["incremental","Incremental to bridge"]])}
        ${selectField(index, "tranche", "allocationBasis", "Allocation basis", tranche.allocationBasis || "pro-rata", [["pro-rata","Closing pro rata"],["cumulative","Cumulative waterfall"]])}
        ${selectField(index, "tranche", "eligibility", "Eligible holders", tranche.eligibility, [["all","All holders"],["escrow","Escrow-eligible"],["deferred","Deferred-eligible"]])}
        ${indexedField(index, "tranche", "expectedPercent", "Expected realization", tranche.expectedPercent, "percent")}
        ${indexedField(index, "tranche", "years", "Timing (years)", tranche.years, "number")}
      </div><div class="editor-actions"><button class="button danger" type="button" data-action="remove-tranche" data-index="${index}">remove</button></div></div>
    </details>`;
}

function renderStakeholderEditor(holder, index) {
  const preferenceSecurity = ["preferred", "safe", "note"].includes(holder.securityType);
  const optionLike = ["option", "warrant"].includes(holder.securityType);
  const roundLabel = seriesLabel(holder.series);
  const parityApplies = holder.useSharedTerms !== false && state.terms.pariPassu === true && ["preferred", "safe"].includes(holder.securityType);
  const priorityLabel = parityApplies ? "pari passu" : `seniority ${number(holder.seniority) || "—"}`;
  const seniorityFieldLabel = parityApplies ? "Fallback seniority when pari passu is off" : "Seniority tier";
  return `
    <details class="editor-row" open>
      <summary class="editor-summary"><span class="editor-summary-main"><strong>${escapeHtml(holder.name)}</strong><span>${preferenceSecurity ? `${escapeHtml(roundLabel)} · ${escapeHtml(priorityLabel)} · ${formatMoney(holder.roundSize)} round` : `${escapeHtml(roundLabel)} · ${formatShares(holder.shares)}`}</span></span></summary>
      <div class="editor-body"><div class="form-grid">
        ${indexedField(index, "stakeholder", "name", "Stakeholder / class", holder.name, "text", true)}
        ${selectField(index, "stakeholder", "series", "Financing series", holder.series, SERIES_OPTIONS)}
        ${indexedField(index, "stakeholder", "className", "Share class / pool", holder.className || inferredClassName(holder), "text")}
        ${selectField(index, "stakeholder", "securityType", "Security", holder.securityType, [["common","Common stock"],["preferred","Preferred stock"],["safe","SAFE"],["note","Convertible note"],["rsu","RSU / restricted stock"],["option","Option"],["warrant","Warrant"]])}
        ${preferenceSecurity ? selectField(index, "stakeholder", "seniority", seniorityFieldLabel, String(holder.seniority || 1), SENIORITY_OPTIONS) : ""}
        ${indexedField(index, "stakeholder", "shares", "As-converted shares", holder.shares, "shares")}
        ${indexedField(index, "stakeholder", "eligiblePercent", "Vested / eligible", holder.eligiblePercent, "percent")}
        ${optionLike ? indexedField(index, "stakeholder", "strike", "Strike per share", holder.strike, "number") : ""}
        ${preferenceSecurity ? indexedField(index, "stakeholder", "invested", "Class preference basis", holder.invested, "money") : ""}
        ${preferenceSecurity ? indexedField(index, "stakeholder", "roundSize", "Financing round size", holder.roundSize, "money") : ""}
        ${preferenceSecurity ? indexedField(index, "stakeholder", "investorInvestment", "Investment amount", holder.investorInvestment, "money") : ""}
        ${preferenceSecurity ? indexedField(index, "stakeholder", "holdingPeriodYears", "Investment-to-exit years", holder.holdingPeriodYears, "number") : ""}
      </div>
      <div class="holder-terms">
        ${indexedBooleanField(index, "useSharedTerms", "Use universal transaction settings", holder.useSharedTerms)}
        ${holder.useSharedTerms ? `<p class="holder-terms-note">${escapeHtml(sharedTermsDescription(holder))}</p>` : renderIndividualTerms(holder, index, preferenceSecurity)}
      </div>
      <div class="editor-actions"><button class="button danger" type="button" data-action="remove-stakeholder" data-index="${index}">remove</button></div></div>
    </details>`;
}

function renderIndividualTerms(holder, index, preferenceSecurity) {
  const dividendType = ["fixed", "simple", "compound"].includes(holder.dividendType) ? holder.dividendType : "simple";
  const ratchetType = ["full-ratchet", "weighted-average", "custom"].includes(holder.ratchetType) ? holder.ratchetType : "weighted-average";
  return `<div class="individual-terms">
    <span class="individual-terms-label">individual override</span>
    <div class="shared-checks">
      ${preferenceSecurity ? indexedBooleanField(index, "preferenceEnabled", "Enable liquidation preference", holder.preferenceEnabled) : ""}
      ${preferenceSecurity ? indexedBooleanField(index, "participatingPreferred", "Participating preferred", holder.participatingPreferred, !holder.preferenceEnabled) : ""}
      ${preferenceSecurity ? indexedBooleanField(index, "cappedParticipation", "Cap participation", holder.cappedParticipation, !holder.preferenceEnabled || !holder.participatingPreferred) : ""}
      ${preferenceSecurity ? indexedBooleanField(index, "cumulativeDividends", "Cumulative dividends", holder.cumulativeDividends, !holder.preferenceEnabled) : ""}
      ${preferenceSecurity ? indexedBooleanField(index, "dividendsCountTowardCap", "Paid dividends count toward participation cap", holder.dividendsCountTowardCap, !holder.cumulativeDividends || !holder.cappedParticipation) : ""}
      ${preferenceSecurity ? indexedBooleanField(index, "antiDilution", "Anti-dilution ratchet", holder.antiDilution) : ""}
      ${indexedBooleanField(index, "escrowEligible", "Shares escrows / holdbacks", holder.escrowEligible)}
      ${indexedBooleanField(index, "deferredEligible", "Shares deferred consideration", holder.deferredEligible)}
    </div>
    ${preferenceSecurity ? `<div class="form-grid shared-term-values">
      ${holder.preferenceEnabled ? indexedField(index, "stakeholder", "preferenceMultiple", "Preference multiple", holder.preferenceMultiple ?? 1, "number") : ""}
      ${holder.preferenceEnabled ? selectField(index, "stakeholder", "conversionPolicy", "Conversion election", holder.conversionPolicy || (holder.optimalConversion !== false ? "elective" : "force-preference"), [["elective","Financially optimal"],["force-preference","Force preference"],["force-convert","Force conversion"]]) : ""}
      ${holder.preferenceEnabled ? indexedField(index, "stakeholder", "secondaryPreferenceMultiple", "Additional preference multiple", holder.secondaryPreferenceMultiple ?? 0, "number") : ""}
      ${holder.preferenceEnabled && number(holder.secondaryPreferenceMultiple) > 0 ? selectField(index, "stakeholder", "secondarySeniority", "Additional preference seniority", String(holder.secondarySeniority || holder.seniority || 1), SENIORITY_OPTIONS) : ""}
      ${holder.preferenceEnabled ? indexedField(index, "stakeholder", "priorDistributions", "Prior preference distributions", holder.priorDistributions ?? 0, "money") : ""}
      ${holder.preferenceEnabled ? indexedField(index, "stakeholder", "waiverPercent", "Preference waived", holder.waiverPercent ?? 0, "percent") : ""}
      ${holder.preferenceEnabled && holder.participatingPreferred && holder.cappedParticipation ? indexedField(index, "stakeholder", "capMultiple", "Participation cap", holder.capMultiple ?? 3, "number") : ""}
      ${holder.preferenceEnabled && holder.cumulativeDividends ? selectField(index, "stakeholder", "dividendType", "Dividend method", dividendType, [["fixed","Fixed accrued"],["simple","Simple annual"],["compound","Compound annual"]]) : ""}
      ${holder.preferenceEnabled && holder.cumulativeDividends && dividendType === "fixed" ? indexedField(index, "stakeholder", "accruedDividend", "Accrued dividend", holder.accruedDividend, "money") : ""}
      ${holder.preferenceEnabled && holder.cumulativeDividends && ["simple","compound"].includes(dividendType) ? indexedField(index, "stakeholder", "dividendRate", "Dividend rate", holder.dividendRate, "percent") : ""}
      ${holder.preferenceEnabled && holder.cumulativeDividends && ["simple","compound"].includes(dividendType) ? indexedField(index, "stakeholder", "dividendYears", "Accrual years", holder.dividendYears, "number") : ""}
      ${holder.preferenceEnabled && holder.cumulativeDividends ? indexedField(index, "stakeholder", "paidDividends", "Dividends already paid", holder.paidDividends ?? 0, "money") : ""}
      ${holder.preferenceEnabled && holder.cumulativeDividends && dividendType === "compound" ? indexedField(index, "stakeholder", "dividendPeriods", "Compounding periods / year", holder.dividendPeriods ?? 1, "number") : ""}
      ${holder.antiDilution ? selectField(index, "stakeholder", "ratchetType", "Ratchet method", ratchetType, [["full-ratchet","Full ratchet"],["weighted-average","Weighted average"],["custom","Custom multiplier"]]) : ""}
      ${holder.antiDilution && ratchetType !== "custom" ? indexedField(index, "stakeholder", "originalPrice", "Original conversion price", holder.originalPrice, "number") : ""}
      ${holder.antiDilution && ratchetType !== "custom" ? indexedField(index, "stakeholder", "downRoundPrice", "Down-round price", holder.downRoundPrice, "number") : ""}
      ${holder.antiDilution && ratchetType === "weighted-average" ? indexedField(index, "stakeholder", "preRoundShares", "Pre-round cap (A)", holder.preRoundShares, "shares") : ""}
      ${holder.antiDilution && ratchetType === "weighted-average" ? indexedField(index, "stakeholder", "newMoney", "Down-round new money", holder.newMoney, "money") : ""}
      ${holder.antiDilution && ratchetType === "custom" ? indexedField(index, "stakeholder", "conversionMultiplier", "Share multiplier", holder.conversionMultiplier, "number") : ""}
    </div>` : ""}
  </div>`;
}

function renderPeopleControls() {
  const isBrex = usesPreset("brex");
  const isAirtable = usesPreset("airtable");
  const presetLabel = isBrex ? "Brex base case" : (isAirtable ? "Airtable base case" : "Configurable case");
  const presetNote = isBrex
    ? "Brex's actual 409A and option ledger are not public. The strike and exercise schedule is an editable stage-based estimate; exercised shares receive a modeled 1× cost-recovery floor."
    : (isAirtable
      ? "Historical 409A marks anchor the strikes. The 2023+ example assumes 25% of vested options were exercised, and exercised shares receive a modeled 1× cost-recovery floor."
      : "Add only the employee entry cohorts needed for this transaction. Grant size, strike, exercise status, vesting and transaction protection are independently editable.");
  return `
    <div class="panel-heading"><div><span class="kicker">employee protection</span><h2>Employee cohorts</h2></div><span class="panel-total">${state.peopleCohorts.length} cohorts</span></div>
    <p class="panel-note">Founder ownership is modeled in Securities. These are normalized 100K-award scenarios, not employee population totals. Exercise status, vesting and transaction protection remain editable.</p>
    <div class="assumption-note"><strong>${presetLabel}</strong><span>${escapeHtml(presetNote)}</span></div>
    ${renderEditorTools("employee cohorts")}
    ${state.peopleCohorts.map(renderPeopleEditor).join("")}
    <button class="button add-row" type="button" data-action="add-cohort">add entry cohort</button>`;
}

function renderPeopleEditor(cohort, index) {
  return `<details class="editor-row" open>
    <summary class="editor-summary"><span class="editor-summary-main"><strong>${escapeHtml(cohort.label)}</strong><span>${escapeHtml(seriesLabel(cohort.entryStage))} · ${formatShares(cohort.grantShares)} · ${formatPrice(cohort.strike)} strike</span></span></summary>
    <div class="editor-body"><div class="form-grid">
      ${indexedField(index, "cohort", "label", "Cohort label", cohort.label, "text", true)}
      ${selectField(index, "cohort", "entryStage", "Entry stage", cohort.entryStage, SERIES_OPTIONS.filter(([value]) => value !== "common"))}
      ${selectField(index, "cohort", "equityType", "Equity type", cohort.equityType, [["common","Common stock"],["option","Employee options"]])}
      ${indexedField(index, "cohort", "grantShares", "Grant shares", cohort.grantShares, "shares")}
      ${indexedField(index, "cohort", "strike", cohort.equityType === "common" ? "Cost basis / share" : "Strike / share", cohort.strike, "number")}
      ${cohort.equityType === "option" ? indexedField(index, "cohort", "exercisedPercent", "Vested options exercised before close", cohort.exercisedPercent, "percent") : ""}
      ${cohort.equityType === "option" && number(cohort.exercisedPercent) > 0 ? indexedField(index, "cohort", "recoveryFloorMultiple", "Exercised-share recovery floor", cohort.recoveryFloorMultiple, "number") : ""}
      ${indexedField(index, "cohort", "eligiblePercent", "Vested at close", cohort.eligiblePercent, "percent")}
      ${indexedField(index, "cohort", "accelerationPercent", "Unvested shares accelerated", cohort.accelerationPercent, "percent")}
      ${indexedField(index, "cohort", "transactionBonus", "Closing / carveout bonus", cohort.transactionBonus, "money")}
      ${indexedField(index, "cohort", "retentionBonus", "Post-close retention bonus", cohort.retentionBonus, "money")}
      ${indexedField(index, "cohort", "retentionYears", "Retention payout years", cohort.retentionYears, "number")}
    </div><div class="editor-actions"><button class="button danger" type="button" data-action="remove-cohort" data-index="${index}">remove</button></div></div>
  </details>`;
}

function renderEditorTools(label) {
  return `<div class="editor-tools" aria-label="${escapeAttribute(label)} display controls"><button class="button" type="button" data-action="collapse-editors">collapse all</button><button class="button" type="button" data-action="expand-editors">expand all</button></div>`;
}

function calculateModel() {
  const key = JSON.stringify([state.deal, state.terms, state.stakeholders, state.tranches]);
  if (key !== calculationCacheKey) {
    calculationCacheKey = key;
    calculationCacheValue = computeExitModel(state);
  }
  return calculationCacheValue;
}

function ensureResultsShell() {
  if (resultsContent.querySelector(".result-layout")) return;
  resultsContent.innerHTML = `
    <header class="result-header" data-results-header></header>
    <div class="alerts" data-results-alerts hidden></div>
    <section class="metrics" aria-label="Transaction summary" data-results-metrics></section>
    <div class="result-layout">
      <nav class="result-tabs" role="tablist" aria-label="Exit outcome views">
        <button id="result-tab-investors" type="button" role="tab" data-result-tab="investors" aria-controls="result-outcome-chart result-outcome-detail" class="result-tab">investors</button>
        <button id="result-tab-people" type="button" role="tab" data-result-tab="people" aria-controls="result-outcome-chart result-outcome-detail" class="result-tab">founders &amp; employees</button>
      </nav>
      <div id="result-outcome-chart" class="result-tab-panel" role="tabpanel" data-result-panel></div>
      <div class="visual-grid" data-results-bridge></div>
      <div id="result-outcome-detail" class="result-tab-detail" role="region" data-result-panel></div>
    </div>`;
}

function updateResultTabState() {
  const activeTabId = `result-tab-${activeResultTab}`;
  resultsContent.querySelectorAll(".result-tab").forEach((tab) => {
    const active = tab.dataset.resultTab === activeResultTab;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  resultsContent.querySelectorAll("[data-result-panel]").forEach((panel) => panel.setAttribute("aria-labelledby", activeTabId));
}

function renderResults() {
  const model = calculateModel();
  const { bridge, incremental, grossProceeds, waterfall, consideration, rows } = model;
  const totalClosing = rows.reduce((sum, row) => sum + row.timing.closingCash, 0);
  const totalDeferred = rows.reduce((sum, row) => sum + row.deferred, 0);
  const totalExpected = rows.reduce((sum, row) => sum + row.timing.expectedPresentValue, 0);
  const warnings = buildWarnings(bridge, waterfall, consideration);
  const outcome = activeResultTab === "investors"
    ? renderInvestorOutcomes(rows, waterfall, grossProceeds)
    : renderPeopleOutcomes(rows, waterfall.pricePerShare);
  ensureResultsShell();
  resultsContent.querySelector("[data-results-header]").innerHTML = `<div><span class="kicker">transaction results</span><h2>${escapeHtml(state.deal.name || "Untitled transaction")}</h2><p>${escapeHtml(state.meta?.description || "Custom transaction model")}</p></div>`;
  const alerts = resultsContent.querySelector("[data-results-alerts]");
  alerts.innerHTML = warnings.map((warning) => `<div class="alert ${warning.tone || ""}">${escapeHtml(warning.text)}</div>`).join("");
  alerts.hidden = warnings.length === 0;
  resultsContent.querySelector("[data-results-metrics]").innerHTML = `
    ${metric("gross waterfall value", formatMoney(grossProceeds), true)}
    ${metric("cash at close", formatMoney(totalClosing))}
    ${metric("non-cash / deferred", formatMoney(totalDeferred))}
    ${metric("expected present value", formatMoney(totalExpected))}
    ${number(consideration.unallocated) > .01 ? metric("unallocated consideration", formatMoney(consideration.unallocated)) : ""}`;
  resultsContent.querySelector("[data-results-bridge]").innerHTML = renderBridgeChart(bridge, incremental, grossProceeds);
  resultsContent.querySelector("#result-outcome-chart").innerHTML = outcome.chartHtml;
  resultsContent.querySelector("#result-outcome-detail").innerHTML = outcome.detailHtml;
  updateResultTabState();
  document.querySelector("#results-status").textContent = `${state.deal.name || "Transaction"}: ${formatMoney(grossProceeds)} gross waterfall value; ${formatMoney(totalExpected)} expected present value.`;
}

function renderBridgeChart(bridge, incremental, grossProceeds) {
  const deal = state.deal;
  const adjustments = [
    { label: "Cash and investments", value: number(deal.cash) },
    { label: "Debt and debt-like items", value: -(number(deal.debt) + number(deal.debtLike)) },
    { label: "Working capital", value: number(deal.workingCapital) },
    { label: "Fees, bonuses and taxes", value: -(number(deal.transactionFees) + number(deal.bonuses) + number(deal.transferTaxes)) },
    { label: "Other adjustment", value: number(deal.otherAdjustment) },
  ].filter((item) => Math.abs(item.value) >= .01);
  const netAdjustment = adjustments.reduce((sum, item) => sum + item.value, 0);
  const netOperator = netAdjustment < 0 ? "−" : "+";
  const netDisplay = formatMoney(Math.abs(netAdjustment));
  const adjustmentRows = adjustments.length
    ? adjustments.map((item) => `<div class="bridge-adjustment"><span>${escapeHtml(item.label)}</span><strong class="${item.value < 0 ? "negative" : "positive"}">${escapeHtml(formatSignedMoney(item.value))}</strong></div>`).join("")
    : `<div class="bridge-adjustment empty"><span>No bridge adjustments</span><strong>$0</strong></div>`;
  const aria = `Enterprise value ${formatMoney(deal.enterpriseValue)}, net adjustments ${formatSignedMoney(netAdjustment)}, equity value ${formatMoney(bridge.equityValue)}${incremental > 0 ? `, plus ${formatMoney(incremental)} incremental consideration, gross waterfall value ${formatMoney(grossProceeds)}` : ""}.`;
  const contingent = incremental > 0 ? `<div class="contingent-strip"><span>Equity value <strong>${formatMoney(bridge.equityValue)}</strong></span><span class="equation-sign">+</span><span>Incremental consideration <strong>${formatMoney(incremental)}</strong></span><span class="equation-sign">=</span><span>Gross waterfall value <strong>${formatMoney(grossProceeds)}</strong></span></div>` : "";
  return `<section class="viz-panel bridge-panel" aria-labelledby="bridge-chart-title"><div class="viz-heading"><div><span class="section-label">purchase price bridge</span><h3 id="bridge-chart-title">Enterprise value to equity value</h3></div><p>EV + cash − debt ± adjustments</p></div><div class="bridge-equation" role="img" aria-label="${escapeAttribute(aria)}"><div class="bridge-node"><span>enterprise value</span><strong>${formatMoney(deal.enterpriseValue)}</strong></div><div class="bridge-operator" aria-hidden="true">${netOperator}</div><div class="bridge-adjustments"><header><span>net adjustments</span><strong class="${netAdjustment < 0 ? "negative" : "positive"}">${netDisplay}</strong></header>${adjustmentRows}</div><div class="bridge-operator" aria-hidden="true">=</div><div class="bridge-node final"><span>equity value</span><strong>${formatMoney(bridge.equityValue)}</strong></div></div>${contingent}</section>`;
}

function renderInvestorOutcomes(rows, waterfall, total) {
  const investors = rows.filter(({ holder }) => ["preferred", "safe", "note"].includes(holder.securityType) || number(holder.investorInvestment) > 0).map((row) => {
    const attribution = computeInvestorAttribution(row.holder, row.timing, row.deferred, state.tranches);
    return {
      ...row,
      name: row.holder.className || seriesLabel(row.holder.series),
      ...attribution,
    };
  });
  const colors = ["mint", "platinum", "mint-soft", "platinum-soft", "mint-dim", "platinum-dim"];
  const scaleMax = Math.max(1, ...investors.flatMap((item) => [item.investment, item.investorExit]));
  const rowsHtml = investors.map((item, index) => {
    const outcome = item.investment > 0 ? `${formatDpi(item.investorExit / item.investment)} · ${formatIrr(item.grossIrr)} IRR` : "No modeled investment";
    const initialWidth = comparisonBarWidth(item.investment, scaleMax);
    const exitWidth = comparisonBarWidth(item.investorExit, scaleMax);
    return `<li class="class-compare-row">
      <div class="class-identity"><span class="class-swatch ${colors[index % colors.length]}" aria-hidden="true"></span><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(outcome)}</small></span></div>
      <div class="compare-value initial"><div class="compare-label"><span>investor check</span><strong>${formatMoney(item.investment)}</strong></div><div class="compare-track" aria-hidden="true"><span data-amount="${item.investment}" style="width:${initialWidth}%"></span></div></div>
      <div class="compare-value exit"><div class="compare-label"><span>investor exit</span><strong>${formatMoney(item.investorExit)}</strong></div><div class="compare-track" aria-hidden="true"><span data-amount="${item.investorExit}" style="width:${exitWidth}%"></span></div></div>
    </li>`;
  }).join("");
  const comparisonHtml = rowsHtml
    ? `<ul class="class-comparison" aria-label="Investor outcomes by share class">${rowsHtml}</ul>`
    : `<div class="class-comparison"><p class="empty-state">Add an investor round to calculate investor outcomes.</p></div>`;
  return {
    chartHtml: `<section class="viz-panel class-panel outcome-panel" aria-labelledby="investor-chart-title"><div class="viz-heading"><div><span class="section-label">share-class returns</span><h3 id="investor-chart-title">Investment vs proceeds by share class</h3></div><p>square-root scale keeps smaller classes legible · labels are exact</p></div>${comparisonHtml}</section>`,
    detailHtml: renderInvestorTable(investors, waterfall, total),
  };
}

function renderPeopleOutcomes(rows, pricePerShare) {
  const cohorts = state.peopleCohorts.map((cohort) => computePeopleCohortOutcome(cohort, pricePerShare, state.deal.discountRate));
  const colors = ["mint", "platinum", "mint-soft", "platinum-soft", "mint-dim", "platinum-dim"];
  const scaleMax = Math.max(1, ...cohorts.flatMap((item) => [item.initialInvestment, item.expectedValue]));
  const rowsHtml = cohorts.map((item, index) => {
    const exerciseMix = item.equityType === "common"
      ? "common stock"
      : `${formatPercent(item.exercisedPercent / 100)} of vested exercised · ${formatShares(item.unexercisedShares)} unexercised`;
    const multiple = item.exerciseCost > 0
      ? `${exerciseMix}${item.makeWhole > 0 ? ` · ${number(item.recoveryFloorMultiple).toFixed(1)}× floor` : ""}`
      : exerciseMix;
    const initialWidth = comparisonBarWidth(item.initialInvestment, scaleMax);
    const exitWidth = comparisonBarWidth(item.expectedValue, scaleMax);
    const cohortLabel = String(item.label || seriesLabel(item.entryStage)).replace(/^Employee joining (?:at |in )/, "");
    return `<li class="class-compare-row"><div class="class-identity"><span class="class-swatch ${colors[index % colors.length]}" aria-hidden="true"></span><span><strong>${escapeHtml(cohortLabel)}</strong><small>${escapeHtml(multiple)}</small></span></div><div class="compare-value initial"><div class="compare-label"><span>exercise cost paid</span><strong>${formatMoney(item.initialInvestment)}</strong></div><div class="compare-track" aria-hidden="true"><span data-amount="${item.initialInvestment}" style="width:${initialWidth}%"></span></div></div><div class="compare-value exit"><div class="compare-label"><span>modeled proceeds</span><strong>${formatMoney(item.expectedValue)}</strong></div><div class="compare-track" aria-hidden="true"><span data-amount="${item.expectedValue}" style="width:${exitWidth}%"></span></div></div></li>`;
  }).join("");
  const comparisonHtml = rowsHtml
    ? `<ul class="class-comparison" aria-label="Employee entry-stage exit comparisons">${rowsHtml}</ul>`
    : `<div class="class-comparison"><p class="empty-state">Add an employee cohort to calculate outcomes.</p></div>`;
  return {
    chartHtml: `${renderCommonOwnershipOutcomes(rows, pricePerShare)}<section class="viz-panel class-panel outcome-panel" aria-labelledby="people-chart-title"><div class="viz-heading"><div><span class="section-label">employee equity by entry stage</span><h3 id="people-chart-title">Cost basis vs holder proceeds</h3></div><p>${formatPrice(pricePerShare)} common / share · square-root scale · exact labels</p></div>${comparisonHtml}</section>`,
    detailHtml: renderPeopleTable(cohorts, pricePerShare),
  };
}

function renderCommonOwnershipOutcomes(rows, pricePerShare) {
  const commonRows = rows.filter(({ holder }) => ["founder", "employee"].includes(holder.category));
  if (!commonRows.length) return "";
  const categories = ["founder", "employee"].map((category) => {
    const members = commonRows.filter(({ holder }) => holder.category === category);
    return {
      category,
      shares: members.reduce((sum, { holder }) => sum + number(holder.shares), 0),
      entitlement: members.reduce((sum, { timing }) => sum + number(timing.entitlement), 0),
      names: members.map(({ holder }) => holder.name).join("; "),
    };
  }).filter((item) => item.shares > 0 || item.entitlement > 0);
  const maxEntitlement = Math.max(1, ...categories.map((item) => item.entitlement));
  const rowsHtml = categories.map((item) => `<li class="ownership-row"><div><strong>${escapeHtml(item.category === "founder" ? "Founders" : "Employees & other common")}</strong><span>${escapeHtml(item.names)}</span></div><div class="ownership-bar" aria-hidden="true"><span data-amount="${item.entitlement}" style="width:${Math.max(0, item.entitlement / maxEntitlement * 100)}%"></span></div><div><strong>${formatMoney(item.entitlement)}</strong><span>${formatShares(item.shares)} · ${formatPrice(pricePerShare)} implied common</span></div></li>`).join("");
  return `<section class="ownership-panel" aria-labelledby="common-ownership-title"><div class="viz-heading"><div><span class="section-label">modeled common ownership</span><h3 id="common-ownership-title">Founder and employee/common proceeds</h3></div><p>aggregate founder ownership is estimated</p></div><ul class="ownership-list">${rowsHtml}</ul></section>`;
}

function renderInvestorTable(investors, waterfall, total) {
  const rowsHtml = investors.map((item) => {
    const holder = item.holder;
    const choice = waterfall.choiceById[holder.id] === "preference" ? `preference · tier ${holder.seniority}` : "as-converted common";
    const dpi = item.investment > 0 ? formatDpi(item.investorExit / item.investment) : "—";
    const irr = formatIrr(item.grossIrr);
    const classLabel = holder.className || seriesLabel(holder.series);
    const holderDetail = holder.name && holder.name !== classLabel ? `<span class="subtext">${escapeHtml(holder.name)}</span>` : "";
    const timingDetail = item.investorDeferred > 0
      ? `<span class="subtext">${formatMoney(item.investorClosing)} cash · ${formatMoney(item.investorDeferred)} other consideration · ${formatMoney(item.investorExpected)} PV</span>`
      : `<span class="subtext">${formatMoney(item.investorClosing)} at close</span>`;
    return `<tr><td><strong>${escapeHtml(classLabel)}</strong>${holderDetail}</td><td class="money">${formatMoney(item.preferenceBasis)}</td><td class="money">${formatMoney(item.roundSize)}</td><td class="money">${formatMoney(item.investment)}</td><td><strong>${escapeHtml(choice)}</strong><span class="subtext">${formatShares(holder.shares)}</span></td><td class="money"><strong>${formatMoney(item.investorExit)}</strong>${timingDetail}</td><td class="money"><strong>${dpi}</strong><span class="subtext">${irr} gross IRR · ${formatYears(item.holdingPeriodYears)}</span></td></tr>`;
  }).join("");
  const investmentTotal = investors.reduce((sum, item) => sum + item.investment, 0);
  const exitTotal = investors.reduce((sum, item) => sum + item.investorExit, 0);
  const maximumHolding = Math.max(0, ...investors.map((item) => item.holdingPeriodYears));
  const portfolioCashFlows = investors.flatMap((item) => item.irrCashFlows.map((flow) => ({
    amount: flow.amount,
    time: flow.time + maximumHolding - item.holdingPeriodYears,
  })));
  const portfolioIrr = computeAnnualizedIrr(portfolioCashFlows);
  return `<section class="payout-section" aria-labelledby="investor-table-title"><div class="table-heading"><div><span class="section-label">investor detail</span><h3 id="investor-table-title">Share-class waterfall</h3></div><p>DPI uses nominal proceeds; IRR uses editable investment-to-exit timing</p></div><span class="table-scroll-cue section-label">scroll horizontally for complete detail →</span><div class="table-wrap" tabindex="0" role="region" aria-label="Share-class waterfall table; scroll horizontally for complete detail"><table><thead><tr><th>share class</th><th>preference basis</th><th>round size</th><th>investor check</th><th>exit treatment</th><th>investor exit</th><th>gross DPI / IRR</th></tr></thead><tbody>${rowsHtml}</tbody><tfoot><tr><td>modeled investors</td><td></td><td></td><td>${formatMoney(investmentTotal)}</td><td></td><td>${formatMoney(exitTotal)}</td><td>${investmentTotal > 0 ? `<strong>${formatDpi(exitTotal / investmentTotal)}</strong><span class="subtext">${formatIrr(portfolioIrr)} gross IRR</span>` : "—"}</td></tr></tfoot></table></div></section>`;
}

function renderPeopleTable(cohorts, pricePerShare) {
  const rowsHtml = cohorts.map((item) => {
    const inTheMoney = number(pricePerShare) >= number(item.strike);
    const protection = item.makeWhole + item.transactionBonus + item.retentionPresentValue;
    const treatment = item.equityType === "common"
      ? "common stock"
      : `${formatPercent(item.exercisedPercent / 100)} of vested exercised; ${item.unexercisedShares > 0 ? (inTheMoney ? "remainder cashless" : "remainder underwater") : "fully exercised"}${item.makeWhole > 0 ? " · 1× floor" : ""}`;
    const positiveTreatment = item.makeWhole > 0 || inTheMoney || item.equityType === "common";
    return `<tr><td><strong>${escapeHtml(item.label)}</strong><span class="subtext">${escapeHtml(seriesLabel(item.entryStage))} · ${formatPercent(item.eligiblePercent / 100)} vested${item.acceleratedShares > 0 ? ` · ${formatShares(item.acceleratedShares)} accelerated` : ""}</span></td><td class="money">${formatShares(item.eligibleShares)}</td><td class="money">${formatPrice(item.strike)}</td><td class="money">${formatMoney(item.initialInvestment)}</td><td class="money">${formatMoney(item.equityProceeds)}</td><td class="money">${formatMoney(protection)}</td><td class="money">${formatMoney(item.expectedValue)}</td><td><strong class="${positiveTreatment ? "positive" : "negative"}">${escapeHtml(treatment)}</strong></td></tr>`;
  }).join("");
  return `<section class="payout-section" aria-labelledby="people-table-title"><div class="table-heading"><div><span class="section-label">employee cohort detail</span><h3 id="people-table-title">Equity and modeled protection</h3></div><p>normalized 100K awards · taxes excluded</p></div><span class="table-scroll-cue section-label">scroll horizontally for complete detail →</span><div class="table-wrap" tabindex="0" role="region" aria-label="Employee cohort table; scroll horizontally for complete detail"><table><thead><tr><th>entry cohort</th><th>eligible shares</th><th>strike</th><th>exercise cost</th><th>equity proceeds</th><th>make-whole / bonus / retention</th><th>expected value</th><th>treatment</th></tr></thead><tbody>${rowsHtml}</tbody></table></div></section>`;
}

function renderDialogs() {
  const { waterfall, effectiveStakeholders } = calculateModel();
  const activePrefs = effectiveStakeholders.filter((holder) => ["preferred","safe","note"].includes(holder.securityType) && (number(holder.preferenceMultiple) > 0 || number(holder.secondaryPreferenceMultiple) > 0 || number(holder.accruedDividend) > 0 || number(holder.dividendRate) > 0));
  const tiers = [...new Set(activePrefs.map((holder) => number(holder.seniority)))].sort((a,b)=>a-b);
  methodsContent.innerHTML = `<div class="explainers">
    ${explainer("Enterprise-to-equity bridge", "Enterprise value plus available cash, less debt, debt-like items, seller expenses, carve-outs and taxes, plus working-capital and other agreed adjustments. Incremental contingent tranches are then added to gross waterfall value.")}
    ${explainer("Investor round view", "Each investor row represents a financing class. Class preference basis drives the liquidation claim; financing round size is contextual. The modeled investor check controls the proportional share of the class basis shown in investor returns. Public round announcements and charter-derived class basis can differ.")}
    ${explainer("DPI and IRR", "Modeled gross DPI divides nominal attributed proceeds by invested capital. Gross IRR annualizes the same nominal proceeds using the editable investment-to-exit period and each consideration tranche's payment timing. Buyer stock, rollover and contingent value are not realized fund distributions until monetized; use governing dates and actual cash flows for reported fund returns.")}
    ${explainer("Founders versus employees", usesPreset("airtable") ? "Founder common is a cap-table security and participates in the shareholder waterfall. Employee rows are normalized 100K-award scenarios, not population totals. Airtable's filings disclose aggregate common but not founder ownership, so the founder/employee split is an editable midpoint estimate." : "Founder and employee/common ownership are modeled as separate cap-table rows. Employee entry cohorts are scenario analyses rather than population totals and can be added or removed independently.")}
    ${usesPreset("airtable") ? explainer("Founder FF stock", "Airtable's February 2013 capitalization includes 667,395 shares of Series FF, or 0.7% of outstanding shares. FF is founders preferred: common-like founder equity with a conversion feature that can facilitate limited founder secondary liquidity in a later financing. The available source does not disclose a separate issue price or liquidation preference; the simulator therefore assigns these shares to founders and models them as common at exit.") : ""}
    ${explainer("Employee protection", "The exercised-share recovery floor is a personal make-whole overlay: it fills any gap between gross common proceeds and the selected multiple of exercise cost. It is not deducted from the shareholder waterfall because public information does not disclose the protected population or total pool. Add a seller-funded carveout to the deal bridge if modeling an aggregate funded pool. Retention is discounted separately as buyer-funded compensation.")}
    ${usesPreset("airtable") ? explainer("Airtable employee assumptions", "Historical 409A marks in the December 2024 cap-table report anchor illustrative strikes. Exercise rates decline by entry stage; the 2023+ example assumes 25% of vested options were exercised. Exercised shares receive a modeled 1× cost-recovery floor, while unexercised options receive only positive spread. These are evidence-informed house assumptions, not disclosed Airtable deal terms.") : ""}
    ${explainer("Priority and pari passu", tiers.length ? `Active preference tiers: ${tiers.join(", ")}. ${state.terms.pariPassu ? "The universal pari passu setting is on, so preferred stock classes—and standard SAFEs with shared terms—occupy the same investor tier." : "The universal pari passu setting is off, so each instrument uses its selected seniority."} Common remains junior. Outstanding notes retain their individual debt-senior treatment. Tier 1 pays first.` : "Liquidation preference and pari passu are off in the clean default. Common participates on an as-converted basis; any outstanding SAFE or note retains its own contractual claim.")}
    ${explainer("Conversion elections", waterfall.stableElection ? (waterfall.electionMethod === "iterative" ? "For more than 12 elective classes, the solver applies deterministic best-response elections until no class can improve by switching. Smaller models exhaustively evaluate every combination. Confirm whether elections occur by holder, series or class vote." : "For up to 12 elective classes, the solver exhaustively evaluates every preference and conversion combination. A class takes preference when conversion would not improve its payout with the other elections held fixed.") : "No stable election set was found. Review the displayed lowest-regret set against the transaction documents.")}
    ${explainer("Participation, caps and split claims", "Non-participating preferred chooses preference or conversion. Fully participating preferred receives its claim and residual participation. Capped participation stops at the selected multiple after preference, prior distributions and—when selected—paid dividends. A class may split claims across two priority tiers; generic prior distributions credit the most senior outstanding claim first.")}
    ${explainer("Ratchets and dividends", "Full ratchet resets the conversion price to the down-round price. Weighted average uses CP2 = CP1 × (A + B) / (A + C). Fixed, simple or compounded cumulative dividends can increase preference; prior payments and waivers reduce it. Whether historical dividends count toward a participation cap is document-specific and explicitly configurable.")}
    ${explainer("Exercised versus unexercised options", "The historical exercise percentage applies only to shares vested before closing. Newly accelerated options remain unexercised and receive only positive spread unless the transaction documents provide an exercise or cash-out mechanic. Exercised shares receive gross common proceeds plus any selected recovery make-whole.")}
    ${explainer("Options, warrants and vesting", "Vested shares are eligible at close; the acceleration input separately converts a percentage of unvested shares into eligible shares. Underwater unexercised options may be cancelled for no consideration unless the governing documents provide otherwise.")}
    ${explainer("Consideration timing", "Every tranche has an explicit allocation basis. Closing-pro-rata tranches use each eligible holder's initial waterfall share; this is the default for buyer stock, escrow, notes and rollover. Cumulative-waterfall tranches reserve included value from initial proceeds, then recalculate holder entitlement after crediting prior payments; this is the earnout default. Same-time cumulative tranches are solved together so row order cannot change form or risk allocation. The merger agreement controls. Probability and timing affect expected present value, not nominal entitlement.")}
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
  if (number(consideration.unallocated) > 1) warnings.push({ tone: "danger", text: `${formatMoney(consideration.unallocated)} is not assigned to a holder under the selected tranche eligibility and allocation bases.` });
  const ids = state.stakeholders.map((holder) => holder.id);
  if (new Set(ids).size !== ids.length) warnings.push({ tone: "danger", text: "Stakeholder IDs must be unique." });
  state.stakeholders.filter((holder) => number(holder.investorInvestment) > number(holder.invested) && number(holder.invested) >= 0).forEach((holder) => {
    warnings.push({ tone: "danger", text: `${seriesLabel(holder.series)} modeled investor check exceeds the class preference basis; investor attribution is capped at 100% of the class.` });
  });
  applySharedTerms(state.stakeholders, state.terms).filter((holder) => ["preferred","safe","note"].includes(holder.securityType) && holder.ratchetType !== "none").forEach((holder) => {
    const multiplier = ratchetMultiplier(holder);
    if (multiplier > 1.0001) warnings.push({ text: `${holder.name} anti-dilution increases as-converted shares by ${multiplier.toFixed(3)}×.` });
  });
  const attributedClosingBonuses = state.peopleCohorts.reduce((sum, cohort) => sum + Math.max(0, number(cohort.transactionBonus)), 0);
  if (attributedClosingBonuses > 0 && number(state.deal.bonuses) <= 0) warnings.push({ text: "Employee closing bonuses are shown as personal outcome overlays. Add any seller-funded carveout total to the deal bridge so it also reduces shareholder proceeds." });
  if (number(state.deal.bonuses) > 0 && attributedClosingBonuses <= 0) warnings.push({ text: "The seller-funded management carveout reduces shareholder proceeds but has not been attributed to any employee cohort in the people view." });
  return warnings;
}

function inputField({ label, value, inputType, scope, field, wide = false }) {
  if (inputType === "percent") return rangeField({ label, value, scope, field, wide, min: 0, max: field === "discountRate" ? 30 : 100, step: field === "discountRate" ? .5 : 1 });
  const display = ["money","shares"].includes(inputType) ? compactInput(value) : String(value ?? "");
  return `<label class="field ${wide ? "wide" : ""}"><span>${escapeHtml(label)}</span><input type="text" inputmode="${inputType === "text" ? "text" : "decimal"}" value="${escapeAttribute(display)}" data-scope="${scope}" data-field="${field}" data-value-type="${inputType}"></label>`;
}

function indexedField(index, scope, field, label, value, inputType, wide = false) {
  if (inputType === "percent") return rangeField({ label, value, scope, field, index, wide, min: 0, max: 100, step: 1 });
  const display = ["money","shares"].includes(inputType) ? compactInput(value) : String(value ?? "");
  return `<label class="field ${wide ? "wide" : ""}"><span>${escapeHtml(label)}</span><input type="text" inputmode="${inputType === "text" ? "text" : "decimal"}" value="${escapeAttribute(display)}" data-scope="${scope}" data-index="${index}" data-field="${field}" data-value-type="${inputType}"></label>`;
}

function rangeField({ label, value, scope, field, index, wide = false, min = 0, max = 100, step = 1 }) {
  const numericValue = Math.min(max, Math.max(min, number(value)));
  const progress = max === min ? 0 : ((numericValue - min) / (max - min)) * 100;
  const indexData = Number.isInteger(index) ? ` data-index="${index}"` : "";
  const outputId = `range-${scope}-${Number.isInteger(index) ? `${index}-` : ""}${field}`;
  return `<div class="field range-field ${wide ? "wide" : ""}"><div class="range-heading"><label for="${outputId}">${escapeHtml(label)}</label><output data-range-output="${outputId}">${escapeHtml(formatRangePercent(numericValue))}</output></div><input id="${outputId}" type="range" min="${min}" max="${max}" step="${step}" value="${numericValue}" aria-label="${escapeAttribute(label)}" data-scope="${scope}"${indexData} data-field="${field}" data-value-type="percent" data-range-output-id="${outputId}" style="--range-progress:${progress}%"></div>`;
}

function formatRangePercent(value) {
  const digits = Number.isInteger(value) ? 0 : 1;
  return `${value.toFixed(digits)}%`;
}

function selectField(index, scope, field, label, value, options) {
  return `<label class="field"><span>${escapeHtml(label)}</span><select data-scope="${scope}" data-index="${index}" data-field="${field}" data-value-type="select">${options.map(([optionValue, optionLabel]) => `<option value="${escapeAttribute(optionValue)}" ${String(optionValue) === String(value) ? "selected" : ""}>${escapeHtml(optionLabel)}</option>`).join("")}</select></label>`;
}

function selectSimpleField(scope, field, label, value, options) {
  return `<label class="field"><span>${escapeHtml(label)}</span><select data-scope="${scope}" data-field="${field}" data-value-type="select">${options.map(([optionValue, optionLabel]) => `<option value="${escapeAttribute(optionValue)}" ${optionValue === value ? "selected" : ""}>${escapeHtml(optionLabel)}</option>`).join("")}</select></label>`;
}

function booleanField(scope, field, label, checked, disabled = false) {
  return `<label class="check-field"><input type="checkbox" data-scope="${scope}" data-field="${field}" data-value-type="boolean" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""}><span>${escapeHtml(label)}</span></label>`;
}

function indexedBooleanField(index, field, label, checked, disabled = false) {
  return `<label class="check-field"><input type="checkbox" data-scope="stakeholder" data-index="${index}" data-field="${field}" data-value-type="boolean" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""}><span>${escapeHtml(label)}</span></label>`;
}

function indexedCohortBooleanField(index, field, label, checked, disabled = false) {
  return `<label class="check-field"><input type="checkbox" data-scope="cohort" data-index="${index}" data-field="${field}" data-value-type="boolean" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""}><span>${escapeHtml(label)}</span></label>`;
}

function metric(label, value, primary = false) {
  return `<div class="metric ${primary ? "primary" : ""}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

let scheduledResultFrame = 0;
let scheduledResultTimer = 0;

function commitScheduledResults() {
  if (scheduledResultFrame) cancelAnimationFrame(scheduledResultFrame);
  if (scheduledResultTimer) clearTimeout(scheduledResultTimer);
  scheduledResultFrame = 0;
  scheduledResultTimer = 0;
  renderResults();
  saveState();
}

function scheduleResultsUpdate(debounce = false) {
  if (scheduledResultFrame) cancelAnimationFrame(scheduledResultFrame);
  if (scheduledResultTimer) clearTimeout(scheduledResultTimer);
  scheduledResultFrame = 0;
  scheduledResultTimer = 0;
  if (debounce) scheduledResultTimer = setTimeout(commitScheduledResults, 120);
  else scheduledResultFrame = requestAnimationFrame(commitScheduledResults);
}

function updateStateFromControl(target, renderImmediately = true) {
  const { scope, field, valueType, index } = target.dataset;
  if (!scope || !field) return false;
  let value = target.value;
  if (valueType === "boolean") value = target.checked;
  else if (["money","shares","number","percent"].includes(valueType)) value = parseCompact(value);
  if (scope === "deal") state.deal[field] = value;
  if (scope === "terms") state.terms[field] = value;
  if (scope === "tranche") state.tranches[number(index)][field] = value;
  if (scope === "stakeholder") {
    const holderIndex = number(index);
    if (field === "securityType") state.stakeholders[holderIndex] = applySecurityTypeDefaults(state.stakeholders[holderIndex], value);
    else state.stakeholders[holderIndex][field] = value;
  }
  if (scope === "cohort") state.peopleCohorts[number(index)][field] = value;
  markModelCustom();
  if (renderImmediately) commitScheduledResults();
  return true;
}

controls.addEventListener("input", (event) => {
  if (event.target.matches("select, input[type='checkbox']")) return;
  if (event.target.matches("input[type='range']")) {
    const min = number(event.target.min);
    const max = number(event.target.max);
    const value = number(event.target.value);
    const progress = max === min ? 0 : ((value - min) / (max - min)) * 100;
    event.target.style.setProperty("--range-progress", `${progress}%`);
    controls.querySelector(`[data-range-output="${event.target.dataset.rangeOutputId}"]`)?.replaceChildren(formatRangePercent(value));
  }
  if (updateStateFromControl(event.target, false)) scheduleResultsUpdate(event.target.matches("input[type='text']"));
});

controls.addEventListener("change", (event) => {
  if (event.target.matches("input[type='text']")) {
    if (updateStateFromControl(event.target, false)) commitScheduledResults();
    return;
  }
  if (event.target.matches("select, input[type='checkbox']") && updateStateFromControl(event.target)) renderControls();
});

controls.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  if (["collapse-editors", "expand-editors"].includes(button.dataset.action)) {
    const open = button.dataset.action === "expand-editors";
    controls.querySelectorAll("details.editor-row").forEach((details) => { details.open = open; });
    return;
  }
  const index = number(button.dataset.index);
  if (button.dataset.action === "add-stakeholder") state.stakeholders.push(blankStakeholder(uniqueId("holder")));
  if (button.dataset.action === "remove-stakeholder") state.stakeholders.splice(index, 1);
  if (button.dataset.action === "add-tranche") state.tranches.push(blankTranche(uniqueId("tranche")));
  if (button.dataset.action === "remove-tranche") state.tranches.splice(index, 1);
  if (button.dataset.action === "add-cohort") state.peopleCohorts.push(blankPeopleCohort(uniqueId("cohort")));
  if (button.dataset.action === "remove-cohort") state.peopleCohorts.splice(index, 1);
  markModelCustom();
  renderAll();
});

document.querySelector(".input-tabs").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-tab]");
  if (!button) return;
  activeInputTab = button.dataset.tab;
  document.querySelectorAll(".input-tab").forEach((tab) => {
    const active = tab === button;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  renderControls();
});

document.querySelector(".input-tabs").addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const tabs = [...document.querySelectorAll(".input-tab")];
  const current = tabs.indexOf(event.target);
  if (current < 0) return;
  event.preventDefault();
  const next = event.key === "Home" ? 0
    : event.key === "End" ? tabs.length - 1
      : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
  tabs[next].focus();
  tabs[next].click();
});

resultsContent.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-result-tab]");
  if (!button) return;
  activeResultTab = button.dataset.resultTab;
  renderResults();
  resultsContent.querySelector(`#result-tab-${activeResultTab}`)?.focus();
});

resultsContent.addEventListener("keydown", (event) => {
  if (!event.target.matches("button[data-result-tab]") || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const tabs = [...resultsContent.querySelectorAll("button[data-result-tab]")];
  const current = tabs.indexOf(event.target);
  if (current < 0) return;
  event.preventDefault();
  const next = event.key === "Home" ? 0
    : event.key === "End" ? tabs.length - 1
      : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
  tabs[next].click();
});

presetSelect.addEventListener("change", () => { state = normalizeState(clonePreset(presetSelect.value)); renderAll(); });
document.querySelector("#reset-button").addEventListener("click", () => {
  const preset = state.meta?.basePreset in PRESETS ? state.meta.basePreset : presetSelect.value;
  state = normalizeState(clonePreset(preset));
  renderAll();
});
document.querySelector("#methods-button").addEventListener("click", () => { renderDialogs(); methodsDialog.showModal(); });
document.querySelector("#sources-button").addEventListener("click", () => { renderDialogs(); sourcesDialog.showModal(); });

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
    state = normalizeState(imported);
    state.meta = { ...(state.meta || {}), preset: "custom", title: state.meta?.title || "Imported model" };
    renderAll();
  } catch {
    window.alert("That file is not a valid exit-waterfall model.");
  } finally {
    importFile.value = "";
  }
});

function usesPreset(name) { return state.meta?.preset === name || state.meta?.basePreset === name; }
function countActiveTranches() { return state.tranches.filter((tranche) => number(tranche.amount) > 0).length; }
function sharedTermsDescription(holder) {
  if (holder.securityType === "safe") return "Standard SAFE: 1× cash-out versus conversion, on the preferred tier when pari passu is selected. Turn off shared terms for a custom instrument.";
  if (holder.securityType === "note") return "Outstanding note: individual claim and seniority are preserved. If it is repaid through deal debt, include it in the bridge instead and avoid double counting.";
  if (holder.securityType === "preferred") return "Universal preferred-stock economics and consideration eligibility apply; selected seniority remains editable unless pari passu is on.";
  return "Shared consideration eligibility applies; common and employee securities do not receive investor preference terms.";
}
function ensureUniqueId(candidate, prefix, used) {
  let id = String(candidate ?? "").trim();
  if (!id || used.has(id)) id = uniqueId(prefix);
  while (used.has(id)) id = uniqueId(prefix);
  used.add(id);
  return id;
}
function markModelCustom() {
  const basePreset = state.meta?.basePreset in PRESETS
    ? state.meta.basePreset
    : (state.meta?.preset in PRESETS ? state.meta.preset : presetSelect.value);
  state.meta = { ...(state.meta || {}), preset: "custom", basePreset, title: "Custom model", description: "Edited transaction model" };
}
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

function formatPrice(value) {
  const amount = number(value);
  return `${amount < 0 ? "−" : ""}$${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatSignedMoney(value) {
  const amount = number(value);
  if (Math.abs(amount) < .01) return "$0";
  return `${amount > 0 ? "+" : "−"}${formatMoney(Math.abs(amount))}`;
}

function formatShares(value) {
  const amount = number(value);
  if (Math.abs(amount) >= 1e9) return `${trimZeros(amount / 1e9, 2)}B shares`;
  if (Math.abs(amount) >= 1e6) return `${trimZeros(amount / 1e6, 2)}M shares`;
  if (Math.abs(amount) >= 1e3) return `${trimZeros(amount / 1e3, 1)}K shares`;
  return `${Math.round(amount).toLocaleString()} shares`;
}

function formatPercent(value) { return `${(number(value) * 100).toFixed(2)}%`; }
function formatDpi(value) { return `${number(value).toFixed(2)}× DPI`; }
function formatIrr(value) { return Number.isFinite(value) ? formatPercent(value) : "—"; }
function formatYears(value) { return `${number(value).toFixed(number(value) % 1 ? 1 : 0)} yrs`; }
function trimZeros(value, digits = 4) { return number(value).toFixed(digits).replace(/\.?0+$/, ""); }
function labelForSecurity(value) { return { common:"Common stock", preferred:"Preferred stock", safe:"SAFE", note:"Convertible note", rsu:"RSU / restricted stock", option:"Option", warrant:"Warrant" }[value] || value; }
function seriesLabel(value) { return Object.fromEntries(SERIES_OPTIONS)[value] || String(value || "Other"); }
function inferSeries(holder) {
  const text = `${holder?.className || ""} ${holder?.name || ""}`.toLowerCase();
  for (const [value, label] of [...SERIES_OPTIONS].reverse()) if (text.includes(label.toLowerCase())) return value;
  return holder?.securityType === "common" ? "common" : "other";
}
function inferredClassName(holder) { return { common:"Common stock", preferred:"Preferred stock", safe:"SAFE", note:"Convertible notes", rsu:"RSUs / restricted stock", option:"Options", warrant:"Warrants" }[holder?.securityType] || "Other securities"; }
function labelForType(value) { return { stock:"Buyer stock", escrow:"Escrow / holdback", note:"Seller note", earnout:"Earnout", rollover:"Rollover equity", other:"Other" }[value] || value; }
function slugify(value) { return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "exit-waterfall"; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[character])); }
function escapeAttribute(value) { return escapeHtml(value).replace(/`/g, "&#96;"); }

function updateClock() {
  document.querySelector("#clock").textContent = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date());
}
updateClock();
setInterval(updateClock, 1000);

function syncWorkspaceOrder(event = mobileWorkspaceQuery) {
  if (event.matches) workspace.insertBefore(resultsPanel, inputsPanel);
  else workspace.insertBefore(inputsPanel, resultsPanel);
}

syncWorkspaceOrder();
mobileWorkspaceQuery.addEventListener("change", syncWorkspaceOrder);

if (matchMedia("(prefers-reduced-motion: no-preference)").matches && matchMedia("(pointer: fine)").matches) {
  document.documentElement.classList.add("has-dot");
  const dot = document.querySelector(".dot-cur");
  const hoverSelector = "a,button,summary,input,select,.field,.check-field,.metric,.bridge-node,.bridge-adjustment,.ownership-row,.class-compare-row,tbody tr";
  addEventListener("pointermove", (event) => {
    dot.style.transform = `translate3d(${event.clientX}px,${event.clientY}px,0)`;
    document.body.classList.toggle("hoverable", Boolean(event.target.closest(hoverSelector)));
  });
  addEventListener("pointerleave", () => document.body.classList.remove("hoverable"));
}

renderAll();
