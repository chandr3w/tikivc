const zeroTranches = () => [
  { id: "buyer-stock", label: "Buyer stock", type: "stock", amount: 0, treatment: "included", eligibility: "all", expectedPercent: 100, years: 0 },
  { id: "ppa-escrow", label: "Purchase-price adjustment escrow", type: "escrow", amount: 0, treatment: "included", eligibility: "escrow", expectedPercent: 100, years: 0.25 },
  { id: "indemnity-escrow", label: "Indemnity escrow / holdback", type: "escrow", amount: 0, treatment: "included", eligibility: "escrow", expectedPercent: 95, years: 1.5 },
  { id: "expense-fund", label: "Stockholder representative expense fund", type: "escrow", amount: 0, treatment: "included", eligibility: "escrow", expectedPercent: 80, years: 2 },
  { id: "seller-note", label: "Seller note", type: "note", amount: 0, treatment: "included", eligibility: "deferred", expectedPercent: 95, years: 2 },
  { id: "earnout", label: "Earnout / contingent value", type: "earnout", amount: 0, treatment: "included", eligibility: "deferred", expectedPercent: 50, years: 2 },
  { id: "rollover", label: "Rollover equity", type: "rollover", amount: 0, treatment: "included", eligibility: "deferred", expectedPercent: 85, years: 4 },
];

const cleanHolder = (holder) => ({
  invested: 0,
  preferenceMultiple: 0,
  secondaryPreferenceMultiple: 0,
  secondarySeniority: 1,
  accruedDividend: 0,
  dividendType: "none",
  dividendRate: 0,
  dividendYears: 0,
  dividendPeriods: 1,
  paidDividends: 0,
  waiverPercent: 0,
  priorDistributions: 0,
  seniority: 1,
  participation: "none",
  capMultiple: 0,
  strike: 0,
  eligiblePercent: 100,
  conversionPolicy: "elective",
  ratchetType: "none",
  conversionMultiplier: 1,
  originalPrice: 0,
  downRoundPrice: 0,
  preRoundShares: 0,
  newMoney: 0,
  escrowEligible: true,
  deferredEligible: true,
  ...holder,
});

export const PRESETS = {
  clean: {
    meta: {
      preset: "clean",
      title: "Clean acquisition",
      description: "A straightforward cash acquisition with no preferences, holdbacks, or contingent consideration.",
      asOf: "Illustrative",
      sources: [],
    },
    deal: {
      name: "Clean Acquisition Co.",
      enterpriseValue: 100_000_000,
      cash: 0,
      debt: 0,
      debtLike: 0,
      workingCapital: 0,
      transactionFees: 0,
      bonuses: 0,
      transferTaxes: 0,
      otherAdjustment: 0,
      discountRate: 12,
    },
    tranches: zeroTranches(),
    stakeholders: [
      cleanHolder({ id: "founders", name: "Founders and employees", securityType: "common", shares: 80_000_000 }),
      cleanHolder({ id: "investors", name: "Investors", securityType: "common", shares: 20_000_000 }),
    ],
  },
  airbnb: {
    meta: {
      preset: "airbnb",
      title: "Airbnb — $190/share acquisition (illustrative)",
      description: "A hypothetical 75% cash / 25% buyer-stock acquisition. Capitalization and balance-sheet inputs are public facts; offer price, premium, and consideration mix are editable assumptions.",
      asOf: "Balance sheet and awards: Mar 31, 2026 • beneficial ownership: Apr 8, 2026 • basic shares: Apr 17, 2026 • market reference: Aug 6, 2026. Model assumes one-for-one economic treatment of Class A and B common, all RSUs included at offer value, and options net-settled at the disclosed weighted-average strike. Actual vesting, acceleration, withholding, election proration, stock-price collars and closing adjustments may differ.",
      sources: [
        {
          label: "Airbnb Q1 2026 Form 10-Q",
          url: "https://www.sec.gov/Archives/edgar/data/1559720/000155972026000014/abnb-20260331.htm",
          note: "$12.005B cash and short-term investments, $2.5B senior notes, 593.505M external Class A/B shares, 39.6M RSUs, and 5.7M options at a $110.54 weighted-average strike.",
        },
        {
          label: "Airbnb 2026 proxy statement",
          url: "https://fintel.io/doc/sec-airbnb-inc-1559720-def-14a-2026-april-24-20567-8998",
          note: "Named positions are beneficial-ownership figures. Founder totals exclude options and RSUs separately modeled; the residual reconciles to April 17 basic shares.",
        },
        {
          label: "ABNB market reference",
          url: "https://finance.yahoo.com/quote/ABNB/",
          note: "$151.78 intraday reference on August 6, 2026; the $190.00 offer and 25.18% premium are hypothetical.",
        },
      ],
    },
    deal: {
      name: "Airbnb, Inc.",
      enterpriseValue: 111_237_857_370,
      cash: 12_005_000_000,
      debt: 2_500_000_000,
      debtLike: 0,
      workingCapital: 0,
      transactionFees: 0,
      bonuses: 0,
      transferTaxes: 0,
      otherAdjustment: 0,
      discountRate: 10,
    },
    tranches: [
      { id: "buyer-stock", label: "Buyer stock", type: "stock", amount: 30_185_714_343, treatment: "included", eligibility: "all", expectedPercent: 100, years: 0 },
      { id: "ppa-escrow", label: "Purchase-price adjustment escrow", type: "escrow", amount: 0, treatment: "included", eligibility: "escrow", expectedPercent: 99, years: 0.25 },
      { id: "indemnity-escrow", label: "Indemnity escrow / holdback", type: "escrow", amount: 0, treatment: "included", eligibility: "escrow", expectedPercent: 95, years: 1.5 },
      { id: "expense-fund", label: "Stockholder representative expense fund", type: "escrow", amount: 0, treatment: "included", eligibility: "escrow", expectedPercent: 80, years: 2 },
      { id: "seller-note", label: "Seller note", type: "note", amount: 0, treatment: "included", eligibility: "deferred", expectedPercent: 95, years: 2 },
      { id: "earnout", label: "Earnout / contingent value", type: "earnout", amount: 0, treatment: "included", eligibility: "deferred", expectedPercent: 50, years: 2 },
      { id: "rollover", label: "Rollover equity", type: "rollover", amount: 0, treatment: "included", eligibility: "deferred", expectedPercent: 85, years: 4 },
    ],
    stakeholders: [
      cleanHolder({ id: "chesky", name: "Brian Chesky", securityType: "common", shares: 66_702_326 }),
      cleanHolder({ id: "blecharczyk", name: "Nathan Blecharczyk", securityType: "common", shares: 61_130_011 }),
      cleanHolder({ id: "gebbia", name: "Joseph Gebbia", securityType: "common", shares: 34_739_995 }),
      cleanHolder({ id: "sequoia", name: "Sequoia affiliates", securityType: "common", shares: 17_829_874 }),
      cleanHolder({ id: "vanguard", name: "Vanguard", securityType: "common", shares: 38_295_288 }),
      cleanHolder({ id: "other-holders", name: "Other Class A & B holders", securityType: "common", shares: 374_807_429 }),
      cleanHolder({ id: "rsus", name: "Outstanding RSUs", securityType: "rsu", shares: 39_600_000 }),
      cleanHolder({ id: "options", name: "Outstanding options", securityType: "option", shares: 5_700_000, strike: 110.54, escrowEligible: false, deferredEligible: false }),
    ],
  },
  venture: {
    meta: {
      preset: "venture",
      title: "Venture-backed sale — advanced terms",
      description: "An illustrative preference stack with pari passu classes, participation, a down-round ratchet, escrows and an earnout.",
      asOf: "Illustrative",
      sources: [],
    },
    deal: {
      name: "Northstar Software, Inc.",
      enterpriseValue: 80_000_000,
      cash: 5_000_000,
      debt: 12_000_000,
      debtLike: 2_000_000,
      workingCapital: -1_000_000,
      transactionFees: 3_000_000,
      bonuses: 1_000_000,
      transferTaxes: 0,
      otherAdjustment: 0,
      discountRate: 15,
    },
    tranches: [
      { id: "buyer-stock", label: "Buyer stock", type: "stock", amount: 10_000_000, treatment: "included", eligibility: "all", expectedPercent: 95, years: 0 },
      { id: "ppa-escrow", label: "Purchase-price adjustment escrow", type: "escrow", amount: 650_000, treatment: "included", eligibility: "escrow", expectedPercent: 98, years: 0.25 },
      { id: "indemnity-escrow", label: "Indemnity escrow / holdback", type: "escrow", amount: 3_300_000, treatment: "included", eligibility: "escrow", expectedPercent: 90, years: 1.5 },
      { id: "expense-fund", label: "Stockholder representative expense fund", type: "escrow", amount: 250_000, treatment: "included", eligibility: "escrow", expectedPercent: 60, years: 2 },
      { id: "seller-note", label: "Seller note", type: "note", amount: 5_000_000, treatment: "included", eligibility: "deferred", expectedPercent: 90, years: 2 },
      { id: "earnout", label: "Earnout / contingent value", type: "earnout", amount: 10_000_000, treatment: "incremental", eligibility: "deferred", expectedPercent: 55, years: 2 },
      { id: "rollover", label: "Rollover equity", type: "rollover", amount: 4_000_000, treatment: "included", eligibility: "deferred", expectedPercent: 80, years: 4 },
    ],
    stakeholders: [
      cleanHolder({ id: "founders", name: "Founders", securityType: "common", shares: 30_000_000 }),
      cleanHolder({ id: "employees", name: "Employee common & RSUs", securityType: "rsu", shares: 5_000_000 }),
      cleanHolder({ id: "options", name: "Options", securityType: "option", shares: 10_000_000, strike: 0.5, eligiblePercent: 75, escrowEligible: false, deferredEligible: false }),
      cleanHolder({ id: "seed", name: "Seed preferred", securityType: "preferred", shares: 10_000_000, invested: 5_000_000, preferenceMultiple: 1, seniority: 3 }),
      cleanHolder({ id: "series-a", name: "Series A preferred", securityType: "preferred", shares: 15_000_000, invested: 15_000_000, preferenceMultiple: 1, seniority: 2, participation: "capped", capMultiple: 3 }),
      cleanHolder({ id: "series-b1", name: "Series B lead", securityType: "preferred", shares: 7_000_000, invested: 14_000_000, preferenceMultiple: 2, seniority: 1, ratchetType: "weighted-average", originalPrice: 2, downRoundPrice: 1.25, preRoundShares: 70_000_000, newMoney: 10_000_000 }),
      cleanHolder({ id: "series-b2", name: "Series B syndicate", securityType: "preferred", shares: 3_000_000, invested: 6_000_000, preferenceMultiple: 2, seniority: 1 }),
    ],
  },
};

export function clonePreset(name = "clean") {
  return structuredClone(PRESETS[name] || PRESETS.clean);
}

export function blankStakeholder(id) {
  return cleanHolder({ id, name: "New stakeholder", securityType: "common", shares: 0 });
}

export function blankTranche(id) {
  return { id, label: "Other deferred consideration", type: "other", amount: 0, treatment: "included", eligibility: "all", expectedPercent: 100, years: 0 };
}
