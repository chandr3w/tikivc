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
      title: "Airtable: announced acquisition",
      description: "An as-converted common case for Bending Spoons' announced all-cash acquisition. Round-level shares use a 2024 corporate-filings-based cap-table snapshot; preferences default to 0×.",
      asOf: "Announced August 4, 2026 and not yet closed. Reported: $1.285B purchase price and $2.25B implied equity value including cash. Modeled: $965M cash bridge, no debt, 58.734M outstanding shares and every preferred series converted to common with 0× liquidation preference. Share counts may have changed since the December 2024 cap-table report.",
      sources: [
        {
          label: "Axios: announced Airtable acquisition",
          url: "https://www.axios.com/newsletters/axios-pro-rata-f1a989ea-b33c-4058-a94b-4cfce74faa1c",
          note: "Axios reported a $1.285B all-cash purchase price and a $2.25B implied equity value including Airtable cash and cash equivalents on August 4, 2026.",
        },
        {
          label: "Notice.co Airtable cap-table report",
          url: "https://notice-reports.s3.amazonaws.com/Airtable%20Report%202024.12.24_16.17.16.pdf",
          note: "The December 2024 report compiles corporate filings into 58,734,171 outstanding shares across common and Seed through Series F classes. These share counts drive the preset's round-level ownership estimates.",
        },
        {
          label: "Airtable Series F announcement",
          url: "https://www.airtable.com/newsroom/series-f",
          note: "Airtable disclosed a $735M Series F at an $11B pre-money valuation, the round's investor syndicate and $1.36B of total funding.",
        },
        {
          label: "Airtable Series E announcement",
          url: "https://www.airtable.com/newsroom/series-e-funding-announcement",
          note: "Airtable disclosed a $270M Series E at a $5.77B post-money valuation led by Greenoaks, with WndrCo, Caffeinated, CRV and Thrive participating.",
        },
        {
          label: "Airtable Series A announcement",
          url: "https://www.airtable.com/newsroom/democratizing-the-database-3",
          note: "Airtable disclosed a $7.6M Series A led by CRV and named participating angels and continuing seed investors.",
        },
        {
          label: "Airtable Seed financing",
          url: "https://techcrunch.com/2015/02/25/airtable/",
          note: "TechCrunch reported Airtable's $3M seed financing and identified the institutional and angel investors.",
        },
        {
          label: "CRV: Airtable Series B",
          url: "https://medium.com/crv-insights/airtable-the-application-platform-thats-redefining-software-2c4fc09dd5f1",
          note: "CRV disclosed the $52M Series B co-led with Caffeinated Capital. A later $7M extension reported by Fortune brings the modeled cohort basis to $59M.",
        },
        {
          label: "Airtable Series C financing",
          url: "https://techcrunch.com/2018/11/15/airtable-maker-of-a-coding-platform-for-non-techies-raises-100m-at-a-1-1b-valuation/",
          note: "TechCrunch reported the $100M Series C at a $1.1B valuation led by Thrive, Benchmark and Coatue.",
        },
        {
          label: "Airtable Series D financing",
          url: "https://techcrunch.com/2020/09/14/airtable-raises-185m-and-launches-new-low-code-and-automation-features/",
          note: "TechCrunch reported the $185M Series D at a $2.585B post-money valuation and the participating investor group.",
        },
      ],
    },
    deal: {
      name: "Airtable / Bending Spoons (announced)",
      enterpriseValue: 1_285_000_000,
      cash: 965_000_000,
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
      cleanHolder({ id: "common", name: "Founders, employees and common holders (modeled)", className: "Common holders", securityType: "common", shares: 21_981_692, displayOrder: 0 }),
      cleanHolder({ id: "seed", name: "Seed investors (Caffeinated, Freestyle, DCVC and others)", className: "Seed (converted common)", securityType: "preferred", shares: 3_852_577, invested: 3_000_000, preferenceMultiple: 0, displayOrder: 1 }),
      cleanHolder({ id: "series-a", name: "Series A investors (CRV and angels)", className: "Series A (converted common)", securityType: "preferred", shares: 6_312_009, invested: 7_600_000, preferenceMultiple: 0, displayOrder: 2 }),
      cleanHolder({ id: "series-b", name: "Series B investors (CRV, Caffeinated, Freestyle and Slow)", className: "Series B (converted common)", securityType: "preferred", shares: 11_391_392, invested: 59_000_000, preferenceMultiple: 0, displayOrder: 3 }),
      cleanHolder({ id: "series-c", name: "Series C investors (Thrive, Benchmark, Coatue and syndicate)", className: "Series C (converted common)", securityType: "preferred", shares: 4_512_756, invested: 100_000_000, preferenceMultiple: 0, displayOrder: 4 }),
      cleanHolder({ id: "series-d", name: "Series D investors (Thrive, Benchmark, Coatue, D1 and others)", className: "Series D (converted common)", securityType: "preferred", shares: 3_360_489, invested: 185_000_000, preferenceMultiple: 0, displayOrder: 5 }),
      cleanHolder({ id: "series-e", name: "Series E investors (Greenoaks, WndrCo and existing investors)", className: "Series E (converted common)", securityType: "preferred", shares: 3_131_683, invested: 270_000_000, preferenceMultiple: 0, displayOrder: 6 }),
      cleanHolder({ id: "series-f", name: "Series F investors (XN and syndicate)", className: "Series F (converted common)", securityType: "preferred", shares: 4_191_573, invested: 735_000_000, preferenceMultiple: 0, displayOrder: 7 }),
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
