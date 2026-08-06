import { allocateConsideration, computeEquityBridge, computeWaterfall, ratchetMultiplier } from "./waterfall-engine.js";
import { PRESETS, blankStakeholder, blankTranche, clonePreset } from "./presets.js";

const STORAGE_KEY = "tiki-exit-waterfall-v1";
const controls = document.querySelector("#controls");
const resultsContent = document.querySelector("#results-content");
const presetSelect = document.querySelector("#preset-select");
const importFile = document.querySelector("#import-file");
const palette = ["#bd3a2b", "#1e6f5c", "#355f9a", "#8a5b16", "#6e4a87", "#40636b", "#904d5d", "#506b36", "#6d5b4b", "#2f708b"];

let state = loadSavedState() || clonePreset("clean");

const dealFields = [
  ["name", "Company / transaction", "text", "The target or scenario name."],
  ["enterpriseValue", "Enterprise value", "money", "Headline value before capital-structure adjustments."],
  ["cash", "Cash and investments added", "money", "Exclude customer or restricted funds that are not available to sellers."],
  ["debt", "Debt payoff", "money", "Principal, accrued interest, premiums and breakage paid at close."],
  ["debtLike", "Debt-like items", "money", "Leases, unpaid bonuses, deferred revenue or other agreed debt-like items."],
  ["workingCapital", "Working-capital adjustment", "money", "Positive for an excess; negative for a shortfall."],
  ["transactionFees", "Transaction expenses", "money", "Banker, legal, accounting, paying-agent and other seller expenses."],
  ["bonuses", "Change-in-control / carve-out", "money", "Management carve-outs, transaction bonuses and similar off-the-top payments."],
  ["transferTaxes", "Transfer and entity-level taxes", "money", "Taxes borne by the selling company or seller pool, not personal holder taxes."],
  ["otherAdjustment", "Other adjustment", "money", "Use a negative amount for a deduction."],
  ["discountRate", "PV discount rate", "percent", "Annual rate used only for expected present value of delayed proceeds."],
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
  presetSelect.value = state.meta?.preset in PRESETS ? state.meta.preset : "clean";
  renderControls();
  renderResults();
  saveState();
}

function renderControls() {
  controls.innerHTML = `
    <details open>
      <summary>Enterprise-to-equity bridge <span class="summary-meta">${formatMoney(computeEquityBridge(state.deal).equityValue)}</span></summary>
      <div class="details-body">
        <p class="section-note">The bridge determines the amount available to the security waterfall.</p>
        <div class="form-grid">
          ${dealFields.map(([key, label, type, hint], index) => inputField({
            label,
            hint,
            value: state.deal[key],
            inputType: type,
            scope: "deal",
            field: key,
            wide: index === 0,
          })).join("")}
        </div>
      </div>
    </details>
    <details>
      <summary>Consideration schedule <span class="summary-meta">${countActiveTranches()} active</span></summary>
      <div class="details-body">
        <p class="section-note">These amounts change timing or form, not gross entitlement. Leave every amount at zero for a clean cash acquisition.</p>
        ${state.tranches.map(renderTrancheEditor).join("")}
        <button class="button secondary add-row" type="button" data-action="add-tranche">Add consideration tranche</button>
      </div>
    </details>
    <details open>
      <summary>Stakeholders and securities <span class="summary-meta">${state.stakeholders.length} rows</span></summary>
      <div class="details-body">
        <p class="section-note">Tier 1 is most senior. Classes with the same tier share an underfunded tier pari passu. Liquidation preference defaults to 0×.</p>
        ${state.stakeholders.map(renderStakeholderEditor).join("")}
        <button class="button secondary add-row" type="button" data-action="add-stakeholder">Add stakeholder or class</button>
      </div>
    </details>
  `;
}

function renderTrancheEditor(tranche, index) {
  return `
    <details class="editor-row">
      <summary class="editor-summary">
        <span class="editor-summary-main"><strong>${escapeHtml(tranche.label)}</strong><span>${escapeHtml(labelForType(tranche.type))} · ${formatMoney(tranche.amount)}</span></span>
      </summary>
      <div class="editor-body">
        <div class="form-grid">
          ${indexedField(index, "tranche", "label", "Label", tranche.label, "text", true)}
          ${indexedField(index, "tranche", "amount", "Maximum / face amount", tranche.amount, "money")}
          ${selectField(index, "tranche", "type", "Form", tranche.type, [
            ["stock", "Buyer stock"], ["escrow", "Escrow / holdback"], ["note", "Seller note"], ["earnout", "Earnout"], ["rollover", "Rollover equity"], ["other", "Other"],
          ])}
          ${selectField(index, "tranche", "treatment", "Purchase-price treatment", tranche.treatment || "included", [
            ["included", "Included in bridge equity value"], ["incremental", "Incremental to bridge equity value"],
          ])}
          ${selectField(index, "tranche", "eligibility", "Eligible holders", tranche.eligibility, [
            ["all", "All holders"], ["escrow", "Escrow-eligible only"], ["deferred", "Deferred-eligible only"],
          ])}
          ${indexedField(index, "tranche", "expectedPercent", "Expected realization", tranche.expectedPercent, "percent")}
          ${indexedField(index, "tranche", "years", "Payment timing (years)", tranche.years, "number")}
        </div>
        <div class="editor-actions"><button class="button danger" type="button" data-action="remove-tranche" data-index="${index}">Remove tranche</button></div>
      </div>
    </details>`;
}

function renderStakeholderEditor(holder, index) {
  const preferred = ["preferred", "safe", "note"].includes(holder.securityType);
  const optionLike = holder.securityType === "option" || holder.securityType === "warrant";
  const ratchet = holder.ratchetType && holder.ratchetType !== "none";
  return `
    <details class="editor-row">
      <summary class="editor-summary">
        <span class="editor-summary-main"><strong>${escapeHtml(holder.name)}</strong><span>${escapeHtml(labelForSecurity(holder.securityType))} · ${formatShares(holder.shares)}</span></span>
      </summary>
      <div class="editor-body">
        <div class="form-grid">
          ${indexedField(index, "stakeholder", "name", "Stakeholder / class", holder.name, "text", true)}
          ${selectField(index, "stakeholder", "securityType", "Security", holder.securityType, [
            ["common", "Common stock"], ["preferred", "Preferred stock"], ["safe", "SAFE"], ["note", "Convertible note"], ["rsu", "RSU / restricted stock"], ["option", "Option"], ["warrant", "Warrant"],
          ])}
          ${indexedField(index, "stakeholder", "shares", "As-converted shares", holder.shares, "shares")}
          ${indexedField(index, "stakeholder", "eligiblePercent", "Vested / eligible", holder.eligiblePercent, "percent")}
          ${optionLike ? indexedField(index, "stakeholder", "strike", "Strike price per share", holder.strike, "number") : ""}
          ${preferred ? `
            ${indexedField(index, "stakeholder", "invested", "Preference base / invested", holder.invested, "money")}
            ${indexedField(index, "stakeholder", "preferenceMultiple", "Liquidation preference multiple", holder.preferenceMultiple, "number")}
            ${indexedField(index, "stakeholder", "seniority", "Seniority tier", holder.seniority, "number")}
            ${indexedField(index, "stakeholder", "secondaryPreferenceMultiple", "Split claim: additional preference multiple", holder.secondaryPreferenceMultiple, "number")}
            ${Number(holder.secondaryPreferenceMultiple) > 0 ? indexedField(index, "stakeholder", "secondarySeniority", "Split claim: additional seniority tier", holder.secondarySeniority, "number") : ""}
            ${selectField(index, "stakeholder", "dividendType", "Cumulative dividend", holder.dividendType || "none", [
              ["none", "None"], ["fixed", "Fixed accrued amount"], ["simple", "Simple annual rate"], ["compound", "Compound annual rate"],
            ])}
            ${holder.dividendType === "fixed" ? indexedField(index, "stakeholder", "accruedDividend", "Accrued dividend amount", holder.accruedDividend, "money") : ""}
            ${holder.dividendType === "simple" || holder.dividendType === "compound" ? indexedField(index, "stakeholder", "dividendRate", "Dividend rate", holder.dividendRate, "percent") : ""}
            ${holder.dividendType === "simple" || holder.dividendType === "compound" ? indexedField(index, "stakeholder", "dividendYears", "Dividend accrual years", holder.dividendYears, "number") : ""}
            ${holder.dividendType === "compound" ? indexedField(index, "stakeholder", "dividendPeriods", "Compounding periods per year", holder.dividendPeriods, "number") : ""}
            ${holder.dividendType !== "none" ? indexedField(index, "stakeholder", "paidDividends", "Previously paid dividends", holder.paidDividends, "money") : ""}
            ${indexedField(index, "stakeholder", "priorDistributions", "Prior preference distributions / offsets", holder.priorDistributions, "money")}
            ${indexedField(index, "stakeholder", "waiverPercent", "Preference waived / pay-to-play reduction", holder.waiverPercent, "percent")}
            ${selectField(index, "stakeholder", "participation", "Participation", holder.participation, [
              ["none", "Non-participating"], ["full", "Fully participating"], ["capped", "Capped participation"],
            ])}
            ${holder.participation === "capped" ? indexedField(index, "stakeholder", "capMultiple", "Participation cap (× invested)", holder.capMultiple, "number") : ""}
            ${selectField(index, "stakeholder", "conversionPolicy", "Conversion election", holder.conversionPolicy, [
              ["elective", "Economically optimal election"], ["force-convert", "Forced conversion / preference waived"], ["force-preference", "Forced preference treatment"],
            ])}
            ${selectField(index, "stakeholder", "ratchetType", "Anti-dilution ratchet", holder.ratchetType, [
              ["none", "None"], ["full-ratchet", "Full ratchet"], ["weighted-average", "Broad / narrow weighted average"], ["custom", "Custom conversion multiplier"],
            ])}
            ${ratchet && holder.ratchetType !== "custom" ? indexedField(index, "stakeholder", "originalPrice", "Original conversion price", holder.originalPrice, "number") : ""}
            ${ratchet && holder.ratchetType !== "custom" ? indexedField(index, "stakeholder", "downRoundPrice", "Down-round price", holder.downRoundPrice, "number") : ""}
            ${holder.ratchetType === "weighted-average" ? indexedField(index, "stakeholder", "preRoundShares", "Pre-round capitalization (A)", holder.preRoundShares, "shares") : ""}
            ${holder.ratchetType === "weighted-average" ? indexedField(index, "stakeholder", "newMoney", "Down-round new money", holder.newMoney, "money") : ""}
            ${holder.ratchetType === "custom" ? indexedField(index, "stakeholder", "conversionMultiplier", "Custom share multiplier", holder.conversionMultiplier, "number") : ""}
          ` : ""}
          ${checkboxField(index, "escrowEligible", "Contributes to escrows / holdbacks", holder.escrowEligible)}
          ${checkboxField(index, "deferredEligible", "Receives notes, earnouts or rollover", holder.deferredEligible)}
        </div>
        <div class="editor-actions"><button class="button danger" type="button" data-action="remove-stakeholder" data-index="${index}">Remove stakeholder</button></div>
      </div>
    </details>`;
}

function renderResults() {
  const bridge = computeEquityBridge(state.deal);
  const incremental = incrementalConsideration();
  const grossProceeds = bridge.equityValue + incremental;
  const waterfall = computeWaterfall(state.stakeholders, grossProceeds);
  const consideration = allocateConsideration(
    state.stakeholders,
    waterfall.payouts,
    state.tranches,
    state.deal.discountRate,
  );
  const warnings = buildWarnings(bridge, waterfall, consideration);
  const rows = state.stakeholders.map((holder, index) => {
    const timing = consideration.results[holder.id] || { entitlement: 0, closingCash: 0, expectedPresentValue: 0, tranches: {} };
    const deferred = Object.values(timing.tranches).reduce((sum, amount) => sum + amount, 0);
    return { holder, index, timing, deferred };
  }).sort((a, b) => b.timing.entitlement - a.timing.entitlement);
  const totalClosing = rows.reduce((sum, row) => sum + row.timing.closingCash, 0);
  const totalDeferred = rows.reduce((sum, row) => sum + row.deferred, 0);
  const totalExpected = rows.reduce((sum, row) => sum + row.timing.expectedPresentValue, 0);

  resultsContent.innerHTML = `
    <header class="result-header">
      <div><h2>${escapeHtml(state.deal.name || "Untitled transaction")}</h2><p>${escapeHtml(state.meta?.description || "Custom transaction model")}</p></div>
      <span class="model-badge">${escapeHtml(state.meta?.title || "Custom model")}</span>
    </header>
    ${warnings.length ? `<div class="alerts">${warnings.map((warning) => `<div class="alert ${warning.tone || ""}">${escapeHtml(warning.text)}</div>`).join("")}</div>` : `<div class="alerts"><div class="alert success">Model reconciles: bridge, security allocations, and consideration timing are fully allocated.</div></div>`}
    <section class="metrics" aria-label="Transaction summary">
      ${metric("Gross waterfall value", formatMoney(grossProceeds))}
      ${metric("Cash at close", formatMoney(totalClosing))}
      ${metric("Held / non-cash / deferred", formatMoney(totalDeferred))}
      ${metric("Expected present value", formatMoney(totalExpected))}
    </section>
    ${renderBridge(bridge, incremental)}
    ${renderAllocation(rows, grossProceeds)}
    ${renderPayoutTable(rows, waterfall, grossProceeds)}
    ${renderConsiderationSchedule(rows)}
    ${renderSensitivity()}
    ${renderMethodology(waterfall)}
    ${renderSources()}
  `;
}

function renderBridge(bridge, incremental) {
  return `
    <section class="result-section" aria-labelledby="bridge-title">
      <div class="section-title"><h3 id="bridge-title">Enterprise-to-equity bridge</h3><p>Off-the-top claims before the security waterfall</p></div>
      <div>
        ${bridge.rows.map((row) => `<div class="bridge-row"><span>${escapeHtml(row.label)}</span><span class="${row.sign < 0 ? "warning-text" : ""}">${row.sign < 0 ? "−" : row.key === "enterpriseValue" ? "" : "+"}${formatMoney(row.value)}</span></div>`).join("")}
        <div class="bridge-row total"><span>Distributable equity value</span><span>${formatMoney(bridge.equityValue)}</span></div>
        ${incremental > 0 ? `<div class="bridge-row"><span>Incremental contingent consideration</span><span>+${formatMoney(incremental)}</span></div><div class="bridge-row total"><span>Gross waterfall value</span><span>${formatMoney(bridge.equityValue + incremental)}</span></div>` : ""}
      </div>
    </section>`;
}

function renderAllocation(rows, total) {
  return `
    <section class="result-section" aria-labelledby="allocation-title">
      <div class="section-title"><h3 id="allocation-title">Gross entitlement by stakeholder</h3><p>Before timing and consideration form</p></div>
      <div class="allocation-bar" role="img" aria-label="Stacked allocation of gross transaction proceeds">
        ${rows.map((row) => {
          const percent = total > 0 ? row.timing.entitlement / total * 100 : 0;
          if (percent < 0.02) return "";
          return `<span class="allocation-segment" style="width:${percent}%;background:${palette[row.index % palette.length]}" title="${escapeHtml(row.holder.name)}: ${formatMoney(row.timing.entitlement)}">${percent >= 8 ? `${percent.toFixed(1)}%` : ""}</span>`;
        }).join("")}
      </div>
      <ul class="allocation-legend">
        ${rows.map((row) => `<li><span class="swatch" style="background:${palette[row.index % palette.length]}"></span>${escapeHtml(row.holder.name)} <span class="money">${formatMoney(row.timing.entitlement)}</span></li>`).join("")}
      </ul>
    </section>`;
}

function renderPayoutTable(rows, waterfall, total) {
  const preferenceTotal = Object.values(waterfall.preferencePaid).reduce((sum, value) => sum + value, 0);
  return `
    <section class="result-section" aria-labelledby="payout-title">
      <div class="section-title"><h3 id="payout-title">Security waterfall</h3><p>${formatMoney(preferenceTotal)} preference paid · implied common value ${formatMoney(waterfall.pricePerShare)} per share</p></div>
      <div class="table-wrap"><table>
        <thead><tr><th scope="col">Stakeholder</th><th scope="col">Security / election</th><th scope="col">Preference</th><th scope="col">Participation</th><th scope="col">Gross payout</th><th scope="col">Cash at close</th><th scope="col">Other / deferred</th><th scope="col">Expected PV</th><th scope="col">Share</th></tr></thead>
        <tbody>${rows.map((row) => {
          const holder = row.holder;
          const share = total > 0 ? row.timing.entitlement / total : 0;
          const election = waterfall.choiceById[holder.id];
          const preferenceSecurity = ["preferred", "safe", "note"].includes(holder.securityType);
          const multiplier = preferenceSecurity ? ratchetMultiplier(holder) : 1;
          return `<tr>
            <td><strong>${escapeHtml(holder.name)}</strong><span class="subtext">${formatShares(holder.shares)} eligible at ${formatPercent((holder.eligiblePercent || 0) / 100)}</span></td>
            <td>${escapeHtml(labelForSecurity(holder.securityType))}<span class="subtext">${preferenceSecurity ? `${escapeHtml(election)} · Tier ${holder.seniority}${multiplier > 1.0001 ? ` · ${multiplier.toFixed(3)}× ratchet` : ""}` : holder.securityType === "option" || holder.securityType === "warrant" ? `${formatMoney(holder.strike)} strike` : "as-converted"}</span></td>
            <td class="money">${formatMoney(waterfall.preferencePaid[holder.id] || 0)}<span class="subtext">${preferenceSecurity ? `${Number(holder.preferenceMultiple || 0).toFixed(2)}× + dividends` : "—"}</span></td>
            <td class="money">${formatMoney(waterfall.participationPaid[holder.id] || 0)}<span class="subtext">${preferenceSecurity ? escapeHtml(labelForParticipation(holder.participation)) : "—"}</span></td>
            <td class="money"><strong>${formatMoney(row.timing.entitlement)}</strong></td>
            <td class="money">${formatMoney(row.timing.closingCash)}</td>
            <td class="money">${formatMoney(row.deferred)}</td>
            <td class="money">${formatMoney(row.timing.expectedPresentValue)}</td>
            <td class="money">${formatPercent(share)}</td>
          </tr>`;
        }).join("")}</tbody>
        <tfoot><tr><td>Total</td><td></td><td>${formatMoney(preferenceTotal)}</td><td>${formatMoney(Object.values(waterfall.participationPaid).reduce((sum, value) => sum + value, 0))}</td><td>${formatMoney(rows.reduce((sum, row) => sum + row.timing.entitlement, 0))}</td><td>${formatMoney(rows.reduce((sum, row) => sum + row.timing.closingCash, 0))}</td><td>${formatMoney(rows.reduce((sum, row) => sum + row.deferred, 0))}</td><td>${formatMoney(rows.reduce((sum, row) => sum + row.timing.expectedPresentValue, 0))}</td><td>100.00%</td></tr></tfoot>
      </table></div>
    </section>`;
}

function renderConsiderationSchedule(rows) {
  const active = state.tranches.filter((tranche) => Number(tranche.amount) > 0);
  if (!active.length) {
    return `<section class="result-section" aria-labelledby="schedule-title"><div class="section-title"><h3 id="schedule-title">Consideration schedule</h3><p>Clean acquisition</p></div><div class="alert success">All stakeholder proceeds are modeled as cash paid at closing.</div></section>`;
  }
  return `
    <section class="result-section" aria-labelledby="schedule-title">
      <div class="section-title"><h3 id="schedule-title">Consideration schedule</h3><p>Face value and probability-weighted present value</p></div>
      <div class="table-wrap"><table>
        <thead><tr><th scope="col">Tranche</th><th scope="col">Form</th><th scope="col">Face amount</th><th scope="col">Price treatment</th><th scope="col">Eligible group</th><th scope="col">Expected realization</th><th scope="col">Timing</th><th scope="col">Expected PV</th></tr></thead>
        <tbody>${active.map((tranche) => {
          const allocated = rows.reduce((sum, row) => sum + (row.timing.tranches[tranche.id] || 0), 0);
          const pv = allocated * (Number(tranche.expectedPercent) || 0) / 100 / ((1 + (Number(state.deal.discountRate) || 0) / 100) ** (Number(tranche.years) || 0));
          return `<tr><td><strong>${escapeHtml(tranche.label)}</strong></td><td>${escapeHtml(labelForType(tranche.type))}</td><td class="money">${formatMoney(allocated)}</td><td>${tranche.treatment === "incremental" ? "Incremental" : "Included"}</td><td>${escapeHtml(labelForEligibility(tranche.eligibility))}</td><td class="money">${Number(tranche.expectedPercent).toFixed(0)}%</td><td class="money">${Number(tranche.years).toFixed(2)} years</td><td class="money">${formatMoney(pv)}</td></tr>`;
        }).join("")}</tbody>
      </table></div>
    </section>`;
}

function renderSensitivity() {
  const cases = [0.5, 0.75, 1, 1.25, 1.5, 2];
  return `
    <section class="result-section" aria-labelledby="sensitivity-title">
      <div class="section-title"><h3 id="sensitivity-title">Enterprise-value sensitivity</h3><p>All other bridge, security, and timing assumptions held constant</p></div>
      <div class="table-wrap"><table>
        <thead><tr><th scope="col">EV case</th><th scope="col">Enterprise value</th><th scope="col">Equity value</th><th scope="col">Implied common / share</th><th scope="col">Cash at close</th></tr></thead>
        <tbody>${cases.map((multiple) => {
          const deal = { ...state.deal, enterpriseValue: Number(state.deal.enterpriseValue) * multiple };
          const equity = computeEquityBridge(deal).equityValue + incrementalConsideration();
          const waterfall = computeWaterfall(state.stakeholders, equity);
          const timing = allocateConsideration(state.stakeholders, waterfall.payouts, state.tranches, state.deal.discountRate);
          const close = Object.values(timing.results).reduce((sum, row) => sum + row.closingCash, 0);
          return `<tr><td class="money">${multiple.toFixed(2)}×</td><td class="money">${formatMoney(deal.enterpriseValue)}</td><td class="money">${formatMoney(equity)}</td><td class="money">${formatMoney(waterfall.pricePerShare)}</td><td class="money">${formatMoney(close)}</td></tr>`;
        }).join("")}</tbody>
      </table></div>
    </section>`;
}

function renderMethodology(waterfall) {
  const activePrefs = state.stakeholders.filter((holder) => ["preferred", "safe", "note"].includes(holder.securityType) && (Number(holder.preferenceMultiple) > 0 || Number(holder.secondaryPreferenceMultiple) > 0 || Number(holder.accruedDividend) > 0 || Number(holder.dividendRate) > 0));
  const tiers = [...new Set(activePrefs.map((holder) => Number(holder.seniority)))].sort((a, b) => a - b);
  return `
    <section class="result-section" aria-labelledby="method-title">
      <div class="section-title"><h3 id="method-title">Method and active mechanics</h3><p>Deterministic, client-side calculation</p></div>
      <div class="sources">
        <div class="source-row"><strong>Priority and pari passu</strong><p>${tiers.length ? `Active preference tiers: ${tiers.join(", ")}. Claims in the same tier share an underfunded tier pro rata; lower-priority tiers receive only what remains.` : "No liquidation preference claim is active. All eligible common equivalents share residual value."}</p></div>
        <div class="source-row"><strong>Conversion elections</strong><p>${waterfall.stableElection ? "Elective preferred classes are solved across all conversion combinations; a class takes preference only when it cannot improve by converting while other elections remain fixed." : "No fully stable election set was found; the lowest-regret combination is shown and should be reviewed."}</p></div>
        <div class="source-row"><strong>Options and warrants</strong><p>Cash-out equals eligible instruments multiplied by the positive spread between implied common value and strike. Out-of-the-money instruments receive zero.</p></div>
        <div class="source-row"><strong>Ratchets</strong><p>Full ratchet resets the conversion price to the down-round price. Weighted average uses CP2 = CP1 × (A + B) / (A + C), with B equal to new money divided by CP1 and C equal to new money divided by the down-round price.</p></div>
        <div class="source-row"><strong>Dividends, split claims and waivers</strong><p>Fixed, simple or compounded cumulative dividends can increase preference claims. A class can split its claim across two priority tiers; prior distributions and pay-to-play or negotiated waivers reduce claims before allocation.</p></div>
        <div class="source-row"><strong>Timing and contingent value</strong><p>Stock, escrows, notes, earnouts and rollover replace cash at close for eligible holders. A tranche can be included in the bridge or incremental to it. Expected PV applies the model discount rate and each tranche’s realization probability.</p></div>
      </div>
    </section>`;
}

function renderSources() {
  const sources = state.meta?.sources || [];
  if (!sources.length) return "";
  return `
    <section class="result-section" aria-labelledby="sources-title">
      <div class="section-title"><h3 id="sources-title">Preset sources and assumptions</h3><p>${escapeHtml(state.meta.asOf || "")}</p></div>
      <div class="sources">${sources.map((source) => `<div class="source-row"><a href="${escapeAttribute(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.label)}</a><p>${escapeHtml(source.note)}</p></div>`).join("")}</div>
    </section>`;
}

function buildWarnings(bridge, waterfall, consideration) {
  const warnings = [];
  if (bridge.rawEquityValue < 0) warnings.push({ tone: "danger", text: "Bridge deductions exceed enterprise value plus available cash; distributable equity has been floored at zero." });
  if (waterfall.unallocated > 1) warnings.push({ tone: "danger", text: `${formatMoney(waterfall.unallocated)} remains unallocated because no eligible claim or common-equivalent security can receive it.` });
  waterfall.warnings.forEach((text) => warnings.push({ tone: "danger", text }));
  consideration.warnings.forEach((text) => warnings.push({ text }));
  const ids = state.stakeholders.map((holder) => holder.id);
  if (new Set(ids).size !== ids.length) warnings.push({ tone: "danger", text: "Stakeholder IDs must be unique. Re-import the model or remove duplicate rows." });
  const ratchets = state.stakeholders.filter((holder) => ["preferred", "safe", "note"].includes(holder.securityType) && holder.ratchetType !== "none");
  ratchets.forEach((holder) => {
    const multiplier = ratchetMultiplier(holder);
    if (multiplier > 1.0001) warnings.push({ text: `${holder.name} anti-dilution increases its as-converted shares by ${multiplier.toFixed(3)}×.` });
  });
  return warnings;
}

function inputField({ label, hint, value, inputType, scope, field, wide = false }) {
  const type = inputType === "text" ? "text" : "text";
  const display = inputType === "money" || inputType === "shares" ? compactInput(value) : String(value ?? "");
  const inputMode = inputType === "text" ? "text" : "decimal";
  return `<label class="field ${wide ? "wide" : ""}"><span>${escapeHtml(label)}</span><input type="${type}" inputmode="${inputMode}" value="${escapeAttribute(display)}" data-scope="${scope}" data-field="${field}" data-value-type="${inputType}"><span class="field-hint">${escapeHtml(hint)}</span></label>`;
}

function indexedField(index, scope, field, label, value, inputType, wide = false) {
  const display = inputType === "money" || inputType === "shares" ? compactInput(value) : String(value ?? "");
  return `<label class="field ${wide ? "wide" : ""}"><span>${escapeHtml(label)}</span><input type="text" inputmode="${inputType === "text" ? "text" : "decimal"}" value="${escapeAttribute(display)}" data-scope="${scope}" data-index="${index}" data-field="${field}" data-value-type="${inputType}"></label>`;
}

function selectField(index, scope, field, label, value, options) {
  return `<label class="field"><span>${escapeHtml(label)}</span><select data-scope="${scope}" data-index="${index}" data-field="${field}" data-value-type="select">${options.map(([optionValue, optionLabel]) => `<option value="${escapeAttribute(optionValue)}" ${optionValue === value ? "selected" : ""}>${escapeHtml(optionLabel)}</option>`).join("")}</select></label>`;
}

function checkboxField(index, field, label, checked) {
  return `<label class="check-field"><input type="checkbox" data-scope="stakeholder" data-index="${index}" data-field="${field}" data-value-type="boolean" ${checked ? "checked" : ""}><span>${escapeHtml(label)}</span></label>`;
}

function metric(label, value) {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

controls.addEventListener("input", handleControlUpdate);
controls.addEventListener("change", (event) => {
  handleControlUpdate(event);
  if (event.target.matches("select, input[type='checkbox']")) renderControls();
});

function handleControlUpdate(event) {
  const target = event.target;
  const { scope, field, valueType, index } = target.dataset;
  if (!scope || !field) return;
  let value = target.value;
  if (valueType === "boolean") value = target.checked;
  else if (["money", "shares", "number", "percent"].includes(valueType)) value = parseCompact(value);

  if (scope === "deal") state.deal[field] = value;
  if (scope === "tranche") state.tranches[Number(index)][field] = value;
  if (scope === "stakeholder") state.stakeholders[Number(index)][field] = value;
  state.meta = { ...(state.meta || {}), preset: "custom", title: "Custom model", description: "Edited transaction model" };
  renderResults();
  saveState();
}

controls.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const index = Number(button.dataset.index);
  if (button.dataset.action === "add-stakeholder") state.stakeholders.push(blankStakeholder(uniqueId("holder")));
  if (button.dataset.action === "remove-stakeholder") state.stakeholders.splice(index, 1);
  if (button.dataset.action === "add-tranche") state.tranches.push(blankTranche(uniqueId("tranche")));
  if (button.dataset.action === "remove-tranche") state.tranches.splice(index, 1);
  state.meta = { ...(state.meta || {}), preset: "custom", title: "Custom model", description: "Edited transaction model" };
  renderAll();
});

presetSelect.addEventListener("change", () => {
  state = clonePreset(presetSelect.value);
  renderAll();
});

document.querySelector("#reset-button").addEventListener("click", () => {
  const preset = state.meta?.preset in PRESETS ? state.meta.preset : presetSelect.value;
  state = clonePreset(preset);
  renderAll();
});

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

function countActiveTranches() {
  return state.tranches.filter((tranche) => Number(tranche.amount) > 0).length;
}

function incrementalConsideration() {
  return state.tranches.reduce(
    (sum, tranche) => sum + (tranche.treatment === "incremental" ? Math.max(0, Number(tranche.amount) || 0) : 0),
    0,
  );
}

function uniqueId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function parseCompact(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value).trim().toLowerCase().replace(/[,$%×\s]/g, "");
  const match = cleaned.match(/^(-?(?:\d+\.?\d*|\.\d+))([kmbt])?$/);
  if (!match) return 0;
  const multiplier = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 }[match[2]] || 1;
  return Number(match[1]) * multiplier;
}

function compactInput(value) {
  const amount = Number(value) || 0;
  const abs = Math.abs(amount);
  const units = [[1e12, "t"], [1e9, "b"], [1e6, "m"], [1e3, "k"]];
  for (const [threshold, suffix] of units) {
    if (abs >= threshold && Math.abs(amount / threshold) < 10000) return `${trimZeros(amount / threshold)}${suffix}`;
  }
  return trimZeros(amount);
}

function formatMoney(value) {
  const amount = Number(value) || 0;
  const sign = amount < 0 ? "−" : "";
  const abs = Math.abs(amount);
  const units = [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]];
  for (const [threshold, suffix] of units) {
    if (abs >= threshold) return `${sign}$${trimZeros(abs / threshold, abs / threshold < 10 ? 2 : 1)}${suffix}`;
  }
  return `${sign}$${Math.round(abs).toLocaleString()}`;
}

function formatShares(value) {
  const amount = Number(value) || 0;
  if (Math.abs(amount) >= 1e9) return `${trimZeros(amount / 1e9, 2)}B shares`;
  if (Math.abs(amount) >= 1e6) return `${trimZeros(amount / 1e6, 2)}M shares`;
  if (Math.abs(amount) >= 1e3) return `${trimZeros(amount / 1e3, 1)}K shares`;
  return `${Math.round(amount).toLocaleString()} shares`;
}

function formatPercent(value) {
  return `${((Number(value) || 0) * 100).toFixed(2)}%`;
}

function trimZeros(value, digits = 4) {
  return Number(value).toFixed(digits).replace(/\.?0+$/, "");
}

function labelForSecurity(value) {
  return { common: "Common stock", preferred: "Preferred stock", safe: "SAFE", note: "Convertible note", rsu: "RSU / restricted stock", option: "Option", warrant: "Warrant" }[value] || value;
}

function labelForParticipation(value) {
  return { none: "Non-participating", full: "Fully participating", capped: "Capped participation" }[value] || value;
}

function labelForType(value) {
  return { stock: "Buyer stock", escrow: "Escrow / holdback", note: "Seller note", earnout: "Earnout", rollover: "Rollover equity", other: "Other" }[value] || value;
}

function labelForEligibility(value) {
  return { all: "All holders", escrow: "Escrow-eligible", deferred: "Deferred-eligible" }[value] || value;
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "exit-waterfall";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

renderAll();
