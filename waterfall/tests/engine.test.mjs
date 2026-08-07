import assert from "node:assert/strict";
import { allocateConsideration, applySharedTerms, computeEquityBridge, computePeopleCohortOutcome, computeWaterfall, ratchetMultiplier } from "../waterfall-engine.js";
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
  const outcome = computePeopleCohortOutcome({
    equityType: "option",
    grantShares: 100,
    eligiblePercent: 100,
    exercisedPercent: 25,
    recoveryFloorMultiple: 1,
    strike: 10,
  }, 5);
  assert.equal(outcome.exercisedShares, 25);
  assert.equal(outcome.unexercisedShares, 75);
  assert.equal(outcome.initialInvestment, 250);
  assert.equal(outcome.equityProceeds, 125);
  assert.equal(outcome.makeWhole, 125);
  assert.equal(outcome.expectedValue, 250);
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
  assert.equal(result.payouts.founders, 60_000_000);
  assert.equal(result.payouts.employees, 20_000_000);
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
  const holders = applySharedTerms(airtable.stakeholders, airtable.terms);
  const result = computeWaterfall(holders, bridge.equityValue);
  const timing = allocateConsideration(holders, result.payouts, airtable.tranches, airtable.deal.discountRate);
  const stock = Object.values(timing.results).reduce((sum, row) => sum + (row.tranches["buyer-stock"] || 0), 0);
  const cash = Object.values(timing.results).reduce((sum, row) => sum + row.closingCash, 0);
  assert.equal(bridge.equityValue, 2_250_000_000);
  assert.ok(Math.abs(result.pricePerShare - 18.9375507528) < 0.0001);
  assert.ok(Math.abs(result.payouts["series-f"] - 785_016_654) < 0.01);
  assert.equal(stock, 0);
  assert.ok(Math.abs(cash - 2_250_000_000) < 0.01);
  assert.equal(airtable.stakeholders.reduce((sum, holder) => sum + holder.shares, 0), 58_734_171);
  assert.equal(airtable.terms.liquidationPreference, true);
  assert.equal(airtable.terms.pariPassu, true);
  assert.equal(airtable.terms.optimalConversion, true);
  assert.equal(airtable.peopleCohorts.length, 8);
  assert.equal(airtable.stakeholders.find((holder) => holder.id === "founders").shares, 12_000_000);
  assert.equal(airtable.stakeholders.find((holder) => holder.id === "employee-common").shares, 9_981_692);
  assert.equal(airtable.stakeholders.filter((holder) => ["founder", "employee"].includes(holder.category)).reduce((sum, holder) => sum + holder.shares, 0), 22_649_087);
  assert.equal(airtable.stakeholders.find((holder) => holder.id === "series-ff").category, "founder");
  assert.equal(airtable.stakeholders.find((holder) => holder.id === "series-ff").securityType, "common");
  assert.equal(airtable.peopleCohorts.find((cohort) => cohort.id === "series-f-employee").strike, 32.79);
  assert.equal(airtable.peopleCohorts.find((cohort) => cohort.id === "series-f-employee").exercisedPercent, 50);
  assert.equal(airtable.peopleCohorts.find((cohort) => cohort.id === "growth-employee").strike, 62.64);
  assert.equal(airtable.peopleCohorts.find((cohort) => cohort.id === "growth-employee").exercisedPercent, 25);
  assert.equal(airtable.peopleCohorts.find((cohort) => cohort.id === "growth-employee").recoveryFloorMultiple, 1);
  assert.equal(airtable.peopleCohorts.every((cohort) => cohort.transactionBonus === 0 && cohort.retentionBonus === 0 && cohort.accelerationPercent === 0), true);
  assert.equal(airtable.stakeholders.find((holder) => holder.id === "series-f").seniority, 1);
  assert.equal(airtable.stakeholders.find((holder) => holder.id === "seed").seniority, 1);
  const exercisedSeriesF = computePeopleCohortOutcome(airtable.peopleCohorts.find((cohort) => cohort.id === "series-f-employee"), result.pricePerShare, airtable.deal.discountRate);
  assert.equal(exercisedSeriesF.exercisedShares, 50_000);
  assert.equal(exercisedSeriesF.exerciseCost, 1_639_500);
  assert.ok(Math.abs(exercisedSeriesF.equityProceeds - 946_877.54) < 0.01);
  assert.ok(Math.abs(exercisedSeriesF.makeWhole - 692_622.46) < 0.01);
  assert.equal(exercisedSeriesF.expectedValue, 1_639_500);
}

{
  const brex = clonePreset("brex");
  const bridge = computeEquityBridge(brex.deal);
  const holders = applySharedTerms(brex.stakeholders, brex.terms);
  const result = computeWaterfall(holders, bridge.equityValue);
  const timing = allocateConsideration(holders, result.payouts, brex.tranches, brex.deal.discountRate);
  const stock = Object.values(timing.results).reduce((sum, row) => sum + (row.tranches["buyer-stock"] || 0), 0);
  const cash = Object.values(timing.results).reduce((sum, row) => sum + row.closingCash, 0);
  assert.equal(bridge.equityValue, 4_488_578_332);
  assert.ok(Math.abs(result.pricePerShare - 11.5294536062) < 0.0001);
  assert.ok(Math.abs(result.payouts["brex-d"] - 420_080_000) < 0.01);
  assert.ok(Math.abs(result.payouts["brex-d2"] - 300_000_000) < 0.01);
  assert.ok(Math.abs(stock - 1_928_578_332) < 0.01);
  assert.ok(Math.abs(cash - 2_560_000_000) < 0.01);
  assert.equal(brex.stakeholders.reduce((sum, holder) => sum + holder.shares, 0), 354_100_003);
  assert.equal(brex.peopleCohorts.length, 8);
  assert.equal(brex.peopleCohorts.find((cohort) => cohort.id === "brex-series-d2-employee").strike, 30);
  assert.equal(brex.peopleCohorts.find((cohort) => cohort.id === "brex-series-d2-employee").exercisedPercent, 50);
  assert.equal(brex.stakeholders.filter((holder) => holder.securityType === "preferred").length, 6);
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
