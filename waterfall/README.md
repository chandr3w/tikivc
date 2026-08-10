# Exit Waterfall

A dependency-free M&A exit simulator for moving from enterprise value to holder-level proceeds. It models the purchase-price bridge, security waterfall, and the timing/form of consideration as separate ledgers. The one-screen Atas VC workspace pairs compact inputs with an explicit EV-to-equity equation and proceeds comparisons for investors, founders, and employee cohorts. Methods and sources live in focused dialogs.

The default Airtable model uses Bending Spoons' announced August 2026 all-cash acquisition: a reported $1.285 billion purchase price and $2.25 billion implied equity value including Airtable cash. A corporate-filings-based 2024 cap-table snapshot separates common and Seed through Series F cohorts with filing-derived 1× pari passu, non-participating preferences and financially optimal conversion. A separate Brex preset uses Capital One's completed April 2026 cash-and-stock acquisition terms with an approximate holder split. A neutral new-deal starter exposes every configurable section, while the advanced preset demonstrates a complex venture-backed sale.

## Mechanics modeled

- Enterprise value, cash, debt, debt-like items, working-capital adjustments, transaction costs, change-in-control or carve-out payments, transfer taxes, and other adjustments
- Universal preferred-stock settings for liquidation preference, pari passu treatment, financially optimal conversion, participation, dividends, and anti-dilution, plus shared consideration eligibility and per-instrument overrides
- Senior and junior preference tiers, pari passu sharing within a tier, split-priority claims, zero-to-multiple liquidation preferences, and prior-distribution offsets
- Non-participating, fully participating, and capped participating preferred; economically optimized or manually forced conversion elections
- Fixed, simple, or compounded cumulative dividends; partial preference waivers and prior-payment credits
- Full-ratchet, weighted-average, or custom anti-dilution conversion adjustments
- Preferred stock, SAFEs, convertible notes, common stock, restricted stock/RSUs, options, and warrants
- Vested/eligible percentages, option and warrant strike value, escrow eligibility, and deferred-consideration eligibility
- Buyer stock, purchase-price and indemnity escrows, representative expense funds, seller notes, earnouts, rollover equity, and other tranches
- Per-tranche choice between closing-pro-rata allocation and an updated cumulative waterfall; same-time cumulative tranches are solved together
- Probability-weighted present value for escrow, stock, notes, earnouts, rollover, and other deferred streams
- Per-class modeled gross DPI and annualized IRR using editable investment-to-exit periods and actual tranche timing

The waterfall exhaustively enumerates preference and conversion combinations for up to 12 elective classes and uses deterministic best-response elections for larger cap tables. It applies senior tiers in order, shares an underfunded tier pro rata by claim amount, then solves residual common-equivalent value with in-the-money option spread by binary search. Each consideration tranche can use the initial closing-payment share or an updated cumulative waterfall after crediting prior payments. Same-time cumulative tranches are allocated simultaneously, and overlapping eligibility constraints use an integer-cent capacity solver with proportional balancing and explicit reporting of any value that cannot legally be allocated. Results use nonnegative largest-remainder cent reconciliation.

Universal pari passu applies to preferred stock classes, not to common or outstanding convertible debt. Standard SAFEs retain their contractual cash-out claim and share the preferred tier when the setting is on. Outstanding notes retain individual debt-senior treatment; a note repaid at closing should ordinarily also appear in the enterprise-to-equity bridge rather than be double-counted as a holder claim.

SAFE and note rows model a specified cash-out claim, as-converted share count and seniority. They do not derive conversion shares from valuation caps, discounts, accrued note interest or document-specific definitions; those figures should be calculated from the governing instrument and entered directly.

Gross DPI and IRR use nominal modeled consideration, including buyer stock, rollover and contingent value. Those instruments are not realized fund distributions until monetized. The preset holding periods are editable financing-date approximations; reported fund returns should use actual dated cash flows.

## Run locally

```bash
npm test
npm run serve
```

Open `http://127.0.0.1:8770`. The app has no runtime dependencies, sends no model data to a server, and stores the working model in browser local storage. Models can be downloaded and re-imported as JSON. The `linkedin` action builds a local 1080×1350 PNG preview from the active outcome tab. Its headline names the modeled company; the investor image uses selected primary financing rounds for feed readability, while the underlying simulator retains every class.

## Airtable preset

Airtable disclosed a $735 million Series F at an $11 billion pre-money valuation in December 2021 and $1.36 billion of total funding. Axios reported Bending Spoons' announced acquisition on August 4, 2026 at a $1.285 billion cash purchase price and $2.25 billion implied equity value including cash and cash equivalents. The preset therefore models a $965 million cash bridge, no debt and 58,734,171 outstanding shares from a December 2024 Notice.co report built from corporate filings. Seed through Series F are shown separately with filing-derived class preference bases and 1× pari passu preferences. Their editable fallback seniority is assigned by financing round—Series F first through Seed last—so disabling pari passu produces a conventional last-money-first downside stack. Public financing announcements can differ from the aggregate original-purchase-price basis implied by outstanding class shares, so preference basis, financing round size and modeled investor check are separate editable inputs. The cap table may have changed since the report, and the transaction has not yet closed.

## Brex preset

Capital One completed its Brex acquisition on April 7, 2026. Its closing Form 8-K reports about $2.56 billion of cash and 10,646,306 Capital One shares. At the disclosed $181.15 closing price, the preset uses $4.488578 billion of total consideration. Capital One's Form 8937 describes holder-level cash/stock elections and accreditation rules; the preset's buyer-stock row is therefore an aggregate pro-rata approximation, not a reconstruction of each holder's elected form. Brex's full closing cap table and employee award terms are not public, so founder/common allocations and employee exercise assumptions remain editable estimates.

## Research basis

- [Wilson Sonsini venture financing fundamentals](https://www.wsgr.com/email/college-for-clients-series/2024/VC-Financing/PPT-2024-C4C-VC-Financing-Fundamentals.pdf)
- [Fenwick venture financing overview](https://assets.fenwick.com/legacy/FenwickDocuments/Venture-Financing-Overview.pdf)
- [Y Combinator SAFE user guide](https://bookface-static.ycombinator.com/assets/ycdc/SAFE%20User%20Guide-a47c6588327d73aa2799e61ed7c2cae9f1a0ee9acfa9c43b62039dc06e715832.pdf)
- [NVCA model legal documents](https://nvca.org/model-legal-documents/)
- [SRS Acquiom 2025 M&A deal-terms reference](https://media.taftlaw.com/wp-content/uploads/2025/04/15175412/2025-SRS-Acquiom-MA-Deal-Terms-Study-2-page-quick-reference.pdf)
- [SEC-filed updated distribution waterfall example](https://www.sec.gov/Archives/edgar/data/1636422/000163642225000028/exhibit21agreementandplano.htm)
- [SEC-filed pari passu preferred waterfall example](https://www.sec.gov/Archives/edgar/data/830656/000083065611000006/ex3-1.pdf)

## Important limitation

This is an analytical model, not a substitute for the actual charter, financing documents, equity plan, merger agreement, tax analysis, or closing funds-flow memorandum. Bespoke instruments can produce outcomes that require deal-specific drafting and legal interpretation.
