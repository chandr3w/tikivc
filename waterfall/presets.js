const zeroTranches = () => [
  { id: "buyer-stock", label: "Buyer stock", type: "stock", amount: 0, treatment: "included", allocationBasis: "pro-rata", eligibility: "all", expectedPercent: 100, years: 0 },
  { id: "ppa-escrow", label: "Purchase-price adjustment escrow", type: "escrow", amount: 0, treatment: "included", allocationBasis: "pro-rata", eligibility: "escrow", expectedPercent: 100, years: 0.25 },
  { id: "indemnity-escrow", label: "Indemnity escrow / holdback", type: "escrow", amount: 0, treatment: "included", allocationBasis: "pro-rata", eligibility: "escrow", expectedPercent: 95, years: 1.5 },
  { id: "expense-fund", label: "Stockholder representative expense fund", type: "escrow", amount: 0, treatment: "included", allocationBasis: "pro-rata", eligibility: "escrow", expectedPercent: 80, years: 2 },
  { id: "seller-note", label: "Seller note", type: "note", amount: 0, treatment: "included", allocationBasis: "pro-rata", eligibility: "deferred", expectedPercent: 95, years: 2 },
  { id: "earnout", label: "Earnout / contingent value", type: "earnout", amount: 0, treatment: "included", allocationBasis: "cumulative", eligibility: "deferred", expectedPercent: 50, years: 2 },
  { id: "rollover", label: "Rollover equity", type: "rollover", amount: 0, treatment: "included", allocationBasis: "pro-rata", eligibility: "deferred", expectedPercent: 85, years: 4 },
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
    holdingPeriodYears: 5,
    preferenceMultiple: 0,
    secondaryPreferenceMultiple: 0,
    secondarySeniority: 1,
    accruedDividend: 0,
    dividendType: "none",
    dividendRate: 0,
    dividendYears: 0,
    dividendPeriods: 1,
    paidDividends: 0,
    dividendsCountTowardCap: true,
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
  { id: "seed-employee", label: "Employee joining at Seed", entryStage: "seed", equityType: "option", grantShares: 100_000, strike: 0.12, eligiblePercent: 100, alreadyExercised: true, accelerationPercent: 0, transactionBonus: 0, retentionBonus: 0, retentionYears: 2 },
  { id: "series-a-employee", label: "Employee joining at Series A", entryStage: "series-a", equityType: "option", grantShares: 100_000, strike: 0.43, eligiblePercent: 100, alreadyExercised: true, accelerationPercent: 0, transactionBonus: 0, retentionBonus: 0, retentionYears: 2 },
  { id: "series-b-employee", label: "Employee joining at Series B", entryStage: "series-b", equityType: "option", grantShares: 100_000, strike: 1.14, eligiblePercent: 100, alreadyExercised: true, accelerationPercent: 0, transactionBonus: 0, retentionBonus: 0, retentionYears: 2 },
  { id: "series-c-employee", label: "Employee joining at Series C", entryStage: "series-c", equityType: "option", grantShares: 100_000, strike: 1.14, eligiblePercent: 100, alreadyExercised: true, accelerationPercent: 0, transactionBonus: 0, retentionBonus: 0, retentionYears: 2 },
  { id: "series-d-employee", label: "Employee joining at Series D", entryStage: "series-d", equityType: "option", grantShares: 100_000, strike: 18.90, eligiblePercent: 100, alreadyExercised: true, accelerationPercent: 0, transactionBonus: 0, retentionBonus: 0, retentionYears: 2 },
  { id: "series-e-employee", label: "Employee joining at Series E", entryStage: "series-e", equityType: "option", grantShares: 100_000, strike: 32.79, eligiblePercent: 100, alreadyExercised: true, accelerationPercent: 0, transactionBonus: 0, retentionBonus: 0, retentionYears: 2 },
  { id: "series-f-employee", label: "Employee joining at Series F", entryStage: "series-f", equityType: "option", grantShares: 100_000, strike: 32.79, eligiblePercent: 100, alreadyExercised: true, accelerationPercent: 0, transactionBonus: 0, retentionBonus: 0, retentionYears: 2 },
  { id: "growth-employee", label: "Employee joining in 2023+", entryStage: "growth", equityType: "option", grantShares: 100_000, strike: 62.64, eligiblePercent: 75, alreadyExercised: false, accelerationPercent: 0, transactionBonus: 0, retentionBonus: 0, retentionYears: 2 },
];

const airtablePeopleCohorts = () => {
  const exerciseByStage = {
    "seed-employee": 100,
    "series-a-employee": 100,
    "series-b-employee": 95,
    "series-c-employee": 90,
    "series-d-employee": 75,
    "series-e-employee": 60,
    "series-f-employee": 50,
    "growth-employee": 25,
  };
  return standardPeopleCohorts().map((cohort) => ({
    ...cohort,
    exercisedPercent: exerciseByStage[cohort.id],
    recoveryFloorMultiple: 1,
  }));
};

const brexPeopleCohorts = () => [
  { id: "brex-series-a-employee", label: "Employee joining at Series A", entryStage: "series-a", equityType: "option", grantShares: 100_000, strike: 0.10, eligiblePercent: 100, exercisedPercent: 100, recoveryFloorMultiple: 1, accelerationPercent: 0, transactionBonus: 0, retentionBonus: 0, retentionYears: 2 },
  { id: "brex-series-b-employee", label: "Employee joining at Series B", entryStage: "series-b", equityType: "option", grantShares: 100_000, strike: 0.50, eligiblePercent: 100, exercisedPercent: 100, recoveryFloorMultiple: 1, accelerationPercent: 0, transactionBonus: 0, retentionBonus: 0, retentionYears: 2 },
  { id: "brex-series-c-employee", label: "Employee joining at Series C", entryStage: "series-c", equityType: "option", grantShares: 100_000, strike: 3.00, eligiblePercent: 100, exercisedPercent: 95, recoveryFloorMultiple: 1, accelerationPercent: 0, transactionBonus: 0, retentionBonus: 0, retentionYears: 2 },
  { id: "brex-series-c2-employee", label: "Employee joining at Series C-2", entryStage: "series-c", equityType: "option", grantShares: 100_000, strike: 6.00, eligiblePercent: 100, exercisedPercent: 90, recoveryFloorMultiple: 1, accelerationPercent: 0, transactionBonus: 0, retentionBonus: 0, retentionYears: 2 },
  { id: "brex-2020-employee", label: "Employee joining in 2020", entryStage: "growth", equityType: "option", grantShares: 100_000, strike: 7.50, eligiblePercent: 100, exercisedPercent: 80, recoveryFloorMultiple: 1, accelerationPercent: 0, transactionBonus: 0, retentionBonus: 0, retentionYears: 2 },
  { id: "brex-series-d-employee", label: "Employee joining at Series D", entryStage: "series-d", equityType: "option", grantShares: 100_000, strike: 18.00, eligiblePercent: 100, exercisedPercent: 65, recoveryFloorMultiple: 1, accelerationPercent: 0, transactionBonus: 0, retentionBonus: 0, retentionYears: 2 },
  { id: "brex-series-d2-employee", label: "Employee joining at Series D-2", entryStage: "series-e", equityType: "option", grantShares: 100_000, strike: 30.00, eligiblePercent: 100, exercisedPercent: 50, recoveryFloorMultiple: 1, accelerationPercent: 0, transactionBonus: 0, retentionBonus: 0, retentionYears: 2 },
  { id: "brex-2023-employee", label: "Employee joining in 2023+", entryStage: "growth", equityType: "option", grantShares: 100_000, strike: 20.00, eligiblePercent: 75, exercisedPercent: 25, recoveryFloorMultiple: 1, accelerationPercent: 0, transactionBonus: 0, retentionBonus: 0, retentionYears: 2 },
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
  dividendsCountTowardCap: true,
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
  new: {
    meta: {
      preset: "new",
      title: "New configurable deal",
      description: "A neutral starting model with editable deal, security, consideration and employee assumptions.",
      asOf: "Illustrative",
      sources: [],
    },
    deal: {
      name: "New transaction",
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
    peopleCohorts: [],
    stakeholders: [
      cleanHolder({ id: "founders", name: "Founders", className: "Founder common", series: "formation", category: "founder", securityType: "common", shares: 70_000_000 }),
      cleanHolder({ id: "employees", name: "Employees and other common holders", className: "Employee common", series: "common", category: "employee", securityType: "common", shares: 20_000_000 }),
      cleanHolder({ id: "series-a", name: "Series A investors", className: "Series A preferred", series: "series-a", securityType: "preferred", shares: 10_000_000, invested: 10_000_000, roundSize: 10_000_000, investorInvestment: 10_000_000, holdingPeriodYears: 5, seniority: 1 }),
    ],
  },
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
      cleanHolder({ id: "series-a", name: "Series A investors", className: "Series A preferred", series: "series-a", securityType: "preferred", shares: 20_000_000, invested: 20_000_000, roundSize: 20_000_000, investorInvestment: 20_000_000, holdingPeriodYears: 5, seniority: 1 }),
    ],
  },
  airtable: {
    meta: {
      preset: "airtable",
      title: "Airtable: announced acquisition",
      description: "Evidence-based best estimate of Bending Spoons' announced all-cash acquisition, using filing-derived class counts, original issue prices and the documented 1× pari passu preference stack.",
      asOf: "Announced August 4, 2026 and not yet closed. Reported: $1.285B purchase price and $2.25B implied equity value including cash. The default bridge therefore uses $965M of cash and no undisclosed fees, escrows or contingent consideration. Filing-derived shares and original issue prices are modeled separately for Seed through Series F; 1× non-participating preferences rank pari passu and every class elects its financially optimal treatment. Public information discloses 21,981,692 aggregate common shares but not the founder split, so 12M founder shares and 9,981,692 employee/other common shares remain an editable midpoint estimate. The additional 667,395 Series FF shares are founders preferred issued at formation; because no separate exit preference is disclosed, the model treats them as common-like founder equity. Employee rows are normalized 100K-award scenarios, not headcount populations. Exercise rates decline by entry stage; the 2023+ row assumes 25% of vested options were exercised. A 1× cost-recovery make-whole on exercised shares is a modeled transaction-protection assumption, not a disclosed Airtable term.",
      sources: [
        {
          label: "Axios: announced Airtable acquisition",
          url: "https://www.axios.com/newsletters/axios-pro-rata-f1a989ea-b33c-4058-a94b-4cfce74faa1c",
          note: "Axios reported a $1.285B all-cash purchase price and a $2.25B implied equity value including Airtable cash and cash equivalents on August 4, 2026.",
        },
        {
          label: "Notice.co Airtable cap-table report",
          url: "https://notice-reports.s3.amazonaws.com/Airtable%20Report%202024.12.24_16.17.16.pdf",
          note: "The December 2024 report compiles corporate filings into 58,734,171 outstanding shares, including 667,395 Series FF shares issued at formation, plus class-level original issue prices and 1× pari passu non-participating preferences. Its community-sourced 409A history is used only to anchor illustrative employee strikes.",
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
      transactionFees: 0,
      bonuses: 0,
      transferTaxes: 0,
      otherAdjustment: 0,
      discountRate: 12,
    },
    terms: sharedTerms({ liquidationPreference: true, pariPassu: true, preferenceMultiple: 1 }),
    tranches: zeroTranches(),
    peopleCohorts: airtablePeopleCohorts(),
    stakeholders: [
      cleanHolder({ id: "founders", name: "Airtable founders: Howie Liu, Andrew Ofstad and Emmett Nicholas (modeled)", className: "Founder common", series: "formation", category: "founder", securityType: "common", shares: 12_000_000, displayOrder: 0 }),
      cleanHolder({ id: "employee-common", name: "Employees and other common holders (modeled residual)", className: "Employee and other common", series: "common", category: "employee", securityType: "common", shares: 9_981_692, displayOrder: 0.5 }),
      cleanHolder({ id: "seed", name: "Seed preferred", className: "Seed preferred", series: "seed", securityType: "preferred", shares: 3_185_182, invested: 2_200_005, roundSize: 2_200_005, investorInvestment: 2_200_005, holdingPeriodYears: 12, seniority: 7, displayOrder: 1 }),
      cleanHolder({ id: "series-a", name: "Series A preferred", className: "Series A preferred", series: "series-a", securityType: "preferred", shares: 5_654_062, invested: 7_638_638, roundSize: 7_638_638, investorInvestment: 7_638_638, holdingPeriodYears: 11, seniority: 6, displayOrder: 2 }),
      cleanHolder({ id: "series-a1", name: "Series A-1 preferred", className: "Series A-1 preferred", series: "series-a", securityType: "preferred", shares: 657_947, invested: 799_998, roundSize: 799_998, investorInvestment: 799_998, holdingPeriodYears: 10, seniority: 6, displayOrder: 2.1 }),
      cleanHolder({ id: "series-b", name: "Series B preferred", className: "Series B preferred", series: "series-b", securityType: "preferred", shares: 6_794_182, invested: 21_559_978, roundSize: 21_559_978, investorInvestment: 21_559_978, holdingPeriodYears: 8.4, seniority: 5, displayOrder: 3 }),
      cleanHolder({ id: "series-b1", name: "Series B-1 preferred", className: "Series B-1 preferred", series: "series-b", securityType: "preferred", shares: 4_597_210, invested: 35_849_963, roundSize: 35_849_963, investorInvestment: 35_849_963, holdingPeriodYears: 8, seniority: 5, displayOrder: 3.1 }),
      cleanHolder({ id: "series-c", name: "Series C preferred", className: "Series C preferred", series: "series-c", securityType: "preferred", shares: 3_854_617, invested: 103_024_661, roundSize: 103_024_661, investorInvestment: 103_024_661, holdingPeriodYears: 7.7, seniority: 4, displayOrder: 4 }),
      cleanHolder({ id: "series-c1", name: "Series C-1 preferred", className: "Series C-1 preferred", series: "series-c", securityType: "preferred", shares: 658_139, invested: 5_299_993, roundSize: 5_299_993, investorInvestment: 5_299_993, holdingPeriodYears: 7, seniority: 4, displayOrder: 4.1 }),
      cleanHolder({ id: "series-d", name: "Series D preferred", className: "Series D preferred", series: "series-d", securityType: "preferred", shares: 3_360_489, invested: 189_999_360, roundSize: 189_999_360, investorInvestment: 189_999_360, holdingPeriodYears: 5.9, seniority: 3, displayOrder: 5 }),
      cleanHolder({ id: "series-e", name: "Series E preferred", className: "Series E preferred", series: "series-e", securityType: "preferred", shares: 3_131_683, invested: 334_998_949, roundSize: 270_000_000, investorInvestment: 270_000_000, holdingPeriodYears: 5.4, seniority: 2, displayOrder: 6 }),
      cleanHolder({ id: "series-f", name: "Series F preferred", className: "Series F preferred", series: "series-f", securityType: "preferred", shares: 4_191_573, invested: 785_016_654, roundSize: 735_000_000, investorInvestment: 735_000_000, holdingPeriodYears: 4.7, seniority: 1, displayOrder: 7 }),
      cleanHolder({ id: "series-ff", name: "Founder FF stock issued at formation", className: "Founder FF (common-like)", series: "formation", category: "founder", securityType: "common", shares: 667_395, displayOrder: 0.2 }),
    ],
  },
  brex: {
    meta: {
      preset: "brex",
      title: "Brex: completed acquisition",
      description: "Capital One's completed cash-and-stock acquisition using disclosed closing consideration and a financing-class model calibrated to the merger's reported Series D and D-2 proceeds.",
      asOf: "Closed April 7, 2026. Capital One disclosed $2.56B cash plus 10,646,306 shares worth $1.929B at the $181.15 closing price, or $4.489B total fair value. The preset derives a 354.1M-share capitalization from Brex's $12.3B Series D-2 valuation and $34.73595 issue price, then uses ClearList's class-level financing amounts and preferred prices. This reproduces the disclosed $22.57881 Series D and $34.73595 Series D-2 proceeds as 1× preferences. The Form 8937 describes holder-level cash/stock elections and accreditation rules; because those elections are not public, buyer stock is shown as an aggregate pro-rata modeling assumption rather than the actual holder-by-holder mix. Founder ownership uses Forbes' January 2022 estimate of 14% each; the remaining common is employees, former employees and other holders. All derived ownership and employee exercise inputs remain editable.",
      sources: [
        {
          label: "Capital One closing Form 8-K",
          url: "https://www.sec.gov/Archives/edgar/data/927628/000119312526145764/d85207d8k.htm",
          note: "Capital One disclosed about $2.56B of cash and 10,646,306 Capital One shares at closing, subject to a customary post-closing adjustment.",
        },
        {
          label: "Capital One Form 8937 attachment",
          url: "https://investor.capitalone.com/static-files/4845bdc7-8508-4364-b508-5e93ab3c2833",
          note: "The tax disclosure reports $22.57881 per Series D share, $34.73595 per Series D-2 share and a $181.15 Capital One closing price. It also describes cash/stock elections and accreditation-based treatment that cannot be reconstructed holder by holder from public data.",
        },
        {
          label: "Brex Series D-2 announcement",
          url: "https://www.brex.com/journal/welcoming-karan-and-our-series-d-2-round",
          note: "Brex disclosed a $300M Series D-2 at a $12.3B valuation. This financing reference does not disclose the closing cap table used by the merger.",
        },
        {
          label: "ClearList Q4 2021 Brex report",
          url: "https://www.clearlist.com/wp-content/uploads/2021/10/Q4_2021_Recon_Report.pdf",
          note: "Reports class-level investment amounts, preferred prices and pari passu 0–1× liquidation terms for Series A through D.",
        },
        {
          label: "Forbes: Brex founder ownership estimate",
          url: "https://www.forbes.com/sites/elizahaverstock/2022/01/14/two-friends-who-met-on-twitter-in-high-school-are-latest-under-30-billionaires/",
          note: "Forbes estimated Henrique Dubugras and Pedro Franceschi each owned 14% after the Series D-2 financing. The preset carries that estimate to closing without assuming later dilution.",
        },
        {
          label: "Capital One Brex resale prospectus",
          url: "https://investor.capitalone.com/static-files/163aa15d-01e1-4406-8eec-36221d67bba3",
          note: "Registers Capital One shares issued as partial consideration for Brex securities. It confirms security-holder stock consideration but does not publicly disclose each employee option's strike or award treatment.",
        },
      ],
    },
    deal: {
      name: "Brex / Capital One",
      enterpriseValue: 4_488_578_332,
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
    terms: sharedTerms({ liquidationPreference: true, pariPassu: true, preferenceMultiple: 1 }),
    peopleCohorts: brexPeopleCohorts(),
    tranches: [
      { id: "buyer-stock", label: "Capital One stock", type: "stock", amount: 1_928_578_332, treatment: "included", allocationBasis: "pro-rata", eligibility: "all", expectedPercent: 100, years: 0 },
      ...zeroTranches().slice(1),
    ],
    stakeholders: [
      cleanHolder({ id: "henrique", name: "Henrique Dubugras (14% 2022 estimate)", className: "Founder common", series: "formation", category: "founder", securityType: "common", shares: 49_574_000, displayOrder: 0 }),
      cleanHolder({ id: "pedro", name: "Pedro Franceschi (14% 2022 estimate)", className: "Founder common", series: "formation", category: "founder", securityType: "common", shares: 49_574_000, displayOrder: 0.1 }),
      cleanHolder({ id: "employees", name: "Employees, former employees and other common (derived residual)", className: "Employee and other common", series: "common", category: "employee", securityType: "common", shares: 87_672_640, displayOrder: 0.5 }),
      cleanHolder({ id: "brex-a", name: "Series A preferred", className: "Series A preferred", series: "series-a", securityType: "preferred", shares: 37_965_784, invested: 6_480_000, roundSize: 6_480_000, investorInvestment: 6_480_000, holdingPeriodYears: 9, seniority: 1, displayOrder: 1 }),
      cleanHolder({ id: "brex-b", name: "Series B preferred", className: "Series B preferred", series: "series-b", securityType: "preferred", shares: 42_361_186, invested: 47_270_000, roundSize: 47_270_000, investorInvestment: 47_270_000, holdingPeriodYears: 8, seniority: 1, displayOrder: 2 }),
      cleanHolder({ id: "brex-c", name: "Series C preferred", className: "Series C preferred", series: "series-c", securityType: "preferred", shares: 33_104_944, invested: 163_310_000, roundSize: 163_310_000, investorInvestment: 163_310_000, holdingPeriodYears: 7, seniority: 1, displayOrder: 3 }),
      cleanHolder({ id: "brex-c2", name: "Series C-2 preferred", className: "Series C-2 preferred", series: "series-c", securityType: "preferred", shares: 26_605_809, invested: 285_860_000, roundSize: 285_860_000, investorInvestment: 285_860_000, holdingPeriodYears: 6, seniority: 1, displayOrder: 4 }),
      cleanHolder({ id: "brex-d", name: "Series D preferred", className: "Series D preferred", series: "series-d", securityType: "preferred", shares: 18_605_055, invested: 420_080_000, roundSize: 420_080_000, investorInvestment: 420_080_000, holdingPeriodYears: 5, seniority: 1, displayOrder: 5 }),
      cleanHolder({ id: "brex-d2", name: "Series D-2 preferred", className: "Series D-2 preferred", series: "series-e", securityType: "preferred", shares: 8_636_585, invested: 300_000_000, roundSize: 300_000_000, investorInvestment: 300_000_000, holdingPeriodYears: 4.25, seniority: 1, displayOrder: 6 }),
    ],
  },
  venture: {
    meta: {
      preset: "venture",
      title: "Venture-backed sale: advanced terms",
      description: "An illustrative seniority stack with class-specific preferences, participation, a down-round ratchet, escrows and an earnout.",
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
      { id: "buyer-stock", label: "Buyer stock", type: "stock", amount: 10_000_000, treatment: "included", allocationBasis: "pro-rata", eligibility: "all", expectedPercent: 95, years: 0 },
      { id: "ppa-escrow", label: "Purchase-price adjustment escrow", type: "escrow", amount: 650_000, treatment: "included", allocationBasis: "pro-rata", eligibility: "escrow", expectedPercent: 98, years: 0.25 },
      { id: "indemnity-escrow", label: "Indemnity escrow / holdback", type: "escrow", amount: 3_300_000, treatment: "included", allocationBasis: "pro-rata", eligibility: "escrow", expectedPercent: 90, years: 1.5 },
      { id: "expense-fund", label: "Stockholder representative expense fund", type: "escrow", amount: 250_000, treatment: "included", allocationBasis: "pro-rata", eligibility: "escrow", expectedPercent: 60, years: 2 },
      { id: "seller-note", label: "Seller note", type: "note", amount: 5_000_000, treatment: "included", allocationBasis: "pro-rata", eligibility: "deferred", expectedPercent: 90, years: 2 },
      { id: "earnout", label: "Earnout / contingent value", type: "earnout", amount: 10_000_000, treatment: "incremental", allocationBasis: "cumulative", eligibility: "deferred", expectedPercent: 55, years: 2 },
      { id: "rollover", label: "Rollover equity", type: "rollover", amount: 4_000_000, treatment: "included", allocationBasis: "pro-rata", eligibility: "deferred", expectedPercent: 80, years: 4 },
    ],
    stakeholders: [
      cleanHolder({ id: "founders", name: "Founders", className: "Founder common", series: "formation", category: "founder", securityType: "common", shares: 30_000_000 }),
      cleanHolder({ id: "employees", name: "Employee common & RSUs", className: "Employee equity", category: "employee", securityType: "rsu", shares: 5_000_000 }),
      cleanHolder({ id: "options", name: "Options", className: "Options", category: "employee", securityType: "option", shares: 10_000_000, strike: 0.5, eligiblePercent: 75, escrowEligible: false, deferredEligible: false }),
      cleanHolder({ id: "seed", name: "Seed preferred", className: "Seed preferred", series: "seed", securityType: "preferred", shares: 10_000_000, invested: 5_000_000, holdingPeriodYears: 10, preferenceEnabled: true, useSharedTerms: false, preferenceMultiple: 1, seniority: 3 }),
      cleanHolder({ id: "series-a", name: "Series A preferred", className: "Series A preferred", series: "series-a", securityType: "preferred", shares: 15_000_000, invested: 15_000_000, holdingPeriodYears: 7, preferenceEnabled: true, useSharedTerms: false, preferenceMultiple: 1, seniority: 2, participatingPreferred: true, cappedParticipation: true, participation: "capped", capMultiple: 3 }),
      cleanHolder({ id: "series-b1", name: "Series B lead", className: "Series B preferred", series: "series-b", securityType: "preferred", shares: 7_000_000, invested: 14_000_000, holdingPeriodYears: 4, preferenceEnabled: true, useSharedTerms: false, preferenceMultiple: 2, seniority: 1, antiDilution: true, ratchetType: "weighted-average", originalPrice: 2, downRoundPrice: 1.25, preRoundShares: 70_000_000, newMoney: 10_000_000 }),
      cleanHolder({ id: "series-b2", name: "Series B syndicate", className: "Series B preferred", series: "series-b", securityType: "preferred", shares: 3_000_000, invested: 6_000_000, holdingPeriodYears: 4, preferenceEnabled: true, useSharedTerms: false, preferenceMultiple: 2, seniority: 1 }),
    ],
  },
};

export function clonePreset(name = "airtable") {
  return structuredClone(PRESETS[name] || PRESETS.airtable);
}

export function blankStakeholder(id) {
  return cleanHolder({ id, name: "New investor round", className: "Series A preferred", series: "series-a", securityType: "preferred", shares: 0, seniority: 1 });
}

export function applySecurityTypeDefaults(holder, securityType) {
  const next = { ...holder, securityType };
  if (securityType === "safe" || securityType === "note") {
    next.preferenceEnabled = true;
    next.preferenceMultiple = numberValue(holder.preferenceMultiple) > 0 ? numberValue(holder.preferenceMultiple) : 1;
    next.optimalConversion = true;
    next.conversionPolicy = "elective";
    next.participation = "none";
    next.participatingPreferred = false;
    next.cappedParticipation = false;
    next.seniority = Math.max(1, numberValue(holder.seniority) || 1);
    next.useSharedTerms = true;
    next.className = securityType === "safe" ? "SAFE" : "Convertible note";
  }
  if (securityType === "preferred") {
    next.useSharedTerms = true;
    next.preferenceEnabled = true;
    next.optimalConversion = true;
    next.className = holder.className && !["SAFE", "Convertible note"].includes(holder.className)
      ? holder.className
      : "Preferred stock";
  }
  return next;
}

export function blankPeopleCohort(id) {
  return { id, label: "Employee joining at Series A", entryStage: "series-a", equityType: "option", grantShares: 100_000, strike: 0, eligiblePercent: 100, exercisedPercent: 0, recoveryFloorMultiple: 0, accelerationPercent: 0, transactionBonus: 0, retentionBonus: 0, retentionYears: 2 };
}

export function blankTranche(id) {
  return { id, label: "Other deferred consideration", type: "other", amount: 0, treatment: "included", allocationBasis: "pro-rata", eligibility: "all", expectedPercent: 100, years: 0 };
}
