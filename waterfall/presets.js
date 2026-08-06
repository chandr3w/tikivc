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
  className: "",
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
      description: "A cash acquisition with no preferences, holdbacks or contingent consideration.",
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
      cleanHolder({ id: "founders", name: "Founders and employees", className: "Common stock", securityType: "common", shares: 80_000_000 }),
      cleanHolder({ id: "investors", name: "Investors", className: "Common stock", securityType: "common", shares: 20_000_000 }),
    ],
  },
  airtable: {
    meta: {
      preset: "airtable",
      title: "Airtable: modeled $8.0B acquisition",
      description: "A clean cash acquisition anchored to Airtable's disclosed 2021 financing. The purchase price, cash balance, ownership, option pool and strike price are model assumptions.",
      asOf: "Disclosed: $735M Series F at an $11B pre-money valuation in December 2021; $1.36B total funding. Modeled: $7.5B enterprise value, $500M cash, no debt, 100M fully diluted units and 0x liquidation preferences.",
      sources: [
        {
          label: "Airtable Series F announcement",
          url: "https://www.airtable.com/newsroom/series-f",
          note: "Airtable disclosed a $735M Series F at an $11B pre-money valuation and $1.36B of total funding on December 13, 2021.",
        },
        {
          label: "Airtable company facts",
          url: "https://www.airtable.com/about",
          note: "Airtable identifies Howie Liu, Andrew Ofstad and Emmett Nicholas as co-founders and reports $1.36B of total funding. It does not disclose a current cap table or cash balance.",
        },
      ],
    },
    deal: {
      name: "Airtable, Inc. (modeled)",
      enterpriseValue: 7_500_000_000,
      cash: 500_000_000,
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
      cleanHolder({ id: "howie", name: "Howie Liu (modeled)", className: "Common stock", securityType: "common", shares: 10_000_000 }),
      cleanHolder({ id: "andrew", name: "Andrew Ofstad (modeled)", className: "Common stock", securityType: "common", shares: 5_000_000 }),
      cleanHolder({ id: "emmett", name: "Emmett Nicholas (modeled)", className: "Common stock", securityType: "common", shares: 5_000_000 }),
      cleanHolder({ id: "employees", name: "Employees and former employees (modeled)", className: "RSUs / restricted stock", securityType: "rsu", shares: 22_000_000 }),
      cleanHolder({ id: "options", name: "Employee option pool (modeled)", className: "Options", securityType: "option", shares: 8_000_000, strike: 2, escrowEligible: false, deferredEligible: false }),
      cleanHolder({ id: "early-investors", name: "Early venture investors (modeled)", className: "Common stock", securityType: "common", shares: 22_000_000 }),
      cleanHolder({ id: "growth-investors", name: "Growth investors (modeled)", className: "Common stock", securityType: "common", shares: 28_000_000 }),
    ],
  },
  brex: {
    meta: {
      preset: "brex",
      title: "Brex: completed acquisition",
      description: "Capital One's completed cash-and-stock acquisition using disclosed closing consideration. The holder ownership and option inputs are modeled because Brex's full cap table is not public.",
      asOf: "Disclosed at closing on April 7, 2026: about $2.56B cash plus 10.65M Capital One shares valued near $1.9B, or about $4.46B total consideration before post-closing adjustments. Modeled: 100M fully diluted Brex units, a $3 option strike and 0x liquidation preferences.",
      sources: [
        {
          label: "Capital One closing Form 8-K",
          url: "https://www.sec.gov/Archives/edgar/data/927628/000119312526145764/d85207d8k.htm",
          note: "Capital One disclosed about $2.56B of cash and 10,646,306 Capital One shares at closing, subject to a customary post-closing adjustment.",
        },
        {
          label: "Capital One acquisition announcement",
          url: "https://www.capitalone.com/about/newsroom/capital-one-to-acquire-brex/",
          note: "The January 22, 2026 announcement valued the transaction at $5.15B in a combination of stock and cash.",
        },
        {
          label: "Brex Series D-2 announcement",
          url: "https://www.brex.com/journal/welcoming-karan-and-our-series-d-2-round",
          note: "Brex disclosed a $300M Series D-2 at a $12.3B valuation. This financing reference does not disclose the closing cap table used by the merger.",
        },
      ],
    },
    deal: {
      name: "Brex / Capital One",
      enterpriseValue: 4_460_000_000,
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
    tranches: [
      { id: "buyer-stock", label: "Capital One stock", type: "stock", amount: 1_900_000_000, treatment: "included", eligibility: "all", expectedPercent: 100, years: 0 },
      ...zeroTranches().slice(1),
    ],
    stakeholders: [
      cleanHolder({ id: "henrique", name: "Henrique Dubugras (modeled)", className: "Common stock", securityType: "common", shares: 12_000_000 }),
      cleanHolder({ id: "pedro", name: "Pedro Franceschi (modeled)", className: "Common stock", securityType: "common", shares: 12_000_000 }),
      cleanHolder({ id: "employees", name: "Employees and former employees (modeled)", className: "RSUs / restricted stock", securityType: "rsu", shares: 20_000_000 }),
      cleanHolder({ id: "options", name: "Employee option pool (modeled)", className: "Options", securityType: "option", shares: 8_000_000, strike: 3, escrowEligible: false, deferredEligible: false }),
      cleanHolder({ id: "early-investors", name: "Early venture investors (modeled)", className: "Common stock", securityType: "common", shares: 22_000_000 }),
      cleanHolder({ id: "growth-investors", name: "Growth investors (modeled)", className: "Common stock", securityType: "common", shares: 26_000_000 }),
    ],
  },
  venture: {
    meta: {
      preset: "venture",
      title: "Venture-backed sale: advanced terms",
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
      cleanHolder({ id: "founders", name: "Founders", className: "Common stock", securityType: "common", shares: 30_000_000 }),
      cleanHolder({ id: "employees", name: "Employee common & RSUs", className: "Employee equity", securityType: "rsu", shares: 5_000_000 }),
      cleanHolder({ id: "options", name: "Options", className: "Options", securityType: "option", shares: 10_000_000, strike: 0.5, eligiblePercent: 75, escrowEligible: false, deferredEligible: false }),
      cleanHolder({ id: "seed", name: "Seed preferred", className: "Seed preferred", securityType: "preferred", shares: 10_000_000, invested: 5_000_000, preferenceMultiple: 1, seniority: 3 }),
      cleanHolder({ id: "series-a", name: "Series A preferred", className: "Series A preferred", securityType: "preferred", shares: 15_000_000, invested: 15_000_000, preferenceMultiple: 1, seniority: 2, participation: "capped", capMultiple: 3 }),
      cleanHolder({ id: "series-b1", name: "Series B lead", className: "Series B preferred", securityType: "preferred", shares: 7_000_000, invested: 14_000_000, preferenceMultiple: 2, seniority: 1, ratchetType: "weighted-average", originalPrice: 2, downRoundPrice: 1.25, preRoundShares: 70_000_000, newMoney: 10_000_000 }),
      cleanHolder({ id: "series-b2", name: "Series B syndicate", className: "Series B preferred", securityType: "preferred", shares: 3_000_000, invested: 6_000_000, preferenceMultiple: 2, seniority: 1 }),
    ],
  },
};

export function clonePreset(name = "airtable") {
  return structuredClone(PRESETS[name] || PRESETS.airtable);
}

export function blankStakeholder(id) {
  return cleanHolder({ id, name: "New stakeholder", securityType: "common", shares: 0 });
}

export function blankTranche(id) {
  return { id, label: "Other deferred consideration", type: "other", amount: 0, treatment: "included", eligibility: "all", expectedPercent: 100, years: 0 };
}
