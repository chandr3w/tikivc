# Exit Waterfall

A dependency-free M&A exit simulator for moving from enterprise value to holder-level proceeds. It models the purchase-price bridge, security waterfall, and the timing/form of consideration as separate ledgers. The one-screen Atas VC workspace pairs compact inputs with an explicit EV-to-equity equation, paired initial-investment-versus-exit-value bars, and an exit-sensitivity curve. Methods and sources live in focused dialogs.

The default Airtable model uses Bending Spoons' announced August 2026 all-cash acquisition: a reported $1.285 billion purchase price and $2.25 billion implied equity value including Airtable cash. A corporate-filings-based 2024 cap-table snapshot separates common and Seed through Series F cohorts, with each preferred series modeled as converted common and liquidation preferences set to zero. A separate Brex preset uses Capital One's completed April 2026 acquisition terms with an approximate holder split. The advanced preset demonstrates a complex venture-backed sale.

## Mechanics modeled

- Enterprise value, cash, debt, debt-like items, working-capital adjustments, transaction costs, change-in-control or carve-out payments, transfer taxes, and other adjustments
- Universal transaction settings for liquidation preference, pari passu treatment, financially optimal conversion, participation, dividends, anti-dilution, escrow eligibility, and deferred consideration, with an explicit per-holder override for exceptions
- Senior and junior preference tiers, pari passu sharing within a tier, split-priority claims, zero-to-multiple liquidation preferences, and prior-distribution offsets
- Non-participating, fully participating, and capped participating preferred; economically optimized or manually forced conversion elections
- Fixed, simple, or compounded cumulative dividends; partial preference waivers and pay-to-play reductions
- Full-ratchet, weighted-average, or custom anti-dilution conversion adjustments
- Preferred stock, SAFEs, convertible notes, common stock, restricted stock/RSUs, options, and warrants
- Vested/eligible percentages, option and warrant strike value, escrow eligibility, and deferred-consideration eligibility
- Buyer stock, purchase-price and indemnity escrows, representative expense funds, seller notes, earnouts, rollover equity, and other tranches
- Included versus incremental contingent consideration, probability-weighted present value, and EV sensitivity

The waterfall enumerates elective preference and conversion combinations for up to 12 elective classes, applies senior tiers in order, shares an underfunded tier pro rata by claim amount, then solves residual common-equivalent value with in-the-money option spread by binary search. Results reconcile to cents.

## Run locally

```bash
npm test
npm run serve
```

Open `http://127.0.0.1:8770`. The app has no runtime dependencies, sends no model data to a server, and stores the working model in browser local storage. Models can be downloaded and re-imported as JSON.

## Airtable preset

Airtable disclosed a $735 million Series F at an $11 billion pre-money valuation in December 2021 and $1.36 billion of total funding. Axios reported Bending Spoons' announced acquisition on August 4, 2026 at a $1.285 billion cash purchase price and $2.25 billion implied equity value including cash and cash equivalents. The preset therefore models a $965 million cash bridge, no debt and 58,734,171 outstanding shares from a December 2024 Notice.co report built from corporate filings. Seed through Series F are shown separately with public round amounts, estimated gross MOIC and 0× liquidation preferences. The cap table may have changed since the report, and the transaction has not yet closed.

## Brex preset

Capital One completed its Brex acquisition on April 7, 2026. Its closing Form 8-K reports about $2.56 billion of cash and 10.65 million Capital One shares, valued near $1.9 billion at closing. The preset uses that $4.46 billion closing value and consideration mix. Brex's holder split, option pool and strike price remain modeled inputs because the full cap table is not public.

## Research basis

- [Wilson Sonsini venture financing fundamentals](https://www.wsgr.com/email/college-for-clients-series/2024/VC-Financing/PPT-2024-C4C-VC-Financing-Fundamentals.pdf)
- [Fenwick venture financing overview](https://assets.fenwick.com/legacy/FenwickDocuments/Venture-Financing-Overview.pdf)
- [Y Combinator SAFE user guide](https://bookface-static.ycombinator.com/assets/ycdc/SAFE%20User%20Guide-a47c6588327d73aa2799e61ed7c2cae9f1a0ee9acfa9c43b62039dc06e715832.pdf)
- [NVCA model legal documents](https://nvca.org/model-legal-documents/)
- [SRS Acquiom 2025 M&A deal-terms reference](https://media.taftlaw.com/wp-content/uploads/2025/04/15175412/2025-SRS-Acquiom-MA-Deal-Terms-Study-2-page-quick-reference.pdf)

## Important limitation

This is an analytical model, not a substitute for the actual charter, financing documents, equity plan, merger agreement, tax analysis, or closing funds-flow memorandum. Bespoke instruments can produce outcomes that require deal-specific drafting and legal interpretation.
