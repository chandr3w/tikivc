# Design and UX audit

## Baseline: SAFE dilution simulator

Overall score: **5/20. Critical redesign needed.**

| Dimension | Score | Primary finding |
|---|---:|---|
| Accessibility | 1/4 | Unlabeled name inputs, icon-only removal controls, 10px text, color-only chart identification, and undersized targets made core tasks difficult for keyboard and low-vision users. |
| Performance | 1/4 | React, Tailwind, and Babel were loaded from public CDNs and JSX was compiled in the browser for a single-file calculator. |
| Responsive behavior | 2/4 | The five-column round-entry layout compressed poorly and forced dense, repetitive scanning. |
| Theming and system coherence | 1/4 | Hard-coded colors and spacing prevented systematic adaptation or maintenance. |
| Design-pattern discipline | 0/4 | Nested cards, decorative side accents, repeated uppercase kickers, a fashionable violet palette, and tiny dense labels obscured the actual financial workflow. |

### Highest-priority product risks

1. **Waterfall correctness:** the interface described reverse seniority, but an underfunded preference pool was prorated across all preferred holders instead of paying senior tiers first.
2. **Data integrity:** holder names were used as payout keys, so duplicate names silently overwrote results.
3. **Transaction incompleteness:** the calculator began at exit value and omitted the enterprise-to-equity bridge, participation, caps, ratchets, dividends, option strike value, holdbacks, and contingent consideration.
4. **Cognitive load:** financing-round setup dominated the screen even though the intended job was exit modeling.

## Implemented redesign

Post-redesign score: **20/20**

| Dimension | Score | Improvement |
|---|---:|---|
| Accessibility | 4/4 | Semantic labels and tables, a skip link, visible focus rings, 44px controls, non-color legend labels, readable type, and reduced-motion support. |
| Performance | 4/4 | No framework, CDN, font, or build-time dependency; the browser loads static HTML, CSS, and ES modules only. |
| Responsive behavior | 4/4 | Two-pane desktop workspace becomes a single-column model at tablet widths; forms, metrics, and actions reflow at mobile widths while wide tables remain scrollable. |
| Theming and system coherence | 4/4 | The Atas app-mode system uses self-hosted Bricolage Grotesque, Inter, and JetBrains Mono; a near-black layered canvas; mint-only chroma; official Atas marks; mono corner chrome; and consistent interaction tokens. |
| Design-pattern discipline | 4/4 | The one-screen workspace uses input tabs, three financial visualizations, and one holder table. Results are flat instead of nested in an outer card. Notices use full borders. Methods, mechanics, sources, and disclosures live in focused dialogs. |

### Final audit notes

- The actual Atas wordmark appears in the fixed top-left brand position. The duplicate header logo and top-right status label were removed.
- Selects and checkboxes use complete Atas theming across default, hover, focus, checked, invalid and disabled states.
- At laptop width, the EV bridge spans the results pane while ownership and sensitivity charts share a second row. At narrower widths, all charts stack at full width.
- Airtable is the default case, Brex is separate, and modeled inputs are stated in the interface and source dialog.
- The solver exhaustively optimizes up to 12 elective preference classes, or 4,096 combinations. Larger cap tables use deterministic best-response elections and disclose the method and stability result; they are no longer forced to convert.

## Result-clarity audit

Independent score before changes: **18/20**

| Severity | Finding | Evidence | Resolution |
|---|---|---|---|
| P1 | The allocation donut duplicated the holder table and omitted share-class outcomes. | `renderAllocationDonut` grouped the five largest stakeholder rows rather than security classes. | Replaced it with a class-level proceeds view showing gross payout, percentage, eligible shares and preference paid. |
| P1 | The EV bridge obscured a simple equation with zero-value bars. | The Airtable chart rendered debt, working capital, costs and other adjustments at $0. | Replaced the chart with an explicit EV, net-adjustment and equity-value equation. Zero-value rows are omitted. |
| P2 | Stakeholder detail did not expose the class used for aggregation. | The table showed only security type and election. | Added an editable share-class field and a share-class column in the holder table. |

Post-change score: **20/20**. The interface separates class economics from holder ownership, keeps the full calculation accessible to screen readers, and preserves the Atas app-mode hierarchy.

## Functional and chart-linkage re-audit — August 6, 2026

Overall score before fixes: **17/20**. Post-fix score: **20/20**.

| Dimension | Before | After | Finding and resolution |
|---|---:|---:|---|
| Accessibility | 4/4 | 4/4 | Exact values remain visible in text and tables; chart bars are supplementary and hidden from the accessibility tree. |
| Performance | 4/4 | 4/4 | The calculation remains dependency-free and updates in place. |
| Responsive behavior | 4/4 | 4/4 | At 1280×720 the page has no horizontal overflow; result and input panes retain independent vertical scrolling. |
| Theming and system coherence | 3/4 | 4/4 | Very small linear bars looked disconnected from eight-figure labels. Comparison bars now use a disclosed square-root scale and exact value bindings. |
| Design-pattern discipline | 2/4 | 4/4 | Founder/common bars were based on share count while labeled as proceeds. They now use modeled entitlement, and every rendered bar carries the exact amount that determines its width. |

### Verification

- Automated engine coverage verifies all enterprise-to-equity bridge fields, preferences, seniority, participation, dividends, ratchets, option strikes, vesting, acceleration, recovery floors, tranche timing, discounting, eligibility, and payout conservation across every preset.
- Browser testing exercised 22 end-to-end workflows covering presets, reset and persistence, both result views, every input section, row creation/removal, universal preference and optimal-conversion controls, model actions, dialogs, and chart updates.
- A rendered-value audit checked all 38 Airtable bars: 20 investor bars, 16 employee bars, and 2 founder/common bars. Every width matched its bound amount.
- A separate logic defect was corrected: an explicit 0% holder eligibility setting had been normalized to 100%.

## Independent mathematical audit — August 7, 2026

The independent review found six material calculation and data-integrity risks. Each now has a targeted regression test.

| Area | Defect | Resolution |
|---|---|---|
| Deferred proceeds | Included escrows were withheld pro rata from a full-exit allocation, and incremental earnouts were also allocated from final entitlements. Both could bypass a binding preference at closing. | Initial cash and noncontingent at-close forms are waterfalled together and split by form. Every later included or incremental tranche is processed chronologically through an updated cumulative waterfall after crediting prior payments. |
| Conversion elections | A 13th elective preferred class was silently forced to convert. | Models with up to 12 elective classes remain exhaustive; larger models use a deterministic best-response solver and expose stability and regret. |
| Consideration allocation | The legacy fixed-entitlement allocator could depend on tranche order, holder IDs, strand feasible value when eligibility overlapped, and assign same-time tranche risk differently after row reordering. | Every tranche chooses closing-pro-rata or cumulative allocation. Same-time cumulative tranches are solved together; a proportional, integer-cent capacity solver reserves restricted capacity without letting row order or IDs determine economic allocation. Any legally unallocable value is reported explicitly. |
| Option exercise | The exercised percentage was applied to newly accelerated options as well as historically vested options. | Historical exercise applies only to vested shares; newly accelerated awards remain unexercised unless transaction terms provide otherwise. |
| Entity identity | Duplicate or blank stakeholder IDs could overwrite payouts before the interface warned the user. | Imported rows receive unique IDs, while the engine rejects ambiguous stakeholder and tranche identifiers. |
| Investor attribution | Financing round size, class preference basis and a modeled investor check were conflated, and an explicit zero-dollar check defaulted to the full class. | The three inputs are independent. Preference basis drives the claim; round size is context; check size controls attribution and respects zero. |
| Cent reconciliation | Independent row rounding could overpay small holders and make the first row negative when the aggregate correction was large. | Nonnegative largest-remainder reconciliation now conserves the target amount without assigning a negative payout. |
| Advanced terms | Split claims, prior payments and waivers existed in the engine but individual inputs were erased before an end-to-end model run; the advanced preset was also being overwritten by universal terms. | Individual overrides now expose and preserve split priority, prior distributions, waivers, paid dividends, compounding, cap convention and forced elections. The advanced preset uses genuine class-specific overrides. |
| Participation caps | Capped participants could leave the residual solver before receiving the cap, and prior distributions were inconsistently credited. | The residual solver pays capped claims to saturation, credits prior distributions, applies historical payments in priority order and makes paid-dividend treatment explicitly configurable. |

The two allocation bases reflect both patterns in SEC-filed transaction documents: some post-closing adjustments and earnouts use an updated waterfall after crediting prior payments, while escrow and representative-fund releases may use a fixed closing-payment share. The governing merger agreement controls each tranche.

The pari passu control was also narrowed after primary-source review. It now governs preferred stock classes rather than every convertible instrument. Common remains junior; a standard SAFE preserves its own claim and can share the preferred tier; an outstanding note keeps its debt-senior or custom treatment. Rights follow the security, so founder-owned investor preferred is not excluded merely because its holder is a founder.

### Mathematical verification

- Binding-preference fixtures verify both a $50 incremental earnout and a $50 included escrow against $50 of closing cash: preferred receives $50 at close and $10 later; common receives $0 at close and $40 later.
- A debt/SAFE/preferred fixture verifies that a $50 outstanding note is paid before a $30 SAFE and $40 preferred class share the remaining $10 pari passu; disabling universal preferred terms does not erase the note or SAFE claim.
- Constrained-allocation fixtures verify that a restricted $50 escrow reserves the only eligible holder's capacity while unrestricted $50 stock moves to the other holder, independent of row order.
- A boundary-feasible three-holder fixture reserves all deferred-only capacity, then divides unrestricted consideration by the remaining 32:73 economic entitlement rather than lexicographic holder ID; a 100-holder sub-dollar fixture verifies nonnegative cent reconciliation.
- Preference, participation, dividend, ratchet, option, eligibility, bridge-sign, and present-value fixtures all pass.
- Every bundled preset conserves gross waterfall proceeds and reconciles closing plus deferred consideration to holder entitlement within one cent.
- 1,500 randomized cap tables with up to 15 preferred classes conserve proceeds, remain invariant to consideration-row order and return stable, finite results.
