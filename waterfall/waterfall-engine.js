const EPSILON = 0.01;

export function computeEquityBridge(deal) {
  const rows = [
    { key: "enterpriseValue", label: "Enterprise value", value: number(deal.enterpriseValue), sign: 1 },
    { key: "cash", label: "Cash and investments added", value: number(deal.cash), sign: 1 },
    { key: "debt", label: "Debt payoff", value: number(deal.debt), sign: -1 },
    { key: "debtLike", label: "Debt-like items", value: number(deal.debtLike), sign: -1 },
    { key: "workingCapital", label: "Working-capital adjustment", value: number(deal.workingCapital), sign: 1 },
    { key: "transactionFees", label: "Transaction expenses", value: number(deal.transactionFees), sign: -1 },
    { key: "bonuses", label: "Change-in-control / carve-out", value: number(deal.bonuses), sign: -1 },
    { key: "transferTaxes", label: "Transfer and entity-level taxes", value: number(deal.transferTaxes), sign: -1 },
    { key: "otherAdjustment", label: "Other purchase-price adjustment", value: number(deal.otherAdjustment), sign: 1 },
  ];

  const rawEquityValue = rows.reduce((sum, row) => sum + row.sign * row.value, 0);
  return { rows, rawEquityValue, equityValue: Math.max(0, rawEquityValue) };
}

export function computeWaterfall(stakeholders, proceeds) {
  const normalized = stakeholders.map(normalizeStakeholder);
  const preferred = normalized.filter(isPreferenceSecurity);
  const warnings = [];

  if (preferred.filter((holder) => holder.conversionPolicy === "elective").length > 12) {
    warnings.push("The conversion-election solver supports up to 12 preferred classes; only the first 12 were optimized.");
  }

  const elective = preferred.filter((holder) => holder.conversionPolicy === "elective").slice(0, 12);
  const combinations = 2 ** elective.length;
  const allocations = new Array(combinations);

  for (let mask = 0; mask < combinations; mask += 1) {
    const choices = new Map();
    elective.forEach((holder, index) => choices.set(holder.id, Boolean(mask & (1 << index))));
    preferred.forEach((holder) => {
      if (holder.conversionPolicy === "force-preference") choices.set(holder.id, true);
      if (holder.conversionPolicy === "force-convert") choices.set(holder.id, false);
      if (!choices.has(holder.id)) choices.set(holder.id, false);
    });
    allocations[mask] = allocateWithChoices(normalized, Math.max(0, number(proceeds)), choices);
  }

  let selectedMask = 0;
  let lowestRegret = Number.POSITIVE_INFINITY;
  let stableFound = false;

  for (let mask = 0; mask < combinations; mask += 1) {
    let regret = 0;
    for (let index = 0; index < elective.length; index += 1) {
      const current = allocations[mask].payouts[elective[index].id] || 0;
      const alternative = allocations[mask ^ (1 << index)].payouts[elective[index].id] || 0;
      regret += Math.max(0, alternative - current);
    }
    const isStable = regret <= EPSILON;
    if ((isStable && !stableFound) || (isStable === stableFound && regret < lowestRegret - EPSILON)) {
      stableFound = isStable;
      lowestRegret = regret;
      selectedMask = mask;
    }
  }

  const result = allocations[selectedMask];
  result.warnings.push(...warnings);
  result.stableElection = stableFound;
  result.conversionRegret = lowestRegret;
  return result;
}

export function applySharedTerms(stakeholders, terms = null) {
  if (!terms || typeof terms !== "object") return stakeholders.map((holder) => ({ ...holder }));

  const preferenceRows = stakeholders
    .map((holder, index) => ({ holder, index }))
    .filter(({ holder }) => isPreferenceSecurity(holder))
    .sort((a, b) => optionalOrder(b.holder.displayOrder, b.index) - optionalOrder(a.holder.displayOrder, a.index));
  const sequentialTier = new Map(preferenceRows.map(({ holder }, index) => [holder.id, index + 1]));
  const preferenceEnabled = terms.liquidationPreference === true;
  const participation = preferenceEnabled && terms.participatingPreferred === true
    ? (terms.cappedParticipation === true ? "capped" : "full")
    : "none";
  const dividendType = preferenceEnabled && terms.cumulativeDividends === true
    ? (terms.dividendType || "simple")
    : "none";
  const ratchetType = terms.antiDilution === true ? (terms.ratchetType || "weighted-average") : "none";

  return stakeholders.map((holder) => {
    if (holder.useSharedTerms === false) {
      if (!isPreferenceSecurity(holder)) return { ...holder };
      const individualPreference = holder.preferenceEnabled === true;
      const individualParticipation = individualPreference && holder.participatingPreferred === true
        ? (holder.cappedParticipation === true ? "capped" : "full")
        : "none";
      const individualDividend = individualPreference && holder.cumulativeDividends === true
        ? (["fixed", "simple", "compound"].includes(holder.dividendType) ? holder.dividendType : "simple")
        : "none";
      const individualRatchet = holder.antiDilution === true
        ? (["full-ratchet", "weighted-average", "custom"].includes(holder.ratchetType) ? holder.ratchetType : "weighted-average")
        : "none";
      return {
        ...holder,
        preferenceMultiple: individualPreference ? Math.max(0, number(holder.preferenceMultiple || 1)) : 0,
        seniority: Math.max(1, Math.round(number(holder.seniority || 1))),
        participation: individualParticipation,
        capMultiple: individualParticipation === "capped" ? Math.max(0, number(holder.capMultiple || 0)) : 0,
        conversionPolicy: individualPreference ? (holder.optimalConversion !== false ? "elective" : "force-preference") : "force-convert",
        dividendType: individualDividend,
        accruedDividend: individualDividend === "fixed" ? Math.max(0, number(holder.accruedDividend)) : 0,
        dividendRate: ["simple", "compound"].includes(individualDividend) ? Math.max(0, number(holder.dividendRate)) : 0,
        dividendYears: ["simple", "compound"].includes(individualDividend) ? Math.max(0, number(holder.dividendYears)) : 0,
        dividendPeriods: individualDividend === "compound" ? Math.max(1, Math.round(number(holder.dividendPeriods || 1))) : 1,
        paidDividends: individualDividend !== "none" ? Math.max(0, number(holder.paidDividends)) : 0,
        ratchetType: individualRatchet,
        originalPrice: individualRatchet !== "none" ? Math.max(0, number(holder.originalPrice)) : 0,
        downRoundPrice: individualRatchet !== "none" ? Math.max(0, number(holder.downRoundPrice)) : 0,
        preRoundShares: individualRatchet === "weighted-average" ? Math.max(0, number(holder.preRoundShares)) : 0,
        newMoney: individualRatchet === "weighted-average" ? Math.max(0, number(holder.newMoney)) : 0,
        conversionMultiplier: individualRatchet === "custom" ? Math.max(0, number(holder.conversionMultiplier || 1)) : 1,
        secondaryPreferenceMultiple: 0,
        priorDistributions: 0,
        waiverPercent: 0,
      };
    }

    const shared = {
      ...holder,
      escrowEligible: terms.escrowEligibleAll !== false,
      deferredEligible: terms.deferredEligibleAll !== false,
    };
    if (!isPreferenceSecurity(holder)) return shared;

    return {
      ...shared,
      preferenceMultiple: preferenceEnabled ? Math.max(0, number(terms.preferenceMultiple || 1)) : 0,
      seniority: terms.pariPassu === true ? 1 : Math.max(1, Math.round(number(holder.seniority || sequentialTier.get(holder.id) || 1))),
      participation,
      capMultiple: participation === "capped" ? Math.max(0, number(terms.participationCap || 0)) : 0,
      conversionPolicy: preferenceEnabled ? (terms.optimalConversion !== false ? "elective" : "force-preference") : "force-convert",
      dividendType,
      accruedDividend: dividendType === "fixed" ? Math.max(0, number(terms.accruedDividend)) : 0,
      dividendRate: ["simple", "compound"].includes(dividendType) ? Math.max(0, number(terms.dividendRate)) : 0,
      dividendYears: ["simple", "compound"].includes(dividendType) ? Math.max(0, number(terms.dividendYears)) : 0,
      dividendPeriods: dividendType === "compound" ? Math.max(1, Math.round(number(terms.dividendPeriods || 1))) : 1,
      paidDividends: dividendType !== "none" ? Math.max(0, number(terms.paidDividends)) : 0,
      ratchetType,
      originalPrice: ratchetType !== "none" ? Math.max(0, number(terms.originalPrice)) : 0,
      downRoundPrice: ratchetType !== "none" ? Math.max(0, number(terms.downRoundPrice)) : 0,
      preRoundShares: ratchetType === "weighted-average" ? Math.max(0, number(terms.preRoundShares)) : 0,
      newMoney: ratchetType === "weighted-average" ? Math.max(0, number(terms.newMoney)) : 0,
      conversionMultiplier: ratchetType === "custom" ? Math.max(0, number(terms.conversionMultiplier || 1)) : 1,
      secondaryPreferenceMultiple: 0,
      priorDistributions: 0,
      waiverPercent: 0,
    };
  });
}

function allocateWithChoices(stakeholders, proceeds, choices) {
  const payouts = Object.fromEntries(stakeholders.map((holder) => [holder.id, 0]));
  const preferencePaid = Object.fromEntries(stakeholders.map((holder) => [holder.id, 0]));
  const participationPaid = Object.fromEntries(stakeholders.map((holder) => [holder.id, 0]));
  const choiceById = {};
  const warnings = [];
  let available = proceeds;

  const preferenceHolders = stakeholders.filter((holder) => isPreferenceSecurity(holder) && choices.get(holder.id));
  const claims = preferenceHolders.flatMap((holder) => preferenceClaims(holder).map((claim) => ({ ...claim, holder })));
  const tiers = [...new Set(claims.map((claim) => claim.seniority))].sort((a, b) => a - b);

  for (const tier of tiers) {
    const tierClaims = claims.filter((claim) => claim.seniority === tier);
    const totalClaim = tierClaims.reduce((sum, claim) => sum + claim.amount, 0);
    const paidAtTier = Math.min(available, totalClaim);
    tierClaims.forEach((claim) => {
      const paid = totalClaim > 0 ? paidAtTier * (claim.amount / totalClaim) : 0;
      preferencePaid[claim.holder.id] += paid;
      payouts[claim.holder.id] += paid;
    });
    available -= paidAtTier;
  }

  const commonLike = [];
  const options = [];
  const cappedParticipants = [];

  for (const holder of stakeholders) {
    const shares = effectiveShares(holder);
    if (holder.securityType === "option" || holder.securityType === "warrant") {
      options.push({ holder, shares });
      continue;
    }
    if (!isPreferenceSecurity(holder)) {
      commonLike.push({ holder, shares, capRemaining: Number.POSITIVE_INFINITY });
      continue;
    }

    const takesPreference = Boolean(choices.get(holder.id));
    choiceById[holder.id] = takesPreference ? "preference" : "convert";
    if (!takesPreference) {
      commonLike.push({ holder, shares, capRemaining: Number.POSITIVE_INFINITY });
    } else if (holder.participation === "full") {
      commonLike.push({ holder, shares, capRemaining: Number.POSITIVE_INFINITY });
    } else if (holder.participation === "capped") {
      const capValue = holder.invested * holder.capMultiple;
      cappedParticipants.push({
        holder,
        shares,
        capRemaining: Math.max(0, capValue - preferencePaid[holder.id]),
      });
    }
  }

  const distributedAtPrice = (price) => {
    const commonDistribution = commonLike.reduce((sum, item) => sum + item.shares * price, 0);
    const optionDistribution = options.reduce(
      (sum, item) => sum + Math.max(0, price - item.holder.strike) * item.shares,
      0,
    );
    const cappedDistribution = cappedParticipants.reduce(
      (sum, item) => sum + Math.min(item.capRemaining, item.shares * price),
      0,
    );
    return commonDistribution + optionDistribution + cappedDistribution;
  };

  let pricePerShare = 0;
  if (available > EPSILON) {
    let high = 1;
    while (distributedAtPrice(high) < available && high < 1e15) high *= 2;
    if (distributedAtPrice(high) < available) {
      warnings.push("Residual proceeds could not be fully allocated because no eligible common-equivalent securities remain.");
    } else {
      let low = 0;
      for (let index = 0; index < 100; index += 1) {
        const midpoint = (low + high) / 2;
        if (distributedAtPrice(midpoint) < available) low = midpoint;
        else high = midpoint;
      }
      pricePerShare = (low + high) / 2;
    }
  }

  commonLike.forEach((item) => {
    const amount = item.shares * pricePerShare;
    payouts[item.holder.id] += amount;
    if (isPreferenceSecurity(item.holder) && choices.get(item.holder.id)) {
      participationPaid[item.holder.id] += amount;
    }
  });
  cappedParticipants.forEach((item) => {
    const amount = Math.min(item.capRemaining, item.shares * pricePerShare);
    payouts[item.holder.id] += amount;
    participationPaid[item.holder.id] += amount;
  });
  options.forEach((item) => {
    payouts[item.holder.id] += Math.max(0, pricePerShare - item.holder.strike) * item.shares;
  });

  const totalPayout = Object.values(payouts).reduce((sum, amount) => sum + amount, 0);

  stakeholders.forEach((holder) => {
    if (!isPreferenceSecurity(holder)) choiceById[holder.id] = "not applicable";
  });

  reconcileToCents(payouts, Math.min(proceeds, totalPayout), stakeholders.map((holder) => holder.id));
  const reconciledTotal = Object.values(payouts).reduce((sum, amount) => sum + amount, 0);

  return {
    payouts,
    preferencePaid,
    participationPaid,
    choiceById,
    pricePerShare,
    totalPayout: reconciledTotal,
    unallocated: Math.max(0, proceeds - reconciledTotal),
    warnings,
  };
}

export function allocateConsideration(stakeholders, entitlements, tranches, discountRate = 0) {
  const results = {};
  const warnings = [];
  stakeholders.forEach((holder) => {
    const entitlement = Math.max(0, number(entitlements[holder.id]));
    results[holder.id] = {
      entitlement,
      closingCash: entitlement,
      expectedPresentValue: entitlement,
      tranches: {},
    };
  });

  for (const tranche of tranches) {
    const requested = Math.max(0, number(tranche.amount));
    if (requested <= EPSILON) continue;
    const eligible = stakeholders.filter((holder) => isEligible(holder, tranche));
    const capacity = eligible.reduce((sum, holder) => sum + results[holder.id].closingCash, 0);
    const allocated = Math.min(requested, capacity);
    if (allocated + EPSILON < requested) {
      warnings.push(`${tranche.label} exceeds the remaining entitlement of eligible stakeholders.`);
    }
    eligible.forEach((holder) => {
      const current = results[holder.id].closingCash;
      const amount = capacity > 0 ? allocated * (current / capacity) : 0;
      results[holder.id].closingCash -= amount;
      results[holder.id].tranches[tranche.id] = amount;
    });
  }

  stakeholders.forEach((holder) => {
    const row = results[holder.id];
    let expected = row.closingCash;
    tranches.forEach((tranche) => {
      const amount = row.tranches[tranche.id] || 0;
      const probability = clamp(number(tranche.expectedPercent) / 100, 0, 1);
      const years = Math.max(0, number(tranche.years));
      expected += amount * probability / ((1 + Math.max(0, number(discountRate)) / 100) ** years);
    });
    row.expectedPresentValue = expected;
  });

  const totalTranches = tranches.reduce((sum, tranche) => sum + Math.max(0, number(tranche.amount)), 0);
  const totalEntitlements = Object.values(results).reduce((sum, row) => sum + row.entitlement, 0);
  if (totalTranches > totalEntitlements + EPSILON) {
    warnings.push("Consideration tranches exceed distributable equity value; excess amounts were not allocated.");
  }

  return { results, warnings };
}

function isEligible(holder, tranche) {
  if (tranche.eligibility === "escrow") return holder.escrowEligible;
  if (tranche.eligibility === "deferred") return holder.deferredEligible;
  return true;
}

function normalizeStakeholder(holder) {
  return {
    ...holder,
    id: String(holder.id),
    securityType: holder.securityType || "common",
    shares: Math.max(0, number(holder.shares)),
    eligiblePercent: clamp(number(holder.eligiblePercent || 100) / 100, 0, 1),
    invested: Math.max(0, number(holder.invested)),
    preferenceMultiple: Math.max(0, number(holder.preferenceMultiple)),
    secondaryPreferenceMultiple: Math.max(0, number(holder.secondaryPreferenceMultiple)),
    secondarySeniority: Math.max(1, Math.round(number(holder.secondarySeniority || holder.seniority || 1))),
    accruedDividend: Math.max(0, number(holder.accruedDividend)),
    dividendType: holder.dividendType || "fixed",
    dividendRate: Math.max(0, number(holder.dividendRate)),
    dividendYears: Math.max(0, number(holder.dividendYears)),
    dividendPeriods: Math.max(1, Math.round(number(holder.dividendPeriods || 1))),
    paidDividends: Math.max(0, number(holder.paidDividends)),
    waiverPercent: clamp(number(holder.waiverPercent), 0, 100),
    priorDistributions: Math.max(0, number(holder.priorDistributions)),
    seniority: Math.max(1, Math.round(number(holder.seniority || 1))),
    participation: holder.participation || "none",
    capMultiple: Math.max(0, number(holder.capMultiple || 0)),
    strike: Math.max(0, number(holder.strike)),
    conversionPolicy: holder.conversionPolicy || "elective",
    ratchetType: holder.ratchetType || "none",
    conversionMultiplier: Math.max(0, number(holder.conversionMultiplier || 1)),
    originalPrice: Math.max(0, number(holder.originalPrice)),
    downRoundPrice: Math.max(0, number(holder.downRoundPrice)),
    preRoundShares: Math.max(0, number(holder.preRoundShares)),
    newMoney: Math.max(0, number(holder.newMoney)),
    escrowEligible: holder.escrowEligible !== false,
    deferredEligible: holder.deferredEligible !== false,
  };
}

export function ratchetMultiplier(holder) {
  const type = holder.ratchetType || "none";
  const originalPrice = Math.max(0, number(holder.originalPrice));
  const downRoundPrice = Math.max(0, number(holder.downRoundPrice));
  if (type === "custom") return Math.max(0, number(holder.conversionMultiplier || 1));
  if (type === "none" || originalPrice <= 0 || downRoundPrice <= 0 || downRoundPrice >= originalPrice) return 1;
  if (type === "full-ratchet") return originalPrice / downRoundPrice;
  if (type === "weighted-average") {
    const a = Math.max(0, number(holder.preRoundShares));
    const newMoney = Math.max(0, number(holder.newMoney));
    const b = newMoney / originalPrice;
    const c = newMoney / downRoundPrice;
    if (a + c <= 0) return 1;
    const adjustedPrice = originalPrice * ((a + b) / (a + c));
    return adjustedPrice > 0 ? originalPrice / adjustedPrice : 1;
  }
  return 1;
}

function effectiveShares(holder) {
  const base = holder.shares * holder.eligiblePercent;
  return isPreferenceSecurity(holder) ? base * ratchetMultiplier(holder) : base;
}

function preferenceClaims(holder) {
  const waiverFactor = 1 - holder.waiverPercent / 100;
  const dividend = accruedDividend(holder);
  const claims = [
    {
      seniority: holder.seniority,
      amount: Math.max(0, (holder.invested * holder.preferenceMultiple + dividend) * waiverFactor),
    },
  ];
  if (holder.secondaryPreferenceMultiple > 0) {
    claims.push({
      seniority: holder.secondarySeniority,
      amount: Math.max(0, holder.invested * holder.secondaryPreferenceMultiple * waiverFactor),
    });
  }
  let offset = holder.priorDistributions;
  return claims.map((claim) => {
    const reduction = Math.min(offset, claim.amount);
    offset -= reduction;
    return { ...claim, amount: claim.amount - reduction };
  }).filter((claim) => claim.amount > EPSILON);
}

function accruedDividend(holder) {
  let accrued = holder.accruedDividend;
  const rate = holder.dividendRate / 100;
  if (holder.dividendType === "simple") accrued = holder.invested * rate * holder.dividendYears;
  if (holder.dividendType === "compound") {
    const periods = holder.dividendPeriods;
    accrued = holder.invested * ((1 + rate / periods) ** (periods * holder.dividendYears) - 1);
  }
  if (holder.dividendType === "none") accrued = 0;
  return Math.max(0, accrued - holder.paidDividends);
}

function isPreferenceSecurity(holder) {
  return ["preferred", "safe", "note"].includes(holder.securityType);
}

function reconcileToCents(payouts, target, ids) {
  ids.forEach((id) => { payouts[id] = Math.round(number(payouts[id]) * 100) / 100; });
  const targetCents = Math.round(number(target) * 100);
  const paidCents = ids.reduce((sum, id) => sum + Math.round(payouts[id] * 100), 0);
  const difference = targetCents - paidCents;
  if (difference !== 0) {
    const recipient = ids.find((id) => payouts[id] > 0) || ids[0];
    if (recipient) payouts[recipient] += difference / 100;
  }
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalOrder(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
