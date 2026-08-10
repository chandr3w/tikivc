# Design and UX audit

## Independent performance and design audit — August 10, 2026

Independent baseline score: **16/20 (Good)**. Post-fix score: **19/20 (Excellent)**.

| Dimension | Before | After | Finding and resolution |
|---|---:|---:|---|
| Accessibility | 3/4 | 4/4 | The native dialogs were unnamed and the whole-model live summary could fire during every slider render. Both dialogs now use `aria-labelledby`, while result announcements have an independent 350ms pause. |
| Performance | 3/4 | 3/4 | The Airtable solver measured 16.36ms p50 and 28.01ms p95 before DOM work. High-frequency updates are now capped near 30fps, storage writes are delayed independently, unchanged result regions retain their DOM, result-tab changes update only their outcome panels, the clock formatter is reused, and the pointer cursor is frame-coalesced. Fully granular value-level DOM patching remains a future optimization. |
| Responsive behavior | 3/4 | 4/4 | At 320px, “expected present value” lost its meaning through ellipsis and the phone chart heading was cramped. Metric labels now wrap in a reserved two-line area and chart headings stack cleanly. |
| Theming and system coherence | 4/4 | 4/4 | The existing Bricolage, Inter and JetBrains Mono roles remain unchanged. Important DPI, IRR and comparison labels now meet the 10px App-mode floor. |
| Design-pattern discipline | 3/4 | 4/4 | The lone diffuse mint focus glow was removed. The custom cursor now animates a transform-only pseudo-element instead of width and height. |

### Independent audit evidence

- Engine benchmark after warmup: Airtable 16.36ms p50 / 28.01ms p95; Brex 1.39ms / 2.23ms; venture 0.77ms / 1.12ms; clean 0.05ms / 0.31ms.
- Baseline render: 535 DOM nodes at 1366×768 and roughly 415 descendants in the results subtree.
- No page-level overflow at 1366×768, 390×844, 320×568 or the 683×384 CSS-viewport equivalent of 200% zoom.
- No mobile primary target below 44×44px. The wide waterfall table remains intentionally contained with a sticky first column and visible scroll cue.
- No unexpected font family, cardification, nested-card sprawl, gradients, decorative glow after the fix, or browser warning/error.

### Verification after changes

- At 390×844 and 320×568, metric labels preserve their full text and the page has no horizontal overflow.
- Result-tab activation preserves focus, selection state and `aria-labelledby` relationships while avoiding a full results refresh.
- The Methods dialog is exposed as `dialog "Methods & mechanics"`; Sources uses the same naming pattern.
- Slider value, styled progress and paired numeric output stay synchronized after keyboard adjustment.
- Engine tests and JavaScript syntax checks pass.

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

## Mobile design and performance audit — August 7, 2026

### Audit health score

| Dimension | Before | After | Key finding |
|---|---:|---:|---|
| Accessibility | 2/4 | 4/4 | Input tabs, shared check rows and range sliders were below the 44px touch standard. Long mobile helper copy also used the lowest-contrast 10px tier. All primary targets now meet 44px, and substantive mobile helper text uses the stronger Inter tier. |
| Performance | 3/4 | 4/4 | A single pari-passu change calculated the active waterfall twice, calculated the comparison case, and rebuilt both closed dialogs. The active result is now memoized, dialogs render only when opened, and the comparison case is the only additional waterfall solve. |
| Responsive behavior | 2/4 | 4/4 | The 620px input pane exceeded a 568px phone viewport, the header consumed 221px, and the populated Securities view exposed a 14,061px nested scroll path. The pane now uses dynamic viewport height, header actions fit one row, fixed input/results navigation preserves context, and collapse-all reduces the populated editor path by 87% while rows remain expanded by default. |
| Theming and system coherence | 4/4 | 4/4 | The mobile controls retain the Atas app-mode tokens, official logo, self-hosted three-font system, mint focus states and low-radius surfaces. |
| Design-pattern discipline | 4/4 | 4/4 | No slop warnings fired. The rendered container audit found a single square panel with rule-separated regions, no nested cards, no gradient text, no decorative side stripes and no rounded-card grid. |
| **Total** | **15/20** | **20/20** | **Good → Excellent** |

### Anti-pattern verdict

The mobile simulator does not look AI-generated. The deterministic pass found zero warning-level slop tells and zero advisory cardification findings. Inter is the documented Atas body/UI face rather than a standalone brand treatment; Bricolage Grotesque supplies display contrast and JetBrains Mono is limited to fixed corner chrome. All three self-hosted fonts report loaded, and no visible text role uses an unintended family.

### Resolved findings

| Severity | Location | Impact | Resolution |
|---|---|---|---|
| P1 | `.control-panel`, `.panel-scroll`, `@media (max-width: 960px)` | A fixed 620px nested pane made the main editor taller than small phones and pushed results more than a screen away. | The pane now uses `min(72dvh, 620px)` and a persistent, safe-area-aware input/results jump bar. |
| P1 | Airtable Securities editor | Thirteen expanded rows produced 14,061px of nested scrolling with no fast way to scan or reach a specific round. | Collapse-all and expand-all controls were added to every repeatable editor. All rows still open by default; collapsing the Airtable rows reduces the path to 1,897px. |
| P1 | `.input-tab`, `.shared-checks .check-field`, `input[type="range"]` | 32–40px controls increased missed taps and failed the 44px mobile target standard. | All primary mobile controls and navigation links now measure at least 44×44px across the tested matrix. |
| P2 | `.app-header`, `.header-tools` | Five actions occupied two rows and made the phone header 221px tall. | Actions use one five-column row at phone widths, reducing the header to 161px at 320–430px widths. |
| P2 | `.modal`, `.modal-frame`, `.modal-content` | Dialog contents exceeded the dialog box by 42px at 390×844. | The dialog is a bounded two-row grid using dynamic viewport height; header and scrollable content now reconcile exactly at 320×568 and 390×844. |
| P2 | `renderAll`, `updateStateFromControl`, `calculateModel` | Closed explainers were rebuilt and the same active waterfall was solved repeatedly during input changes. | Dialog rendering moved to open-time and the active model is cached by its economic inputs. |

### Verification

- Browser matrix: 320×568, 360×800, 390×844, 430×932 and 844×390.
- Zero page-level horizontal overflow at every tested size.
- Zero undersized primary targets after excluding the visually hidden checkbox input inside its 44px associated label.
- Input/results anchors preserve 5px clearance below the fixed Atas logo at the smallest width.
- Methods dialog fits 286×544 inside a 320×568 viewport; dialog and frame scroll heights reconcile exactly.
- All editor rows remain expanded by default. Collapse/expand works across Securities, Consideration and People without mutating model economics.
- No browser console warnings or errors.
- Static payload remains dependency-free and under 500KB uncompressed including all three self-hosted fonts and the official logo.
- Engine regression suite and JavaScript syntax checks pass.
