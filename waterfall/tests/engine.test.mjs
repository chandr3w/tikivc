import assert from "node:assert/strict";
import { allocateConsideration, allocateExitConsideration, applySharedTerms, comparisonBarWidth, computeAnnualizedIrr, computeEquityBridge, computeExitModel, computeInvestorAttribution, computePeopleCohortOutcome, computeWaterfall, ratchetMultiplier } from "../waterfall-engine.js";
import { PRESETS, applySecurityTypeDefaults, blankStakeholder, clonePreset } from "../presets.js";

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
      preferred("split", 0, 10, 3, { secondaryPreferenceMultiple: 1, secondarySeniority: 1, priorDistributions: 5, conversionPolicy: "force-preference" }),
      preferred("other-senior", 0, 10, 1, { conversionPolicy: "force-preference" }),
    ],
    15,
  );
  assert.equal(result.payouts.split, 5);
  assert.equal(result.payouts["other-senior"], 10);
}

{
  const counted = computeWaterfall([
    preferred("capped", 100, 10, 1, {
      conversionPolicy: "force-preference",
      participation: "capped",
      capMultiple: 2,
      paidDividends: 5,
      dividendsCountTowardCap: true,
    }),
    common("common", 1),
  ], 100);
  assert.equal(counted.payouts.capped, 15);
  assert.equal(counted.payouts.common, 85);
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
  const holders = [
    common("common", 100),
    { ...preferred("note", 0, 50, 1, { conversionPolicy: "force-preference" }), securityType: "note", useSharedTerms: true },
    { ...preferred("safe", 0, 30, 1, { conversionPolicy: "force-preference" }), securityType: "safe", useSharedTerms: true },
    { ...preferred("preferred", 0, 40, 1, { conversionPolicy: "force-preference" }), securityType: "preferred", useSharedTerms: true },
  ];
  const shared = applySharedTerms(holders, {
    liquidationPreference: true,
    preferenceMultiple: 1,
    pariPassu: true,
    optimalConversion: false,
    escrowEligibleAll: true,
    deferredEligibleAll: true,
  });
  assert.equal(shared.find((holder) => holder.id === "note").seniority, 1);
  assert.equal(shared.find((holder) => holder.id === "safe").seniority, 2);
  assert.equal(shared.find((holder) => holder.id === "preferred").seniority, 2);
  const result = computeWaterfall(shared, 60);
  assert.equal(result.payouts.note, 50);
  assert.ok(Math.abs(result.payouts.safe - 30 / 70 * 10) < 0.01);
  assert.ok(Math.abs(result.payouts.preferred - 40 / 70 * 10) < 0.01);

  const preferenceOff = applySharedTerms(holders, {
    liquidationPreference: false,
    pariPassu: false,
    escrowEligibleAll: true,
    deferredEligibleAll: true,
  });
  assert.equal(preferenceOff.find((holder) => holder.id === "note").preferenceMultiple, 1);
  assert.equal(preferenceOff.find((holder) => holder.id === "safe").preferenceMultiple, 1);
  assert.equal(preferenceOff.find((holder) => holder.id === "preferred").preferenceMultiple, 0);
}

{
  const holders = [
    {
      ...preferred("converted-note", 10, 10, 5, { conversionPolicy: "force-convert" }),
      securityType: "note",
      useSharedTerms: false,
      preferenceEnabled: false,
    },
    { ...preferred("shared-preferred", 10, 10, 3), useSharedTerms: true },
  ];
  const shared = applySharedTerms(holders, {
    liquidationPreference: true,
    preferenceMultiple: 1,
    pariPassu: true,
    optimalConversion: true,
    escrowEligibleAll: true,
    deferredEligibleAll: true,
  });
  assert.equal(shared.find((holder) => holder.id === "converted-note").preferenceMultiple, 0);
  assert.equal(shared.find((holder) => holder.id === "shared-preferred").seniority, 1);
}

{
  const holder = {
    ...preferred("forced-conversion", 100, 100, 1),
    useSharedTerms: false,
    preferenceEnabled: true,
    conversionPolicy: "force-convert",
  };
  const [effective] = applySharedTerms([holder], {});
  assert.equal(effective.preferenceMultiple, 1);
  assert.equal(effective.conversionPolicy, "force-convert");
  const result = computeWaterfall([common("common", 100), effective], 50);
  assert.equal(result.choiceById["forced-conversion"], "convert");
}

{
  const offTerms = {
    liquidationPreference: false,
    pariPassu: false,
    escrowEligibleAll: true,
    deferredEligibleAll: true,
  };
  const safe = applySecurityTypeDefaults(blankStakeholder("safe-from-ui"), "safe");
  safe.invested = 30;
  safe.shares = 0;
  const safeResult = computeWaterfall(applySharedTerms([common("safe-common", 100), safe], offTerms), 30);
  assert.equal(safeResult.payouts["safe-from-ui"], 30);

  const note = applySecurityTypeDefaults(blankStakeholder("note-from-ui"), "note");
  note.invested = 30;
  note.shares = 0;
  const noteResult = computeWaterfall(applySharedTerms([common("note-common", 100), note], offTerms), 30);
  assert.equal(noteResult.payouts["note-from-ui"], 30);
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
  assert.equal(airtable.stakeholders.find((holder) => holder.id === "series-e").roundSize, 270_000_000);
  assert.equal(airtable.stakeholders.find((holder) => holder.id === "series-e").invested, 334_998_949);
  assert.equal(airtable.stakeholders.find((holder) => holder.id === "series-f").roundSize, 735_000_000);
  assert.equal(airtable.stakeholders.find((holder) => holder.id === "series-f").invested, 785_016_654);
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

{
  assert.equal(comparisonBarWidth(0, 100), 0);
  assert.ok(Math.abs(comparisonBarWidth(100, 100) - 100) < 1e-9);
  assert.equal(comparisonBarWidth(1, 100), 10);
  assert.ok(comparisonBarWidth(25, 100) > comparisonBarWidth(10, 100));
}

{
  const zeroCheck = computeInvestorAttribution(
    { roundSize: 100, invested: 80, investorInvestment: 0 },
    { entitlement: 200, closingCash: 150 },
    50,
  );
  assert.equal(zeroCheck.roundSize, 100);
  assert.equal(zeroCheck.preferenceBasis, 80);
  assert.equal(zeroCheck.investment, 0);
  assert.equal(zeroCheck.fraction, 0);
  assert.equal(zeroCheck.investorExit, 0);
}

{
  const irr = computeAnnualizedIrr([
    { amount: -100, time: 0 },
    { amount: 200, time: 5 },
  ]);
  assert.ok(Math.abs(irr - (2 ** (1 / 5) - 1)) < 1e-10);
  assert.equal(computeAnnualizedIrr([{ amount: -100, time: 0 }]), null);
}

{
  const attributed = computeInvestorAttribution(
    { roundSize: 100, invested: 100, investorInvestment: 50, holdingPeriodYears: 4 },
    { entitlement: 200, closingCash: 120, tranches: { earnout: 80 }, expectedPresentValue: 180 },
    80,
    [{ id: "earnout", years: 2 }],
  );
  assert.equal(attributed.investorClosing, 60);
  assert.equal(attributed.investorTranches[0].amount, 40);
  assert.equal(attributed.irrCashFlows[2].time, 6);
  const npv = attributed.irrCashFlows.reduce((sum, flow) => sum + flow.amount / ((1 + attributed.grossIrr) ** flow.time), 0);
  assert.ok(Math.abs(npv) < 1e-8);
}

{
  const result = computeWaterfall([
    { ...common("excluded", 90), eligiblePercent: 0 },
    common("included", 10),
  ], 100);
  assert.equal(result.payouts.excluded, 0);
  assert.equal(result.payouts.included, 100);
}

{
  const holder = { ...preferred("series-a", 20, 20, 1), useSharedTerms: true };
  const zeroPreference = applySharedTerms([holder], {
    liquidationPreference: true,
    preferenceMultiple: 0,
    optimalConversion: true,
    escrowEligibleAll: true,
    deferredEligibleAll: true,
  });
  assert.equal(zeroPreference[0].preferenceMultiple, 0);

  const zeroCustomRatchet = applySharedTerms([holder], {
    liquidationPreference: false,
    antiDilution: true,
    ratchetType: "custom",
    conversionMultiplier: 0,
    escrowEligibleAll: true,
    deferredEligibleAll: true,
  });
  assert.equal(zeroCustomRatchet[0].conversionMultiplier, 0);
}

{
  const signs = {
    enterpriseValue: 1,
    cash: 1,
    debt: -1,
    debtLike: -1,
    workingCapital: 1,
    transactionFees: -1,
    bonuses: -1,
    transferTaxes: -1,
    otherAdjustment: 1,
  };
  for (const [field, sign] of Object.entries(signs)) {
    const model = clonePreset("clean");
    const baseline = computeExitModel(model).grossProceeds;
    model.deal[field] += 1_000_000;
    assert.equal(computeExitModel(model).grossProceeds - baseline, sign * 1_000_000, `${field} bridge dependency`);
  }
}

{
  const model = clonePreset("clean");
  model.tranches = [{
    id: "earnout",
    label: "Earnout",
    type: "earnout",
    amount: 10_000_000,
    treatment: "incremental",
    eligibility: "all",
    expectedPercent: 50,
    years: 2,
  }];
  model.deal.discountRate = 10;
  const result = computeExitModel(model);
  assert.equal(result.incremental, 10_000_000);
  assert.equal(result.grossProceeds, 110_000_000);
  assert.ok(Math.abs(result.rows.reduce((sum, row) => sum + row.timing.expectedPresentValue, 0) - (100_000_000 + 10_000_000 * 0.5 / 1.1 ** 2)) < 0.05);

  model.tranches[0].treatment = "included";
  const included = computeExitModel(model);
  assert.equal(included.incremental, 0);
  assert.equal(included.grossProceeds, 100_000_000);
  assert.ok(included.rows.reduce((sum, row) => sum + row.timing.expectedPresentValue, 0) < result.rows.reduce((sum, row) => sum + row.timing.expectedPresentValue, 0));
}

{
  const holders = [
    common("common", 50),
    preferred("preferred", 50, 60, 1),
  ];
  const { waterfall, closingWaterfall, consideration } = allocateExitConsideration(
    holders,
    50,
    [{
      id: "earnout",
      label: "Earnout",
      type: "earnout",
      amount: 50,
      treatment: "incremental",
      eligibility: "all",
      expectedPercent: 50,
      years: 0,
    }],
    0,
  );
  assert.equal(closingWaterfall.payouts.preferred, 50);
  assert.equal(closingWaterfall.payouts.common, 0);
  assert.equal(waterfall.payouts.preferred, 60);
  assert.equal(waterfall.payouts.common, 40);
  assert.equal(consideration.results.preferred.closingCash, 50);
  assert.equal(consideration.results.common.closingCash, 0);
  assert.equal(consideration.results.preferred.tranches.earnout, 10);
  assert.equal(consideration.results.common.tranches.earnout, 40);
  assert.equal(consideration.results.preferred.expectedPresentValue, 55);
  assert.equal(consideration.results.common.expectedPresentValue, 20);
}

{
  const holders = [
    common("common", 50),
    preferred("preferred", 50, 60, 1),
  ];
  const { waterfall, closingWaterfall, consideration } = allocateExitConsideration(
    holders,
    100,
    [{
      id: "escrow",
      label: "Escrow",
      type: "escrow",
      amount: 50,
      treatment: "included",
      allocationBasis: "cumulative",
      eligibility: "all",
      expectedPercent: 100,
      years: 1,
    }],
    0,
  );
  assert.equal(closingWaterfall.payouts.preferred, 50);
  assert.equal(closingWaterfall.payouts.common, 0);
  assert.equal(waterfall.payouts.preferred, 60);
  assert.equal(waterfall.payouts.common, 40);
  assert.equal(consideration.results.preferred.closingCash, 50);
  assert.equal(consideration.results.common.closingCash, 0);
  assert.equal(consideration.results.preferred.tranches.escrow, 10);
  assert.equal(consideration.results.common.tranches.escrow, 40);
}

{
  const holders = [
    common("common", 50),
    preferred("preferred", 50, 60, 1),
  ];
  const first = { id: "first", label: "First", amount: 25, treatment: "included", allocationBasis: "cumulative", eligibility: "all", expectedPercent: 100, years: 1 };
  const second = { id: "second", label: "Second", amount: 25, treatment: "included", allocationBasis: "cumulative", eligibility: "all", expectedPercent: 0, years: 1 };
  const forward = allocateExitConsideration(holders, 100, [first, second], 0);
  const reverse = allocateExitConsideration(holders, 100, [second, first], 0);
  for (const holder of holders) {
    assert.equal(forward.consideration.results[holder.id].expectedPresentValue, reverse.consideration.results[holder.id].expectedPresentValue);
    assert.equal(forward.consideration.results[holder.id].entitlement, reverse.consideration.results[holder.id].entitlement);
  }
  assert.equal(forward.consideration.results.preferred.entitlement, 60);
  assert.equal(forward.consideration.results.common.entitlement, 40);
}

{
  const holders = [
    common("common", 50),
    preferred("preferred", 50, 60, 1),
  ];
  const { closingWaterfall, consideration } = allocateExitConsideration(
    holders,
    100,
    [{
      id: "buyer-stock",
      label: "Buyer stock",
      type: "stock",
      amount: 50,
      treatment: "included",
      eligibility: "all",
      expectedPercent: 100,
      years: 0,
    }],
    0,
  );
  assert.equal(closingWaterfall.payouts.preferred, 60);
  assert.equal(closingWaterfall.payouts.common, 40);
  assert.equal(consideration.results.preferred.closingCash, 30);
  assert.equal(consideration.results.common.closingCash, 20);
  assert.equal(consideration.results.preferred.tranches["buyer-stock"], 30);
  assert.equal(consideration.results.common.tranches["buyer-stock"], 20);
}

{
  const base = {
    equityType: "option",
    grantShares: 100,
    strike: 2,
    eligiblePercent: 50,
    accelerationPercent: 50,
    exercisedPercent: 40,
    recoveryFloorMultiple: 1,
    transactionBonus: 50,
    retentionBonus: 121,
    retentionYears: 2,
  };
  const result = computePeopleCohortOutcome(base, 1, 10);
  assert.equal(result.vestedShares, 50);
  assert.equal(result.acceleratedShares, 25);
  assert.equal(result.eligibleShares, 75);
  assert.equal(result.exercisedShares, 20);
  assert.equal(result.unexercisedShares, 55);
  assert.equal(result.exerciseCost, 40);
  assert.equal(result.equityProceeds, 20);
  assert.equal(result.makeWhole, 20);
  assert.ok(Math.abs(result.retentionPresentValue - 100) < 1e-9);
  assert.ok(Math.abs(result.expectedValue - 190) < 1e-9);
}

{
  const elective = Array.from({ length: 13 }, (_, index) => preferred(`p-${index}`, 0, 1, 1));
  const result = computeWaterfall(elective, 13);
  assert.equal(result.electionMethod, "iterative");
  assert.equal(result.stableElection, true);
  assert.equal(result.unallocated, 0);
  elective.forEach((holder) => assert.equal(result.payouts[holder.id], 1));
}

{
  const holders = [
    { ...common("a", 50), escrowEligible: true, deferredEligible: true },
    { ...common("b", 50), escrowEligible: false, deferredEligible: true },
  ];
  const escrow = { id: "escrow", label: "Escrow", amount: 20, eligibility: "escrow", expectedPercent: 100, years: 1 };
  const deferred = { id: "deferred", label: "Deferred", amount: 20, eligibility: "deferred", expectedPercent: 100, years: 1 };
  const forward = allocateConsideration(holders, { a: 50, b: 50 }, [escrow, deferred], 0);
  const reverse = allocateConsideration(holders, { a: 50, b: 50 }, [deferred, escrow], 0);
  assert.equal(forward.results.a.closingCash, 20);
  assert.equal(forward.results.b.closingCash, 40);
  assert.deepEqual(forward.results, reverse.results);
}

{
  const holders = [
    { ...common("a", 50), escrowEligible: true },
    { ...common("b", 50), escrowEligible: false },
  ];
  const escrow = { id: "escrow", label: "Escrow", amount: 50, eligibility: "escrow", expectedPercent: 100, years: 1 };
  const stock = { id: "stock", label: "Stock", amount: 50, eligibility: "all", expectedPercent: 100, years: 0 };
  const result = allocateConsideration(holders, { a: 50, b: 50 }, [escrow, stock], 0);
  const reverse = allocateConsideration(holders, { a: 50, b: 50 }, [stock, escrow], 0);
  assert.equal(result.results.a.tranches.escrow, 50);
  assert.equal(result.results.b.tranches.stock, 50);
  assert.equal(result.results.a.closingCash, 0);
  assert.equal(result.results.b.closingCash, 0);
  assert.equal(result.warnings.length, 0);
  assert.deepEqual(result.results, reverse.results);
}

{
  const makeHolders = (ids) => [
    { ...common(ids[0], 1), escrowEligible: true, deferredEligible: false },
    { ...common(ids[1], 1), escrowEligible: true, deferredEligible: false },
    { ...common(ids[2], 1), escrowEligible: true, deferredEligible: true },
  ];
  const tranches = [
    { id: "t0", label: "All 1", amount: 12, eligibility: "all", expectedPercent: 80, years: 2 },
    { id: "t1", label: "All 2", amount: 50, eligibility: "all", expectedPercent: 67, years: 3 },
    { id: "t2", label: "Deferred", amount: 37, eligibility: "deferred", expectedPercent: 54, years: 3 },
  ];
  const firstIds = ["a", "b", "c"];
  const secondIds = ["c", "b", "a"];
  const first = allocateConsideration(makeHolders(firstIds), { a: 32, b: 73, c: 37 }, tranches, 10);
  const second = allocateConsideration(makeHolders(secondIds), { c: 32, b: 73, a: 37 }, tranches, 10);
  const expectedA = 62 * 32 / 105;
  const expectedB = 62 * 73 / 105;
  assert.ok(Math.abs(Object.values(first.results.a.tranches).reduce((sum, amount) => sum + amount, 0) - expectedA) < 0.02);
  assert.ok(Math.abs(Object.values(first.results.b.tranches).reduce((sum, amount) => sum + amount, 0) - expectedB) < 0.02);
  assert.equal(first.results.c.tranches.t2, 37);
  for (let index = 0; index < 3; index += 1) {
    const left = first.results[firstIds[index]];
    const right = second.results[secondIds[index]];
    assert.equal(left.closingCash, right.closingCash);
    assert.equal(left.expectedPresentValue, right.expectedPresentValue);
    assert.deepEqual(Object.values(left.tranches).sort((a, b) => a - b), Object.values(right.tranches).sort((a, b) => a - b));
  }
}

{
  const holders = [common("small", 1), common("large", 1)];
  const entitlements = { small: 0.18, large: 99.82 };
  const tranches = Array.from({ length: 8 }, (_, index) => ({ id: `rounding-${index}`, label: `Rounding ${index}`, amount: 12.5, eligibility: "all", expectedPercent: 100, years: 1 }));
  const result = allocateConsideration(holders, entitlements, tranches, 0);
  const paid = Object.values(result.results).reduce((sum, row) => sum + row.closingCash + Object.values(row.tranches).reduce((sub, amount) => sub + amount, 0), 0);
  assert.ok(Math.abs(paid - 100) < 1e-9);
  assert.ok(Object.values(result.results.small.tranches).reduce((sum, amount) => sum + amount, 0) <= 0.180000001);
  assert.ok(Object.values(result.results.large.tranches).reduce((sum, amount) => sum + amount, 0) <= 99.820000001);
}

{
  const holders = Array.from({ length: 100 }, (_, index) => common(`rounding-holder-${index}`, 1));
  const result = computeWaterfall(holders, 0.51);
  assert.equal(Object.values(result.payouts).every((amount) => amount >= 0), true);
  assert.ok(Math.abs(Object.values(result.payouts).reduce((sum, amount) => sum + amount, 0) - 0.51) < 1e-9);
}

{
  const model = clonePreset("venture");
  const result = computeExitModel(model);
  const effective = Object.fromEntries(result.effectiveStakeholders.map((holder) => [holder.id, holder]));
  assert.equal(effective.seed.preferenceMultiple, 1);
  assert.equal(effective.seed.participation, "none");
  assert.equal(effective["series-a"].participation, "capped");
  assert.equal(effective["series-b1"].preferenceMultiple, 2);
  assert.equal(effective["series-b1"].ratchetType, "weighted-average");
  assert.equal(effective["series-b2"].preferenceMultiple, 2);
  assert.equal(effective["series-b2"].ratchetType, "none");
}

{
  const model = clonePreset("clean");
  model.deal.enterpriseValue = 20;
  model.stakeholders = [common("common", 100), {
    ...preferred("split", 0, 10, 1, { conversionPolicy: "force-preference" }),
    preferenceEnabled: true,
    optimalConversion: false,
    useSharedTerms: false,
    secondaryPreferenceMultiple: 1,
    secondarySeniority: 2,
    priorDistributions: 2,
    waiverPercent: 50,
  }];
  const result = computeExitModel(model);
  const effective = result.effectiveStakeholders.find((holder) => holder.id === "split");
  assert.equal(effective.secondaryPreferenceMultiple, 1);
  assert.equal(effective.secondarySeniority, 2);
  assert.equal(effective.priorDistributions, 2);
  assert.equal(effective.waiverPercent, 50);
}

{
  const holders = [
    { ...preferred("preferred", 0, 50, 1, { conversionPolicy: "force-preference" }), deferredEligible: false },
    { ...common("common", 100), deferredEligible: true },
  ];
  const result = allocateExitConsideration(holders, 20, [{
    id: "earnout",
    label: "Earnout",
    amount: 20,
    treatment: "incremental",
    allocationBasis: "cumulative",
    eligibility: "deferred",
    expectedPercent: 100,
    years: 1,
  }], 0);
  assert.equal(result.consideration.unallocated, 20);
  assert.equal(Object.values(result.consideration.results).reduce((sum, row) => sum + row.entitlement, 0), 20);
  assert.match(result.consideration.warnings.join(" "), /not allocated/);
}

{
  const capped = preferred("capped-only", 100, 10, 1, {
    conversionPolicy: "force-preference",
    participation: "capped",
    capMultiple: 2,
  });
  const result = computeWaterfall([capped], 100);
  assert.equal(result.payouts["capped-only"], 20);
  assert.equal(result.unallocated, 80);
  assert.equal(result.participationPaid["capped-only"], 10);
}

{
  const capped = preferred("capped-prior", 100, 10, 1, {
    conversionPolicy: "force-preference",
    participation: "capped",
    capMultiple: 2,
    priorDistributions: 5,
  });
  const result = computeWaterfall([capped, common("common-with-prior", 1)], 100);
  assert.equal(result.payouts["capped-prior"], 15);
  assert.equal(result.payouts["common-with-prior"], 85);
}

{
  const result = allocateExitConsideration(
    [common("common", 1)],
    100,
    [{ id: "oversized", label: "Oversized escrow", amount: 150, treatment: "included", eligibility: "all", expectedPercent: 100, years: 1 }],
    0,
  );
  assert.equal(result.waterfall.payouts.common, 100);
  assert.equal(result.consideration.results.common.closingCash, 0);
  assert.equal(result.consideration.results.common.tranches.oversized, 100);
  assert.match(result.consideration.warnings.join(" "), /capped at the bridge value/);
}

{
  assert.throws(
    () => computeWaterfall([common("duplicate", 50), common("duplicate", 50)], 100),
    /present and unique/,
  );
  assert.throws(
    () => computeWaterfall([{ ...common("missing", 50), id: "" }], 100),
    /present and unique/,
  );
}

{
  for (const presetName of Object.keys(PRESETS)) {
    const model = clonePreset(presetName);
    const result = computeExitModel(model);
    const payoutTotal = Object.values(result.waterfall.payouts).reduce((sum, amount) => sum + amount, 0);
    const closingTotal = result.rows.reduce((sum, row) => sum + row.timing.closingCash, 0);
    const deferredTotal = result.rows.reduce((sum, row) => sum + row.deferred, 0);
    assert.ok(Math.abs(payoutTotal + result.waterfall.unallocated - result.grossProceeds) < 0.05, `${presetName} waterfall conservation`);
    assert.ok(Math.abs(closingTotal + deferredTotal - payoutTotal) < 0.05, `${presetName} consideration conservation`);
    assert.ok(result.rows.every((row) => [row.timing.entitlement, row.timing.closingCash, row.timing.expectedPresentValue, row.deferred].every(Number.isFinite)), `${presetName} finite holder results`);
    assert.ok(model.peopleCohorts.every((cohort) => Object.values(computePeopleCohortOutcome(cohort, result.waterfall.pricePerShare, model.deal.discountRate)).filter((value) => typeof value === "number").every(Number.isFinite)), `${presetName} finite people results`);
  }
}

{
  const allocated = allocateConsideration(
    [common("holder", 1)],
    { holder: 100 },
    [{ id: "deferred", label: "Deferred", amount: 20, eligibility: "all", years: 0 }],
    10,
  );
  assert.equal(allocated.results.holder.expectedPresentValue, 100);
}

console.log("engine tests passed");
