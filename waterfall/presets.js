const zeroTranches = () => [
  { id: "buyer-stock", label: "Buyer stock", type: "stock", amount: 0, treatment: "included", eligibility: "all", expectedPercent: 100, years: 0 },
  { id: "ppa-escrow", label: "Purchase-price adjustment escrow", type: "escrow", amount: 0, treatment: "included", eligibility: "escrow", expectedPercent: 100, years: 0.25 },
  { id: "indemnity-escrow", label: "Indemnity escrow / holdback", type: "escrow", amount: 0, treatment: "included", eligibility: "escrow", expectedPercent: 95, years: 1.5 },
  { id: "expense-fund", label: "Stockholder representative expense fund", type: "escrow", amount: 0, treatment: "included", eligibility: "escrow", expectedPercent: 80, years: 2 },
  { id: "seller-note", label: "Seller note", type: "note", amount: 0, treatment: "included", eligibility: "deferred", expectedPercent: 95, years: 2 },
  { id: "earnout", label: "Earnout / contingent value", type: "earnout", amount: 0, treatment: "included", eligibility: "deferred", expectedPercent: 50, years: 2 },
  { id: "rollover", label: "Rollover equity", type: "rollover", amount: 0, treatment: "included", eligibility: "deferred", expectedPercent: 85, years: 4 },
];

const cleanHolder = (holder) => {
  const normalized = {
    category: "other",
    className: "",
    series: "",
    useSharedTerms: true,
    preferenceEnabled: false,
    optimalConversion: true,
    participatingPreferred: false,
    cappedParticipation: false,
    cumulativeDividends: false,
    antiDilution: false,
    invested: 0,
    roundSize: 0,
    investorInvestment: 0,
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
  };
  if (holder.roundSize == null && numberValue(holder.invested) > 0) normalized.roundSize = numberValue(holder.invested);
  if (holder.investorInvestment == null && normalized.roundSize > 0) normalized.investorInvestment = normalized.roundSize;
  if (!normalized.series) normalized.series = normalized.securityType === "common" ? "common" : "other";
  return normalized;
};

const numberValue = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

const standardPeopleCohorts = () => [
  { id: "seed-employee", label: "Employee joining at Seed", entryStage: "seed", equityType: "option", grantShares: 100_000, strike: 0.12, eligiblePercent: 100, accelerationPercent: 0, transactionBonus: 0, retentionBonus: 0, retentionYears: 2 },
  { id: "series-a-employee", label: "Employee joining at Series A", entryStage: "series-a", equityType: "option", grantShares: 100_000, strike: 0.43, eligiblePercent: 100, accelerationPercent: 0, transactionBonus: 0, retentionBonus: 0, retentionYears: 2 },
  { id: "series-b-employee", label: "Employee joining at Series B", entryStage: "series-b", equityType: "option", grantShares: 100_000, strike: 1.14, eligiblePercent: 100, accelerationPercent: 0, transactionBonus: 0, retentionBonus: 0, retentionYears: 2 },
  { id: "series-c-employee", label: "Employee joining at Series C", entryStage: "series-c", equityType: "option", grantShares: 100_000, strike: 1.14, eligiblePercent: 100, accelerationPercent: 0, transactionBonus: 0, retentionBonus: 0, retentionYears: 2 },
  { id: "series-d-employee", label: "Employee joining at Series D", entryStage: "series-d", equityType: "option", grantShares: 100_000, strike: 18.90, eligiblePercent: 100, accelerationPercent: 0, transactionBonus: 0, retentionBonus: 0, retentionYears: 2 },
  { id: "series-e-employee", label: "Employee joining at Series E", entryStage: "series-e", equityType: "option", grantShares: 100_000, strike: 32.79, eligiblePercent: 100, accelerationPercent: 0, transactionBonus: 0, retentionBonus: 0, retentionYears: 2 },
  { id: "series-f-employee", label: "Employee joining at Series F", entryStage: "series-f", equityType: "option", grantShares: 100_000, strike: 32.79, eligiblePercent: 100, accelerationPercent: 0, transactionBonus: 0, retentionBonus: 0, retentionYears: 2 },
  { id: "growth-employee", label: "Employee joining in 2023+", entryStage: "growth", equityType: "option", grantShares: 100_000, strike: 62.64, eligiblePercent: 75, accelerationPercent: 0, transactionBonus: 0, retentionBonus: 0, retentionYears: 2 },
];

const sharedTerms = (overrides = {}) => ({
  liquidationPreference: false,
  pariPassu: false,
  preferenceMultiple: 1,
  optimalConversion: true,
  participatingPreferred: false,
  cappedParticipation: false,
  participationCap: 3,
  cumulativeDividends: false,
  dividendType: "simple",
  accruedDividend: 0,
  dividendRate: 8,
  dividendYears: 0,
  dividendPeriods: 1,
  paidDividends: 0,
  antiDilution: false,
  ratchetType: "weighted-average",
  originalPrice: 0,
  downRoundPrice: 0,
  preRoundShares: 0,
  newMoney: 0,
  conversionMultiplier: 1,
  escrowEligibleAll: true,
  deferredEligibleAll: true,
  ...overrides,
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
    terms: sharedTerms(),
    tranches: zeroTranches(),
    peopleCohorts: standardPeopleCohorts(),
    stakeholders: [
      cleanHolder({ id: "founders", name: "Founders", className: "Founder common", series: "formation", category: "founder", securityType: "common", shares: 60_000_000 }),
      cleanHolder({ id: "employees", name: "Employees and other common holders", className: "Employee common", category: "employee", securityType: "common", shares: 20_000_000 }),
      cleanHolder({ id: "series-a", name: "Series A investors", className: "Series A preferred", series: "series-a", securityType: "preferred", shares: 20_000_000, invested: 20_000_000, roundSize: 20_000_000, investorInvestment: 20_000_000, seniority: 1 }),
    ],
  },
  airtable: {
    meta: {
      preset: "airtable",
      title: "Airtable: announced acquisition",
      description: "A clean as-converted model for Bending Spoons' announced all-cash acquisition, separating modeled founder common from employee equity and keeping undisclosed employee protections at zero.",
      asOf: "Announced August 4, 2026 and not yet closed. Reported: $1.285B purchase price and $2.25B implied equity value including cash. Modeled: $965M cash bridge, 1% seller transaction expenses, a 1% purchase-price-adjustment escrow, a 0.5% RWI-style indemnity retention and a $500K representative fund. No preference, pari passu, earnout, rollover, seller note, debt, management carveout, broad employee bonus or acceleration is assumed. Public filings disclose 21,981,692 aggregate common shares but not founder ownership; the preset allocates 12M to Airtable's three founders and the 9,981,692 residual to employees and other common holders solely as a transparent estimate. Employee cohort strikes use reported historical 409A common values.",
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
          label: "Airtable: company and founders",
          url: "https://www.airtable.com/about",
          note: "Airtable identifies Howie Liu, Andrew Ofstad and Emmett Nicholas as co-founders. It does not disclose their ownership; the founder/common split in this preset is modeled, while aggregate common is source-backed.",
        },
        {
          label: "SRS Acquiom 2024 M&A Deal Terms Study",
          url: "https://media.taftlaw.com/wp-content/uploads/2024/04/30085443/SRS_Acquiom_2024_Deal_Terms_Study.pdf",
          note: "Only 4.5% of the study's 2023 deals included a management carveout, falling to 1.3% for transactions above $100M. Transaction bonuses were measured separately.",
        },
        {
          label: "Lowenstein Sandler: employee retention in sales",
          url: "https://www.lowenstein.com/media/fplbivfa/e052-sell-your-company-not-your-employees-employee-retention-tactics-during-sales.pdf",
          note: "Distinguishes targeted management carveouts, transaction bonuses, post-close retention and severance; broad employee coverage is not assumed.",
        },
        {
          label: "Bending Spoons 2026 prospectus",
          url: "https://bendingspoons.com/documents/financials/2026/Bending%20Spoons%20Final%20Prospectus%20As%20Filed.pdf",
          note: "Bending Spoons reports reducing Evernote's dedicated workforce from 341 at acquisition to 60 by year-end 2024. This is buyer-history context, not evidence of Airtable's negotiated terms.",
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
      transactionFees: 22_500_000,
      bonuses: 0,
      transferTaxes: 0,
      otherAdjustment: 0,
      discountRate: 12,
    },
    terms: sharedTerms(),
    tranches: [
      { id: "buyer-stock", label: "Buyer stock", type: "stock", amount: 0, treatment: "included", eligibility: "all", expectedPercent: 100, years: 0 },
      { id: "ppa-escrow", label: "Purchase-price adjustment escrow", type: "escrow", amount: 22_500_000, treatment: "included", eligibility: "escrow", expectedPercent: 99, years: 0.25 },
      { id: "indemnity-escrow", label: "RWI retention / indemnity escrow", type: "escrow", amount: 11_250_000, treatment: "included", eligibility: "escrow", expectedPercent: 98, years: 1.5 },
      { id: "expense-fund", label: "Stockholder representative expense fund", type: "escrow", amount: 500_000, treatment: "included", eligibility: "escrow", expectedPercent: 80, years: 2 },
      { id: "seller-note", label: "Seller note", type: "note", amount: 0, treatment: "included", eligibility: "deferred", expectedPercent: 95, years: 2 },
      { id: "earnout", label: "Earnout / contingent value", type: "earnout", amount: 0, treatment: "included", eligibility: "deferred", expectedPercent: 50, years: 2 },
      { id: "rollover", label: "Rollover equity", type: "rollover", amount: 0, treatment: "included", eligibility: "deferred", expectedPercent: 85, years: 4 },
    ],
    peopleCohorts: standardPeopleCohorts(),
    stakeholders: [
      cleanHolder({ id: "founders", name: "Airtable founders — Howie Liu, Andrew Ofstad and Emmett Nicholas (modeled)", className: "Founder common", series: "formation", category: "founder", securityType: "common", shares: 12_000_000, displayOrder: 0 }),
      cleanHolder({ id: "employee-common", name: "Employees and other common holders (modeled residual)", className: "Employee and other common", series: "common", category: "employee", securityType: "common", shares: 9_981_692, displayOrder: 0.5 }),
      cleanHolder({ id: "seed", name: "Seed investors (Caffeinated, Freestyle, DCVC and others)", className: "Seed (converted common)", series: "seed", securityType: "preferred", shares: 3_852_577, invested: 3_000_000, roundSize: 3_000_000, investorInvestment: 3_000_000, preferenceMultiple: 0, seniority: 7, displayOrder: 1 }),
      cleanHolder({ id: "series-a", name: "Series A investors (CRV and angels)", className: "Series A (converted common)", series: "series-a", securityType: "preferred", shares: 6_312_009, invested: 7_600_000, roundSize: 7_600_000, investorInvestment: 7_600_000, preferenceMultiple: 0, seniority: 6, displayOrder: 2 }),
      cleanHolder({ id: "series-b", name: "Series B investors (CRV, Caffeinated, Freestyle and Slow)", className: "Series B (converted common)", series: "series-b", securityType: "preferred", shares: 11_391_392, invested: 59_000_000, roundSize: 59_000_000, investorInvestment: 59_000_000, preferenceMultiple: 0, seniority: 5, displayOrder: 3 }),
      cleanHolder({ id: "series-c", name: "Series C investors (Thrive, Benchmark, Coatue and syndicate)", className: "Series C (converted common)", series: "series-c", securityType: "preferred", shares: 4_512_756, invested: 100_000_000, roundSize: 100_000_000, investorInvestment: 100_000_000, preferenceMultiple: 0, seniority: 4, displayOrder: 4 }),
      cleanHolder({ id: "series-d", name: "Series D investors (Thrive, Benchmark, Coatue, D1 and others)", className: "Series D (converted common)", series: "series-d", securityType: "preferred", shares: 3_360_489, invested: 185_000_000, roundSize: 185_000_000, investorInvestment: 185_000_000, preferenceMultiple: 0, seniority: 3, displayOrder: 5 }),
      cleanHolder({ id: "series-e", name: "Series E investors (Greenoaks, WndrCo and existing investors)", className: "Series E (converted common)", series: "series-e", securityType: "preferred", shares: 3_131_683, invested: 270_000_000, roundSize: 270_000_000, investorInvestment: 270_000_000, preferenceMultiple: 0, seniority: 2, displayOrder: 6 }),
      cleanHolder({ id: "series-f", name: "Series F investors (XN and syndicate)", className: "Series F (converted common)", series: "series-f", securityType: "preferred", shares: 4_191_573, invested: 735_000_000, roundSize: 735_000_000, investorInvestment: 735_000_000, preferenceMultiple: 0, seniority: 1, displayOrder: 7 }),
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
    terms: sharedTerms(),
    peopleCohorts: standardPeopleCohorts(),
    tranches: [
      { id: "buyer-stock", label: "Capital One stock", type: "stock", amount: 1_900_000_000, treatment: "included", eligibility: "all", expectedPercent: 100, years: 0 },
      ...zeroTranches().slice(1),
    ],
    stakeholders: [
      cleanHolder({ id: "henrique", name: "Henrique Dubugras (modeled)", className: "Founder common", series: "formation", category: "founder", securityType: "common", shares: 12_000_000 }),
      cleanHolder({ id: "pedro", name: "Pedro Franceschi (modeled)", className: "Founder common", series: "formation", category: "founder", securityType: "common", shares: 12_000_000 }),
      cleanHolder({ id: "employees", name: "Employees and former employees (modeled)", className: "RSUs / restricted stock", category: "employee", securityType: "rsu", shares: 20_000_000 }),
      cleanHolder({ id: "options", name: "Employee option pool (modeled)", className: "Options", category: "employee", securityType: "option", shares: 8_000_000, strike: 3, escrowEligible: false, deferredEligible: false }),
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
    terms: sharedTerms({
      liquidationPreference: true,
      preferenceMultiple: 1,
      participatingPreferred: true,
      cappedParticipation: true,
      participationCap: 3,
      antiDilution: true,
      ratchetType: "weighted-average",
      originalPrice: 2,
      downRoundPrice: 1.25,
      preRoundShares: 70_000_000,
      newMoney: 10_000_000,
    }),
    peopleCohorts: standardPeopleCohorts(),
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
      cleanHolder({ id: "founders", name: "Founders", className: "Founder common", series: "formation", category: "founder", securityType: "common", shares: 30_000_000 }),
      cleanHolder({ id: "employees", name: "Employee common & RSUs", className: "Employee equity", category: "employee", securityType: "rsu", shares: 5_000_000 }),
      cleanHolder({ id: "options", name: "Options", className: "Options", category: "employee", securityType: "option", shares: 10_000_000, strike: 0.5, eligiblePercent: 75, escrowEligible: false, deferredEligible: false }),
      cleanHolder({ id: "seed", name: "Seed preferred", className: "Seed preferred", series: "seed", securityType: "preferred", shares: 10_000_000, invested: 5_000_000, preferenceMultiple: 1, seniority: 3 }),
      cleanHolder({ id: "series-a", name: "Series A preferred", className: "Series A preferred", series: "series-a", securityType: "preferred", shares: 15_000_000, invested: 15_000_000, preferenceMultiple: 1, seniority: 2, participation: "capped", capMultiple: 3 }),
      cleanHolder({ id: "series-b1", name: "Series B lead", className: "Series B preferred", series: "series-b", securityType: "preferred", shares: 7_000_000, invested: 14_000_000, preferenceMultiple: 2, seniority: 1, ratchetType: "weighted-average", originalPrice: 2, downRoundPrice: 1.25, preRoundShares: 70_000_000, newMoney: 10_000_000 }),
      cleanHolder({ id: "series-b2", name: "Series B syndicate", className: "Series B preferred", series: "series-b", securityType: "preferred", shares: 3_000_000, invested: 6_000_000, preferenceMultiple: 2, seniority: 1 }),
    ],
  },
};

export function clonePreset(name = "airtable") {
  return structuredClone(PRESETS[name] || PRESETS.airtable);
}

export function blankStakeholder(id) {
  return cleanHolder({ id, name: "New investor round", className: "Series A preferred", series: "series-a", securityType: "preferred", shares: 0, seniority: 1 });
}

export function blankPeopleCohort(id) {
  return { id, label: "Employee joining at Series A", entryStage: "series-a", equityType: "option", grantShares: 100_000, strike: 0, eligiblePercent: 100, accelerationPercent: 0, transactionBonus: 0, retentionBonus: 0, retentionYears: 2 };
}

export function blankTranche(id) {
  return { id, label: "Other deferred consideration", type: "other", amount: 0, treatment: "included", eligibility: "all", expectedPercent: 100, years: 0 };
}
