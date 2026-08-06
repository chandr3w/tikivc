# Exit Waterfall

A dependency-free M&A exit simulator for moving from enterprise value to holder-level proceeds. It models the purchase-price bridge, security waterfall, and the timing/form of consideration as separate ledgers. The one-screen Atas VC workspace pairs compact inputs with an EV bridge waterfall chart, proceeds-ownership donut, and exit-sensitivity curve; methods and sources live in focused dialogs.

The default model is intentionally clean: a $100 million cash acquisition, no adjustments, no preferences, and an 80/20 common ownership split. The Airbnb preset combines public capitalization and balance-sheet data with clearly labeled hypothetical deal terms. The advanced preset demonstrates a complex venture-backed sale.

## Mechanics modeled

- Enterprise value, cash, debt, debt-like items, working-capital adjustments, transaction costs, change-in-control or carve-out payments, transfer taxes, and other adjustments
- Senior and junior preference tiers, pari passu sharing within a tier, split-priority claims, zero-to-multiple liquidation preferences, and prior-distribution offsets
- Non-participating, fully participating, and capped participating preferred; economically optimized or manually forced conversion elections
- Fixed, simple, or compounded cumulative dividends; partial preference waivers and pay-to-play reductions
- Full-ratchet, weighted-average, or custom anti-dilution conversion adjustments
- Preferred stock, SAFEs, convertible notes, common stock, restricted stock/RSUs, options, and warrants
- Vested/eligible percentages, option and warrant strike value, escrow eligibility, and deferred-consideration eligibility
- Buyer stock, purchase-price and indemnity escrows, representative expense funds, seller notes, earnouts, rollover equity, and other tranches
- Included versus incremental contingent consideration, probability-weighted present value, and EV sensitivity

The waterfall enumerates elective preference/conversion combinations for up to 12 elective classes, applies senior tiers in order, shares an underfunded tier pro rata by claim amount, then solves the residual common-equivalent value—including in-the-money option spread—by binary search. Results reconcile to cents.

## Run locally

```bash
npm test
npm run serve
```

Open `http://127.0.0.1:8770`. The app has no runtime dependencies, sends no model data to a server, and stores the working model in browser local storage. Models can be downloaded and re-imported as JSON.

## Airbnb preset

Public facts are based on Airbnb’s Q1 2026 Form 10-Q and 2026 proxy. The preset excludes company-owned Class H shares and separates disclosed options and RSUs from voting shares. It models an illustrative $190 per-share acquisition with $120.74 billion of fully diluted equity value and a 75% cash / 25% buyer-stock mix. The offer price, premium, and consideration mix are hypothetical and editable; every source and assumption appears in the sources dialog.

## Research basis

- [Wilson Sonsini venture financing fundamentals](https://www.wsgr.com/email/college-for-clients-series/2024/VC-Financing/PPT-2024-C4C-VC-Financing-Fundamentals.pdf)
- [Fenwick venture financing overview](https://assets.fenwick.com/legacy/FenwickDocuments/Venture-Financing-Overview.pdf)
- [Y Combinator SAFE user guide](https://bookface-static.ycombinator.com/assets/ycdc/SAFE%20User%20Guide-a47c6588327d73aa2799e61ed7c2cae9f1a0ee9acfa9c43b62039dc06e715832.pdf)
- [NVCA model legal documents](https://nvca.org/model-legal-documents/)
- [SRS Acquiom 2025 M&A deal-terms reference](https://media.taftlaw.com/wp-content/uploads/2025/04/15175412/2025-SRS-Acquiom-MA-Deal-Terms-Study-2-page-quick-reference.pdf)

## Important limitation

This is an analytical model, not a substitute for the actual charter, financing documents, equity plan, merger agreement, tax analysis, or closing funds-flow memorandum. Bespoke instruments can produce outcomes that require deal-specific drafting and legal interpretation.
