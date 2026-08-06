import assert from "node:assert/strict";
import { allocateConsideration, applySharedTerms, computeEquityBridge, computeWaterfall, ratchetMultiplier } from "../waterfall-engine.js";
import { clonePreset } from "../presets.js";

const common = (id, shares) => ({ id, name: id, securityType: "common", shares, eligiblePercent: 100 });
const preferred = (id, shares, invested, seniority, extra = {}) => ({
  id,
  name: id,
  securityType: "preferred",
  shares,
  eligiblePercent: 100,
  invested,
  preferenceMultiple: 1,
  seniority,
  participation: "none",
  ...extra,
});

{
  const bridge = computeEquityBridge({
    enterpriseValue: 100,
    cash: 10,
    debt: 20,
    debtLike: 2,
    workingCapital: -1,
    transactionFees: 3,
    bonuses: 1,
    transferTaxes: 0,
    otherAdjustment: 2,
  });
  assert.equal(bridge.equityValue, 85);
}

{
  assert.equal(ratchetMultiplier({ ratchetType: "full-ratchet", originalPrice: 4, downRoundPrice: 2 }), 2);
  const weighted = ratchetMultiplier({
    ratchetType: "weighted-average",
    originalPrice: 4,
    downRoundPrice: 2,
    preRoundShares: 100,
    newMoney: 40,
  });
  assert.ok(weighted > 1 && weighted < 2);
}

{
  const result = computeWaterfall([common("founders", 80), preferred("series-a", 20, 20, 1)], 100);
  assert.ok(Math.abs(result.payouts["series-a"] - 20) < 0.01);
  assert.equal(result.choiceById["series-a"], "convert");
  assert.ok(Math.abs(result.totalPayout - 100) < 0.01);
}

{
  const result = computeWaterfall(
    [common("founders", 80), preferred("series-a", 20, 40, 1)],
    50,
  );
  assert.ok(Math.abs(result.payouts["series-a"] - 40) < 0.01);
  assert.ok(Math.abs(result.payouts.founders - 10) < 0.01);
  assert.equal(result.choiceById["series-a"], "preference");
}

{
  const result = computeWaterfall(
    [common("founders", 80), preferred("senior", 10, 30, 1), preferred("junior", 10, 30, 2)],
    40,
  );
  assert.ok(Math.abs(result.payouts.senior - 30) < 0.01);
  assert.ok(Math.abs(result.payouts.junior - 10) < 0.01);
  assert.ok(Math.abs(result.payouts.founders) < 0.01);
}

{
  const result = computeWaterfall(
    [
      preferred("pari-a", 0, 30, 1, { conversionPolicy: "force-preference" }),
      preferred("pari-b", 0, 30, 1, { conversionPolicy: "force-preference" }),
    ],
    30,
  );
  assert.equal(result.payouts["pari-a"], 15);
  assert.equal(result.payouts["pari-b"], 15);
}

{
  const result = computeWaterfall(
    [
      preferred("split", 0, 10, 1, { secondaryPreferenceMultiple: 1, secondarySeniority: 2, conversionPolicy: "force-preference" }),
      preferred("junior", 0, 10, 2, { conversionPolicy: "force-preference" }),
    ],
    20,
  );
  assert.equal(result.payouts.split, 15);
  assert.equal(result.payouts.junior, 5);
}

{
  const result = computeWaterfall(
    [
      {
        ...preferred("safe", 0, 10, 1, { conversionPolicy: "force-preference" }),
        securityType: "safe",
        dividendType: "simple",
        dividendRate: 10,
        dividendYears: 2,
      },
    ],
    20,
  );
  assert.equal(result.payouts.safe, 12);
  assert.equal(result.unallocated, 8);
}

{
  const result = computeWaterfall(
    [preferred("waived", 0, 10, 1, { conversionPolicy: "force-preference", waiverPercent: 50, priorDistributions: 2 })],
    10,
  );
  assert.equal(result.payouts.waived, 3);
  assert.equal(result.unallocated, 7);
}

{
  const result = computeWaterfall(
    [
      common("founders", 80),
      preferred("participating", 20, 10, 1, { participation: "capped", capMultiple: 2 }),
    ],
    100,
  );
  assert.ok(Math.abs(result.payouts.participating - 20) < 0.01);
  assert.ok(Math.abs(result.payouts.founders - 80) < 0.01);
}

{
  const clean = clonePreset("clean");
  const bridge = computeEquityBridge(clean.deal);
  const result = computeWaterfall(clean.stakeholders, bridge.equityValue);
  assert.equal(bridge.equityValue, 100_000_000);
  assert.equal(result.payouts.founders, 80_000_000);
  assert.equal(result.payouts["series-a"], 20_000_000);
  assert.equal(clean.tranches.every((tranche) => tranche.amount === 0), true);
  assert.equal(clean.terms.liquidationPreference, false);
  assert.equal(clean.terms.pariPassu, false);
  assert.equal(clean.terms.optimalConversion, true);
}

{
  const holders = [
    { ...preferred("series-a", 20, 20, 2), displayOrder: 1, useSharedTerms: true },
    { ...preferred("series-b", 20, 20, 1), displayOrder: 2, useSharedTerms: true },
  ];
  const cleanTerms = applySharedTerms(holders, {
    liquidationPreference: false,
    pariPassu: false,
    escrowEligibleAll: true,
    deferredEligibleAll: true,
  });
  assert.equal(cleanTerms.every((holder) => holder.preferenceMultiple === 0 && holder.conversionPolicy === "force-convert"), true);

  const stackedTerms = applySharedTerms(holders, {
    liquidationPreference: true,
    preferenceMultiple: 1,
    pariPassu: false,
    optimalConversion: true,
    escrowEligibleAll: true,
    deferredEligibleAll: true,
  });
  assert.deepEqual(stackedTerms.map((holder) => holder.seniority), [2, 1]);

  const pariTerms = applySharedTerms(holders, {
    liquidationPreference: true,
    preferenceMultiple: 1,
    pariPassu: true,
    optimalConversion: true,
    escrowEligibleAll: true,
    deferredEligibleAll: true,
  });
  assert.equal(pariTerms.every((holder) => holder.seniority === 1), true);
  assert.equal(pariTerms.every((holder) => holder.conversionPolicy === "elective"), true);

  holders[0].useSharedTerms = false;
  holders[0].preferenceEnabled = false;
  const mixedTerms = applySharedTerms(holders, {
    liquidationPreference: true,
    preferenceMultiple: 2,
    pariPassu: true,
    escrowEligibleAll: true,
    deferredEligibleAll: true,
  });
  assert.equal(mixedTerms[0].preferenceMultiple, 0);
  assert.equal(mixedTerms[1].preferenceMultiple, 2);
}

{
  const airtable = clonePreset("airtable");
  const bridge = computeEquityBridge(airtable.deal);
  const result = computeWaterfall(airtable.stakeholders, bridge.equityValue);
  const timing = allocateConsideration(airtable.stakeholders, result.payouts, airtable.tranches, airtable.deal.discountRate);
  const stock = Object.values(timing.results).reduce((sum, row) => sum + (row.tranches["buyer-stock"] || 0), 0);
  const cash = Object.values(timing.results).reduce((sum, row) => sum + row.closingCash, 0);
  assert.equal(bridge.equityValue, 2_227_500_000);
  assert.ok(Math.abs(result.pricePerShare - 37.9251117718) < 0.0001);
  assert.ok(Math.abs(result.payouts["series-f"] - 158_965_874.52) < 0.01);
  assert.equal(stock, 0);
  assert.ok(Math.abs(cash - 2_193_250_000) < 0.01);
  assert.equal(airtable.stakeholders.reduce((sum, holder) => sum + holder.shares, 0), 58_734_171);
  assert.equal(airtable.stakeholders.filter((holder) => holder.securityType === "preferred").every((holder) => holder.preferenceMultiple === 0), true);
  assert.equal(airtable.terms.pariPassu, false);
  assert.equal(airtable.terms.optimalConversion, true);
  assert.equal(airtable.peopleCohorts.length, 8);
  assert.equal(airtable.stakeholders.find((holder) => holder.id === "series-f").seniority, 1);
  assert.equal(airtable.stakeholders.find((holder) => holder.id === "seed").seniority, 7);
}

{
  const brex = clonePreset("brex");
  const bridge = computeEquityBridge(brex.deal);
  const result = computeWaterfall(brex.stakeholders, bridge.equityValue);
  const timing = allocateConsideration(brex.stakeholders, result.payouts, brex.tranches, brex.deal.discountRate);
  const stock = Object.values(timing.results).reduce((sum, row) => sum + (row.tranches["buyer-stock"] || 0), 0);
  const cash = Object.values(timing.results).reduce((sum, row) => sum + row.closingCash, 0);
  assert.equal(bridge.equityValue, 4_460_000_000);
  assert.ok(Math.abs(result.pricePerShare - 44.84) < 0.0001);
  assert.ok(Math.abs(result.payouts.options - 334_720_000) < 0.01);
  assert.ok(Math.abs(stock - 1_900_000_000) < 0.01);
  assert.ok(Math.abs(cash - 2_560_000_000) < 0.01);
  assert.deepEqual([...new Set(brex.stakeholders.map((holder) => holder.className))].sort(), ["Common stock", "Options", "RSUs / restricted stock"]);
}

{
  const result = computeWaterfall([], 100);
  assert.equal(result.totalPayout, 0);
  assert.equal(result.unallocated, 100);
}

{
  const result = computeWaterfall(
    [common("founders", 100), { id: "options", name: "Options", securityType: "option", shares: 20, strike: 2, eligiblePercent: 100 }],
    1000,
  );
  assert.ok(result.pricePerShare > 8 && result.pricePerShare < 9);
  assert.ok(Math.abs(result.totalPayout - 1000) < 0.01);
}

{
  const holders = [
    { ...common("a", 50), escrowEligible: true, deferredEligible: true },
    { ...common("b", 50), escrowEligible: false, deferredEligible: false },
  ];
  const allocated = allocateConsideration(
    holders,
    { a: 50, b: 50 },
    [{ id: "escrow", label: "Escrow", amount: 20, eligibility: "escrow", expectedPercent: 90, years: 1 }],
    10,
  );
  assert.equal(allocated.results.a.closingCash, 30);
  assert.equal(allocated.results.b.closingCash, 50);
  assert.ok(Math.abs(allocated.results.a.expectedPresentValue - (30 + 20 * 0.9 / 1.1)) < 0.01);
}

console.log("engine tests passed");
