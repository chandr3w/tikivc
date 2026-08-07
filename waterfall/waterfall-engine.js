const EPSILON = 0.01;

export function computeEquityBridge(deal) {
  const rows = [
    { key: "enterpriseValue", label: "Enterprise value", value: number(deal.enterpriseValue), sign: 1 },
    { key: "cash", label: "Cash and investments added", value: number(deal.cash), sign: 1 },
    { key: "debt", label: "Debt payoff", value: number(deal.debt), sign: -1 },
    { key: "debtLike", label: "Debt-like items", value: number(deal.debtLike), sign: -1 },
    { key: "workingCapital", label: "Working-capital adjustment", value: number(deal.workingCapital), sign: 1 },
    { key: "transactionFees", label: "Transaction expenses", value: number(deal.transactionFees), sign: -1 },
    { key: "bonuses", label: "Seller-funded management carveout", value: number(deal.bonuses), sign: -1 },
    { key: "transferTaxes", label: "Transfer and entity-level taxes", value: number(deal.transferTaxes), sign: -1 },
    { key: "otherAdjustment", label: "Other purchase-price adjustment", value: number(deal.otherAdjustment), sign: 1 },
  ];

  const rawEquityValue = rows.reduce((sum, row) => sum + row.sign * row.value, 0);
  return { rows, rawEquityValue, equityValue: Math.max(0, rawEquityValue) };
}

export function computePeopleCohortOutcome(cohort, pricePerShare, discountRate = 0) {
  const grantShares = Math.max(0, number(cohort.grantShares));
  const vestedPercent = Math.max(0, Math.min(100, number(cohort.eligiblePercent)));
  const accelerationPercent = Math.max(0, Math.min(100, number(cohort.accelerationPercent)));
  const vestedShares = grantShares * vestedPercent / 100;
  const acceleratedShares = (grantShares - vestedShares) * accelerationPercent / 100;
  const eligibleShares = vestedShares + acceleratedShares;
  const strike = Math.max(0, number(cohort.strike));
  const commonValue = Math.max(0, number(pricePerShare));
  const exercisedPercent = cohort.equityType === "common"
    ? 100
    : Math.max(0, Math.min(100, cohort.exercisedPercent == null ? (cohort.alreadyExercised === true ? 100 : 0) : number(cohort.exercisedPercent)));
  const exercisedShares = cohort.equityType === "common"
    ? eligibleShares
    : vestedShares * exercisedPercent / 100;
  const unexercisedShares = eligibleShares - exercisedShares;
  const exerciseCost = exercisedShares * strike;
  const exercisedGrossValue = exercisedShares * commonValue;
  const unexercisedSpread = unexercisedShares * Math.max(0, commonValue - strike);
  const grossValue = eligibleShares * commonValue;
  const equityProceeds = exercisedGrossValue + unexercisedSpread;
  const initialInvestment = exerciseCost;
  const recoveryFloorMultiple = Math.max(0, number(cohort.recoveryFloorMultiple));
  const makeWhole = Math.max(0, exerciseCost * recoveryFloorMultiple - exercisedGrossValue);
  const alreadyExercised = unexercisedShares <= EPSILON;
  const transactionBonus = Math.max(0, number(cohort.transactionBonus));
  const retentionBonus = Math.max(0, number(cohort.retentionBonus));
  const retentionYears = Math.max(0, number(cohort.retentionYears));
  const retentionPresentValue = retentionBonus / ((1 + Math.max(0, number(discountRate)) / 100) ** retentionYears);
  const expectedValue = equityProceeds + makeWhole + transactionBonus + retentionPresentValue;
  return { ...cohort, alreadyExercised, exercisedPercent, exercisedShares, unexercisedShares, vestedShares, acceleratedShares, eligibleShares, exerciseCost, initialInvestment, grossValue, exercisedGrossValue, unexercisedSpread, equityProceeds, recoveryFloorMultiple, makeWhole, transactionBonus, retentionBonus, retentionPresentValue, expectedValue };
}

export function computeExitModel(model) {
  const deal = model?.deal || {};
  const stakeholders = Array.isArray(model?.stakeholders) ? model.stakeholders : [];
  const tranches = Array.isArray(model?.tranches) ? model.tranches : [];
  const bridge = computeEquityBridge(deal);
  const incremental = tranches.reduce((sum, tranche) => (
    sum + (tranche.treatment === "incremental" ? Math.max(0, number(tranche.amount)) : 0)
  ), 0);
  const grossProceeds = bridge.equityValue + incremental;
  const effectiveStakeholders = applySharedTerms(stakeholders, model?.terms);
  const { waterfall, consideration, closingWaterfall } = allocateExitConsideration(
    effectiveStakeholders,
    bridge.equityValue,
    tranches,
    deal.discountRate,
  );
  const rows = effectiveStakeholders.map((holder, index) => {
    const timing = consideration.results[holder.id] || { entitlement: 0, closingCash: 0, expectedPresentValue: 0, tranches: {} };
    const deferred = Object.values(timing.tranches).reduce((sum, amount) => sum + number(amount), 0);
    return { holder, index, timing, deferred };
  }).sort((a, b) => (
    optionalOrder(a.holder.displayOrder, Number.MAX_SAFE_INTEGER) - optionalOrder(b.holder.displayOrder, Number.MAX_SAFE_INTEGER)
    || b.timing.entitlement - a.timing.entitlement
  ));
  return { bridge, incremental, grossProceeds, waterfall, closingWaterfall, consideration, rows, effectiveStakeholders };
}

export function allocateExitConsideration(stakeholders, closingProceeds, tranches = [], discountRate = 0) {
  const normalizedClosing = Math.max(0, number(closingProceeds));
  validateStakeholderIds(stakeholders);
  validateEntityIds(tranches, "Consideration tranche");
  const normalizedTranches = tranches.map((tranche, index) => ({
    ...tranche,
    _index: index,
    allocationBasis: trancheAllocationBasis(tranche),
    faceAmount: Math.max(0, number(tranche.amount)),
  }));
  const includedTranches = normalizedTranches.filter((tranche) => tranche.treatment !== "incremental");
  const cumulativeIncluded = includedTranches
    .filter((tranche) => tranche.allocationBasis === "cumulative")
    .sort((a, b) => Math.max(0, number(a.years)) - Math.max(0, number(b.years)) || a._index - b._index);
  let cumulativeIncludedBudget = Math.min(
    normalizedClosing,
    cumulativeIncluded.reduce((sum, tranche) => sum + tranche.faceAmount, 0),
  );
  cumulativeIncluded.forEach((tranche) => {
    tranche.effectiveAmount = Math.min(tranche.faceAmount, cumulativeIncludedBudget);
    cumulativeIncludedBudget -= tranche.effectiveAmount;
  });
  const reservedCumulative = cumulativeIncluded.reduce((sum, tranche) => sum + tranche.effectiveAmount, 0);
  const initialProceeds = Math.max(0, normalizedClosing - reservedCumulative);
  const closingWaterfall = computeWaterfall(stakeholders, initialProceeds);
  const fixedIncluded = includedTranches
    .filter((tranche) => tranche.allocationBasis === "pro-rata")
    .map((tranche) => ({ ...tranche, amount: tranche.faceAmount }));
  const consideration = allocateConsideration(
    stakeholders,
    closingWaterfall.payouts,
    fixedIncluded,
    discountRate,
  );
  const warnings = [...consideration.warnings];
  const includedAmount = includedTranches.reduce((sum, tranche) => sum + tranche.faceAmount, 0);
  if (includedAmount > normalizedClosing + EPSILON) {
    warnings.push("Included consideration exceeds distributable equity value; included tranches were capped at the bridge value.");
  }
  const paidToDate = Object.fromEntries(stakeholders.map((holder) => [holder.id, Math.max(0, number(closingWaterfall.payouts[holder.id]))]));
  let cumulativeProceeds = initialProceeds;
  let waterfall = closingWaterfall;

  const scheduledTranches = [
    ...cumulativeIncluded.map((tranche) => ({ ...tranche, amount: tranche.effectiveAmount })),
    ...normalizedTranches
      .filter((tranche) => tranche.treatment === "incremental")
      .map((tranche) => ({ ...tranche, amount: tranche.faceAmount })),
  ].filter((tranche) => number(tranche.amount) > EPSILON)
    .sort((a, b) => Math.max(0, number(a.years)) - Math.max(0, number(b.years)) || a._index - b._index);
  const timingGroups = groupTranchesByTiming(scheduledTranches);

  for (const group of timingGroups) {
    const fixedGroup = group.filter((tranche) => tranche.allocationBasis === "pro-rata");
    const cumulativeGroup = group.filter((tranche) => tranche.allocationBasis === "cumulative");

    fixedGroup.forEach((tranche) => {
      const allocation = allocateProRata(stakeholders, closingWaterfall.payouts, tranche);
      if (allocation.warning) warnings.push(allocation.warning);
      stakeholders.forEach((holder) => {
        const amount = allocation.amounts[holder.id] || 0;
        if (amount <= 0) return;
        const row = consideration.results[holder.id];
        row.entitlement += amount;
        row.tranches[tranche.id] = (row.tranches[tranche.id] || 0) + amount;
        paidToDate[holder.id] += amount;
      });
    });

    const groupAmount = group.reduce((sum, tranche) => sum + Math.max(0, number(tranche.amount)), 0);
    cumulativeProceeds += groupAmount;
    const updatedWaterfall = computeWaterfall(stakeholders, cumulativeProceeds);

    if (cumulativeGroup.length > 0) {
      const increases = Object.fromEntries(stakeholders.map((holder) => [
        holder.id,
        Math.max(0, number(updatedWaterfall.payouts[holder.id]) - number(paidToDate[holder.id])),
      ]));
      const allocation = allocateConsideration(stakeholders, increases, cumulativeGroup, discountRate);
      warnings.push(...allocation.warnings);
      stakeholders.forEach((holder) => {
        const allocated = allocation.results[holder.id];
        Object.entries(allocated.tranches).forEach(([trancheId, amount]) => {
          const row = consideration.results[holder.id];
          row.entitlement += amount;
          row.tranches[trancheId] = (row.tranches[trancheId] || 0) + amount;
          paidToDate[holder.id] += amount;
        });
      });
    }
    waterfall = updatedWaterfall;
  }

  stakeholders.forEach((holder) => {
    const row = consideration.results[holder.id];
    let expected = row.closingCash;
    tranches.forEach((tranche) => {
      const amount = row.tranches[tranche.id] || 0;
      const probability = clamp(number(tranche.expectedPercent ?? 100) / 100, 0, 1);
      const years = Math.max(0, number(tranche.years));
      expected += amount * probability / ((1 + Math.max(0, number(discountRate)) / 100) ** years);
    });
    row.expectedPresentValue = expected;
  });

  waterfall.warnings = [...new Set([
    ...closingWaterfall.warnings,
    ...waterfall.warnings,
  ])];
  const allocatedConsideration = Object.values(consideration.results).reduce((sum, row) => sum + number(row.entitlement), 0);
  consideration.unallocated = Math.max(0, cumulativeProceeds - allocatedConsideration);
  if (consideration.unallocated > EPSILON) {
    warnings.push(`${formatEngineMoney(consideration.unallocated)} of consideration is not allocated under the selected eligibility and allocation bases.`);
  }
  consideration.warnings = warnings;
  return { waterfall, closingWaterfall, consideration };
}

function trancheAllocationBasis(tranche) {
  if (["cumulative", "pro-rata"].includes(tranche.allocationBasis)) return tranche.allocationBasis;
  return tranche.type === "earnout" || tranche.treatment === "incremental" ? "cumulative" : "pro-rata";
}

function groupTranchesByTiming(tranches) {
  const groups = [];
  tranches.forEach((tranche) => {
    const years = Math.max(0, number(tranche.years));
    const current = groups[groups.length - 1];
    if (!current || Math.abs(Math.max(0, number(current[0].years)) - years) > EPSILON) groups.push([tranche]);
    else current.push(tranche);
  });
  return groups;
}

function allocateProRata(stakeholders, basis, tranche) {
  const eligible = stakeholders.filter((holder) => isEligible(holder, tranche));
  const weightTotal = eligible.reduce((sum, holder) => sum + Math.max(0, number(basis[holder.id])), 0);
  const requested = Math.max(0, number(tranche.amount));
  const amounts = Object.fromEntries(stakeholders.map((holder) => [holder.id, 0]));
  if (requested <= EPSILON) return { amounts, warning: null };
  if (weightTotal <= EPSILON) {
    return { amounts, warning: `${tranche.label} could not be allocated because eligible holders have no closing entitlement.` };
  }
  eligible.forEach((holder) => {
    amounts[holder.id] = requested * Math.max(0, number(basis[holder.id])) / weightTotal;
  });
  reconcileToCents(amounts, requested, eligible.map((holder) => holder.id));
  return { amounts, warning: null };
}

export function comparisonBarWidth(value, scaleMaximum, exponent = 0.5) {
  const amount = Math.max(0, number(value));
  const maximum = Math.max(0, number(scaleMaximum));
  const power = clamp(number(exponent), 0.01, 1);
  if (amount === 0 || maximum === 0) return 0;
  return Math.min(100, Math.max(0, (amount / maximum) ** power * 100));
}

export function computeInvestorAttribution(holder, timing, deferred = 0) {
  const roundSize = Math.max(0, number(holder?.roundSize ?? holder?.invested));
  const preferenceBasis = Math.max(0, number(holder?.invested ?? roundSize));
  const investment = Math.max(0, number(holder?.investorInvestment ?? preferenceBasis));
  const fraction = preferenceBasis > 0 ? Math.min(1, investment / preferenceBasis) : (investment > 0 ? 1 : 0);
  return {
    roundSize,
    preferenceBasis,
    investment,
    fraction,
    investorExit: Math.max(0, number(timing?.entitlement)) * fraction,
    investorClosing: Math.max(0, number(timing?.closingCash)) * fraction,
    investorDeferred: Math.max(0, number(deferred)) * fraction,
    investorExpected: Math.max(0, number(timing?.expectedPresentValue)) * fraction,
  };
}

export function computeWaterfall(stakeholders, proceeds) {
  validateStakeholderIds(stakeholders);
  const normalized = stakeholders.map(normalizeStakeholder);
  const preferred = normalized.filter(isPreferenceSecurity);
  const elective = preferred.filter((holder) => holder.conversionPolicy === "elective");
  const normalizedProceeds = Math.max(0, number(proceeds));

  if (elective.length > 12) {
    return solveIterativeElections(normalized, preferred, elective, normalizedProceeds);
  }

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
    allocations[mask] = allocateWithChoices(normalized, normalizedProceeds, choices);
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
  result.stableElection = stableFound;
  result.conversionRegret = lowestRegret;
  result.electionMethod = "exhaustive";
  return result;
}

function solveIterativeElections(stakeholders, preferred, elective, proceeds) {
  let choices = baseElectionChoices(preferred, elective, false);
  let result = allocateWithChoices(stakeholders, proceeds, choices);
  let stableElection = false;
  let iterations = 0;
  const seen = new Set();
  const iterationLimit = Math.max(100, elective.length * 20);

  while (iterations < iterationLimit) {
    const signature = elective.map((holder) => choices.get(holder.id) ? "1" : "0").join("");
    if (seen.has(signature)) break;
    seen.add(signature);
    let changed = false;

    for (const holder of elective) {
      const alternativeChoices = new Map(choices);
      alternativeChoices.set(holder.id, !choices.get(holder.id));
      const alternative = allocateWithChoices(stakeholders, proceeds, alternativeChoices);
      if (number(alternative.payouts[holder.id]) > number(result.payouts[holder.id]) + EPSILON) {
        choices = alternativeChoices;
        result = alternative;
        changed = true;
      }
    }

    iterations += 1;
    if (!changed) {
      stableElection = true;
      break;
    }
  }

  let conversionRegret = 0;
  for (const holder of elective) {
    const alternativeChoices = new Map(choices);
    alternativeChoices.set(holder.id, !choices.get(holder.id));
    const alternative = allocateWithChoices(stakeholders, proceeds, alternativeChoices);
    conversionRegret += Math.max(0, number(alternative.payouts[holder.id]) - number(result.payouts[holder.id]));
  }

  result.warnings.push(`The model used iterative best-response elections for ${elective.length} preferred classes; review the election trace against class-vote requirements.`);
  if (!stableElection) result.warnings.push("The iterative conversion solver did not reach a stable election set.");
  result.stableElection = stableElection;
  result.conversionRegret = conversionRegret;
  result.electionMethod = "iterative";
  result.electionIterations = iterations;
  return result;
}

function baseElectionChoices(preferred, elective, electivePreference) {
  const electiveIds = new Set(elective.map((holder) => holder.id));
  return new Map(preferred.map((holder) => {
    if (holder.conversionPolicy === "force-preference") return [holder.id, true];
    if (holder.conversionPolicy === "force-convert") return [holder.id, false];
    return [holder.id, electiveIds.has(holder.id) ? electivePreference : false];
  }));
}

export function applySharedTerms(stakeholders, terms = null) {
  if (!terms || typeof terms !== "object") return stakeholders.map((holder) => ({ ...holder }));

  const preferenceRows = stakeholders
    .map((holder, index) => ({ holder, index }))
    .filter(({ holder }) => holder.securityType === "preferred")
    .sort((a, b) => optionalOrder(b.holder.displayOrder, b.index) - optionalOrder(a.holder.displayOrder, a.index));
  const sequentialTier = new Map(preferenceRows.map(({ holder }, index) => [holder.id, index + 1]));
  const noteTiers = stakeholders
    .filter((holder) => holder.securityType === "note" && (
      holder.useSharedTerms !== false || holder.preferenceEnabled === true
    ) && holder.conversionPolicy !== "force-convert" && (
      number(holder.preferenceMultiple) > 0
      || number(holder.secondaryPreferenceMultiple) > 0
      || number(holder.accruedDividend) > 0
      || number(holder.dividendRate) > 0
    ))
    .map((holder) => Math.max(1, Math.round(number(holder.seniority || 1))));
  const preferredParityTier = noteTiers.length > 0 ? Math.max(...noteTiers) + 1 : 1;
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
      const individualConversionPolicy = ["elective", "force-preference", "force-convert"].includes(holder.conversionPolicy)
        ? holder.conversionPolicy
        : (holder.optimalConversion !== false ? "elective" : "force-preference");
      return {
        ...holder,
        preferenceMultiple: individualPreference ? Math.max(0, number(holder.preferenceMultiple ?? 1)) : 0,
        seniority: Math.max(1, Math.round(number(holder.seniority || 1))),
        participation: individualParticipation,
        capMultiple: individualParticipation === "capped" ? Math.max(0, number(holder.capMultiple || 0)) : 0,
        conversionPolicy: individualPreference ? individualConversionPolicy : "force-convert",
        dividendType: individualDividend,
        accruedDividend: individualDividend === "fixed" ? Math.max(0, number(holder.accruedDividend)) : 0,
        dividendRate: ["simple", "compound"].includes(individualDividend) ? Math.max(0, number(holder.dividendRate)) : 0,
        dividendYears: ["simple", "compound"].includes(individualDividend) ? Math.max(0, number(holder.dividendYears)) : 0,
        dividendPeriods: individualDividend === "compound" ? Math.max(1, Math.round(number(holder.dividendPeriods || 1))) : 1,
        paidDividends: individualDividend !== "none" ? Math.max(0, number(holder.paidDividends)) : 0,
        dividendsCountTowardCap: holder.dividendsCountTowardCap !== false,
        ratchetType: individualRatchet,
        originalPrice: individualRatchet !== "none" ? Math.max(0, number(holder.originalPrice)) : 0,
        downRoundPrice: individualRatchet !== "none" ? Math.max(0, number(holder.downRoundPrice)) : 0,
        preRoundShares: individualRatchet === "weighted-average" ? Math.max(0, number(holder.preRoundShares)) : 0,
        newMoney: individualRatchet === "weighted-average" ? Math.max(0, number(holder.newMoney)) : 0,
        conversionMultiplier: individualRatchet === "custom" ? Math.max(0, number(holder.conversionMultiplier ?? 1)) : 1,
        secondaryPreferenceMultiple: individualPreference ? Math.max(0, number(holder.secondaryPreferenceMultiple)) : 0,
        secondarySeniority: individualPreference ? Math.max(1, Math.round(number(holder.secondarySeniority || holder.seniority || 1))) : 1,
        priorDistributions: individualPreference ? Math.max(0, number(holder.priorDistributions)) : 0,
        waiverPercent: individualPreference ? clamp(number(holder.waiverPercent), 0, 100) : 0,
      };
    }

    const shared = {
      ...holder,
      escrowEligible: terms.escrowEligibleAll !== false,
      deferredEligible: terms.deferredEligibleAll !== false,
    };
    if (holder.securityType === "safe") {
      return {
        ...shared,
        seniority: terms.pariPassu === true
          ? preferredParityTier
          : Math.max(1, Math.round(number(holder.seniority || 1))),
      };
    }
    if (holder.securityType !== "preferred") return shared;

    return {
      ...shared,
      preferenceMultiple: preferenceEnabled ? Math.max(0, number(terms.preferenceMultiple ?? 1)) : 0,
      seniority: terms.pariPassu === true ? preferredParityTier : Math.max(1, Math.round(number(holder.seniority || sequentialTier.get(holder.id) || 1))),
      participation,
      capMultiple: participation === "capped" ? Math.max(0, number(terms.participationCap || 0)) : 0,
      conversionPolicy: preferenceEnabled ? (terms.optimalConversion !== false ? "elective" : "force-preference") : "force-convert",
      dividendType,
      accruedDividend: dividendType === "fixed" ? Math.max(0, number(terms.accruedDividend)) : 0,
      dividendRate: ["simple", "compound"].includes(dividendType) ? Math.max(0, number(terms.dividendRate)) : 0,
      dividendYears: ["simple", "compound"].includes(dividendType) ? Math.max(0, number(terms.dividendYears)) : 0,
      dividendPeriods: dividendType === "compound" ? Math.max(1, Math.round(number(terms.dividendPeriods || 1))) : 1,
      paidDividends: dividendType !== "none" ? Math.max(0, number(terms.paidDividends)) : 0,
      dividendsCountTowardCap: terms.dividendsCountTowardCap !== false,
      ratchetType,
      originalPrice: ratchetType !== "none" ? Math.max(0, number(terms.originalPrice)) : 0,
      downRoundPrice: ratchetType !== "none" ? Math.max(0, number(terms.downRoundPrice)) : 0,
      preRoundShares: ratchetType === "weighted-average" ? Math.max(0, number(terms.preRoundShares)) : 0,
      newMoney: ratchetType === "weighted-average" ? Math.max(0, number(terms.newMoney)) : 0,
      conversionMultiplier: ratchetType === "custom" ? Math.max(0, number(terms.conversionMultiplier ?? 1)) : 1,
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
        capRemaining: Math.max(0, capValue - preferencePaid[holder.id] - holder.priorDistributions - (holder.dividendsCountTowardCap ? holder.paidDividends : 0)),
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
    const hasUncappedResidual = commonLike.some((item) => item.shares > 0) || options.some((item) => item.shares > 0);
    let high = hasUncappedResidual
      ? 1
      : Math.max(0, ...cappedParticipants.map((item) => item.shares > 0 ? item.capRemaining / item.shares : 0));
    while (hasUncappedResidual && distributedAtPrice(high) < available && high < 1e15) high *= 2;
    if (distributedAtPrice(high) < available - EPSILON) {
      warnings.push("Residual proceeds could not be fully allocated because no eligible common-equivalent securities remain.");
      pricePerShare = high;
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
  validateStakeholderIds(stakeholders);
  validateEntityIds(tranches, "Consideration tranche");
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

  const activeTranches = tranches
    .map((tranche) => ({ tranche, requested: Math.max(0, number(tranche.amount)), remaining: Math.max(0, number(tranche.amount)) }))
    .filter((item) => item.requested > EPSILON);
  const allocations = Object.fromEntries(activeTranches.map(({ tranche }) => [
    tranche.id,
    Object.fromEntries(stakeholders.map((holder) => [holder.id, 0])),
  ]));

  const optimized = maximizeEligibleAllocations(stakeholders, results, activeTranches);
  activeTranches.forEach((item) => {
    stakeholders.forEach((holder) => {
      allocations[item.tranche.id][holder.id] = optimized.allocations[item.tranche.id][holder.id] || 0;
    });
    item.remaining = Math.max(0, item.requested - optimized.allocatedByTranche[item.tranche.id]);
  });

  activeTranches.forEach(({ tranche, requested, remaining }) => {
    const allocated = requested - Math.max(0, remaining);
    if (allocated + EPSILON < requested) warnings.push(`${tranche.label} exceeds the entitlement of eligible stakeholders.`);
    const ids = stakeholders.filter((holder) => allocations[tranche.id][holder.id] > 0).map((holder) => holder.id);
    reconcileToCents(allocations[tranche.id], allocated, ids);
  });

  stakeholders.forEach((holder) => {
    let withheld = 0;
    activeTranches.forEach(({ tranche }) => {
      const amount = Math.max(0, number(allocations[tranche.id][holder.id]));
      if (amount > 0) results[holder.id].tranches[tranche.id] = amount;
      withheld += amount;
    });
    results[holder.id].closingCash = Math.max(0, results[holder.id].entitlement - withheld);
  });

  stakeholders.forEach((holder) => {
    const row = results[holder.id];
    let expected = row.closingCash;
    tranches.forEach((tranche) => {
      const amount = row.tranches[tranche.id] || 0;
      const probability = clamp(number(tranche.expectedPercent ?? 100) / 100, 0, 1);
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

function maximizeEligibleAllocations(stakeholders, results, activeTranches) {
  const demands = Object.fromEntries(activeTranches.map((item) => [item.tranche.id, Math.round(item.requested * 100)]));
  const capacities = Object.fromEntries(stakeholders.map((holder) => [
    holder.id,
    Math.round(Math.max(0, number(results[holder.id].entitlement)) * 100),
  ]));
  const maximum = solveEligibilityFlow(stakeholders, activeTranches, capacities, demands);
  const totalDemand = Object.values(demands).reduce((sum, amount) => sum + amount, 0);
  const totalAllocated = Object.values(maximum.allocatedByTranche).reduce((sum, amount) => sum + amount, 0);
  const cents = totalAllocated === totalDemand
    ? balanceFeasibleAllocations(stakeholders, activeTranches, capacities, demands)
    : maximum;
  const allocations = Object.fromEntries(activeTranches.map((item) => [
    item.tranche.id,
    Object.fromEntries(stakeholders.map((holder) => [holder.id, (cents.allocations[item.tranche.id]?.[holder.id] || 0) / 100])),
  ]));
  const allocatedByTranche = Object.fromEntries(activeTranches.map((item) => [
    item.tranche.id,
    (cents.allocatedByTranche[item.tranche.id] || 0) / 100,
  ]));
  return { allocations, allocatedByTranche };
}

function balanceFeasibleAllocations(stakeholders, activeTranches, capacities, demands) {
  const matrix = Object.fromEntries(activeTranches.map((item) => {
    const eligible = stakeholders.filter((holder) => isEligible(holder, item.tranche) && capacities[holder.id] > 0);
    const eligibleCapacity = eligible.reduce((sum, holder) => sum + capacities[holder.id], 0);
    return [item.tranche.id, Object.fromEntries(stakeholders.map((holder) => [
      holder.id,
      eligibleCapacity > 0 && isEligible(holder, item.tranche)
        ? demands[item.tranche.id] * capacities[holder.id] / eligibleCapacity
        : 0,
    ]))];
  }));

  for (let iteration = 0; iteration < 20000; iteration += 1) {
    activeTranches.forEach((item) => {
      const row = matrix[item.tranche.id];
      const total = Object.values(row).reduce((sum, amount) => sum + amount, 0);
      const scale = total > 0 ? demands[item.tranche.id] / total : 0;
      stakeholders.forEach((holder) => { row[holder.id] *= scale; });
    });
    stakeholders.forEach((holder) => {
      const total = activeTranches.reduce((sum, item) => sum + matrix[item.tranche.id][holder.id], 0);
      if (total <= capacities[holder.id] || total <= 0) return;
      const scale = capacities[holder.id] / total;
      activeTranches.forEach((item) => { matrix[item.tranche.id][holder.id] *= scale; });
    });
    const maxDeficit = activeTranches.reduce((largest, item) => {
      const total = Object.values(matrix[item.tranche.id]).reduce((sum, amount) => sum + amount, 0);
      return Math.max(largest, Math.abs(demands[item.tranche.id] - total));
    }, 0);
    if (maxDeficit < 1e-7) {
      break;
    }
  }

  // Boundary-feasible networks can converge only asymptotically as allocations
  // on structurally unavailable capacity approach zero.  Flooring the feasible
  // fractional matrix preserves every holder cap; a residual max-flow then
  // assigns only the remaining cents without replacing the economic allocation
  // with a lexicographic one.

  const floored = Object.fromEntries(activeTranches.map((item) => [
    item.tranche.id,
    Object.fromEntries(stakeholders.map((holder) => [holder.id, Math.floor(matrix[item.tranche.id][holder.id] + 1e-8)])),
  ]));
  const remainingDemands = Object.fromEntries(activeTranches.map((item) => [
    item.tranche.id,
    demands[item.tranche.id] - Object.values(floored[item.tranche.id]).reduce((sum, amount) => sum + amount, 0),
  ]));
  const remainingCapacities = Object.fromEntries(stakeholders.map((holder) => [
    holder.id,
    capacities[holder.id] - activeTranches.reduce((sum, item) => sum + floored[item.tranche.id][holder.id], 0),
  ]));
  const fractions = Object.fromEntries(activeTranches.map((item) => [
    item.tranche.id,
    Object.fromEntries(stakeholders.map((holder) => [
      holder.id,
      matrix[item.tranche.id][holder.id] - floored[item.tranche.id][holder.id],
    ])),
  ]));
  const residual = solveEligibilityFlow(stakeholders, activeTranches, remainingCapacities, remainingDemands, fractions);
  activeTranches.forEach((item) => {
    stakeholders.forEach((holder) => {
      floored[item.tranche.id][holder.id] += residual.allocations[item.tranche.id][holder.id] || 0;
    });
  });
  return {
    allocations: floored,
    allocatedByTranche: Object.fromEntries(activeTranches.map((item) => [
      item.tranche.id,
      Object.values(floored[item.tranche.id]).reduce((sum, amount) => sum + amount, 0),
    ])),
  };
}

function solveEligibilityFlow(stakeholders, activeTranches, capacities, demands, priorities = null) {
  const sortedTranches = [...activeTranches].sort((a, b) => {
    const aEligible = stakeholders.filter((holder) => isEligible(holder, a.tranche) && capacities[holder.id] > 0).length;
    const bEligible = stakeholders.filter((holder) => isEligible(holder, b.tranche) && capacities[holder.id] > 0).length;
    return aEligible - bEligible
      || Math.max(0, number(a.tranche.years)) - Math.max(0, number(b.tranche.years))
      || number(b.tranche.expectedPercent) - number(a.tranche.expectedPercent)
      || String(a.tranche.id).localeCompare(String(b.tranche.id));
  });
  const sortedHolders = [...stakeholders].sort((a, b) => capacities[a.id] - capacities[b.id] || String(a.id).localeCompare(String(b.id)));
  const source = 0;
  const trancheOffset = 1;
  const holderOffset = trancheOffset + sortedTranches.length;
  const sink = holderOffset + sortedHolders.length;
  const graph = Array.from({ length: sink + 1 }, () => []);
  const edgeRefs = {};
  const demandCents = Object.values(demands).reduce((sum, amount) => sum + amount, 0);

  const addEdge = (from, to, capacity) => {
    const forward = { to, reverse: graph[to].length, capacity, originalCapacity: capacity };
    const reverse = { to: from, reverse: graph[from].length, capacity: 0, originalCapacity: 0 };
    graph[from].push(forward);
    graph[to].push(reverse);
    return forward;
  };

  sortedTranches.forEach((item, trancheIndex) => {
    const trancheNode = trancheOffset + trancheIndex;
    addEdge(source, trancheNode, Math.max(0, demands[item.tranche.id] || 0));
    edgeRefs[item.tranche.id] = {};
    const edgeHolders = [...sortedHolders].sort((a, b) => (
      number(priorities?.[item.tranche.id]?.[b.id]) - number(priorities?.[item.tranche.id]?.[a.id])
      || capacities[a.id] - capacities[b.id]
      || String(a.id).localeCompare(String(b.id))
    ));
    edgeHolders.forEach((holder) => {
      if (!isEligible(holder, item.tranche)) return;
      const holderIndex = sortedHolders.findIndex((candidate) => candidate.id === holder.id);
      edgeRefs[item.tranche.id][holder.id] = addEdge(trancheNode, holderOffset + holderIndex, demandCents);
    });
  });
  sortedHolders.forEach((holder, holderIndex) => {
    addEdge(holderOffset + holderIndex, sink, Math.max(0, capacities[holder.id] || 0));
  });

  while (true) {
    const level = Array(graph.length).fill(-1);
    level[source] = 0;
    const queue = [source];
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const node = queue[cursor];
      graph[node].forEach((edge) => {
        if (edge.capacity > 0 && level[edge.to] < 0) {
          level[edge.to] = level[node] + 1;
          queue.push(edge.to);
        }
      });
    }
    if (level[sink] < 0) break;
    const nextEdge = Array(graph.length).fill(0);
    const send = (node, flow) => {
      if (node === sink) return flow;
      for (; nextEdge[node] < graph[node].length; nextEdge[node] += 1) {
        const edge = graph[node][nextEdge[node]];
        if (edge.capacity <= 0 || level[edge.to] !== level[node] + 1) continue;
        const pushed = send(edge.to, Math.min(flow, edge.capacity));
        if (pushed > 0) {
          edge.capacity -= pushed;
          graph[edge.to][edge.reverse].capacity += pushed;
          return pushed;
        }
      }
      return 0;
    };
    while (send(source, demandCents) > 0) {
      // Continue until the current level graph is exhausted.
    }
  }

  const allocations = Object.fromEntries(sortedTranches.map((item) => [
    item.tranche.id,
    Object.fromEntries(sortedHolders.map((holder) => {
      const edge = edgeRefs[item.tranche.id][holder.id];
      return [holder.id, edge ? edge.originalCapacity - edge.capacity : 0];
    })),
  ]));
  const allocatedByTranche = Object.fromEntries(sortedTranches.map((item) => [
    item.tranche.id,
    Object.values(allocations[item.tranche.id]).reduce((sum, amount) => sum + amount, 0),
  ]));
  return { allocations, allocatedByTranche };
}

function isEligible(holder, tranche) {
  if (tranche.eligibility === "escrow") return holder.escrowEligible;
  if (tranche.eligibility === "deferred") return holder.deferredEligible;
  return true;
}

function formatEngineMoney(value) {
  return `$${Math.round(Math.max(0, number(value)) * 100) / 100}`;
}

function normalizeStakeholder(holder) {
  return {
    ...holder,
    id: String(holder.id),
    securityType: holder.securityType || "common",
    shares: Math.max(0, number(holder.shares)),
    eligiblePercent: clamp(number(holder.eligiblePercent ?? 100) / 100, 0, 1),
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
    dividendsCountTowardCap: holder.dividendsCountTowardCap !== false,
    waiverPercent: clamp(number(holder.waiverPercent), 0, 100),
    priorDistributions: Math.max(0, number(holder.priorDistributions)),
    seniority: Math.max(1, Math.round(number(holder.seniority || 1))),
    participation: holder.participation || "none",
    capMultiple: Math.max(0, number(holder.capMultiple || 0)),
    strike: Math.max(0, number(holder.strike)),
    conversionPolicy: holder.conversionPolicy || "elective",
    ratchetType: holder.ratchetType || "none",
    conversionMultiplier: Math.max(0, number(holder.conversionMultiplier ?? 1)),
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
  if (type === "custom") return Math.max(0, number(holder.conversionMultiplier ?? 1));
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
  return claims.sort((a, b) => a.seniority - b.seniority).map((claim) => {
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

function validateStakeholderIds(stakeholders) {
  const ids = stakeholders.map((holder) => String(holder?.id ?? "").trim());
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) {
    throw new Error("Stakeholder IDs must be present and unique.");
  }
}

function validateEntityIds(items, label) {
  const ids = items.map((item) => String(item?.id ?? "").trim());
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) {
    throw new Error(`${label} IDs must be present and unique.`);
  }
}

function reconcileToCents(payouts, target, ids) {
  const rawCents = Object.fromEntries(ids.map((id) => [id, Math.max(0, number(payouts[id])) * 100]));
  const cents = Object.fromEntries(ids.map((id) => [id, Math.floor(rawCents[id] + 1e-9)]));
  const targetCents = Math.round(number(target) * 100);
  let difference = targetCents - ids.reduce((sum, id) => sum + cents[id], 0);
  if (difference > 0 && ids.length > 0) {
    const recipients = [...ids].sort((a, b) => (
      (rawCents[b] - Math.floor(rawCents[b])) - (rawCents[a] - Math.floor(rawCents[a]))
      || ids.indexOf(a) - ids.indexOf(b)
    ));
    for (let index = 0; difference > 0; index = (index + 1) % recipients.length) {
      cents[recipients[index]] += 1;
      difference -= 1;
    }
  } else if (difference < 0) {
    const donors = [...ids].sort((a, b) => (
      (rawCents[a] - Math.floor(rawCents[a])) - (rawCents[b] - Math.floor(rawCents[b]))
      || ids.indexOf(a) - ids.indexOf(b)
    ));
    while (difference < 0) {
      const donor = donors.find((id) => cents[id] > 0);
      if (!donor) break;
      cents[donor] -= 1;
      difference += 1;
    }
  }
  ids.forEach((id) => { payouts[id] = cents[id] / 100; });
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
