# Design and UX audit

## Baseline: SAFE dilution simulator

Overall score: **5/20 — critical redesign needed**

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

Post-redesign score: **19/20 — production-ready with one bounded limitation**

| Dimension | Score | Improvement |
|---|---:|---|
| Accessibility | 4/4 | Semantic labels and tables, a skip link, visible focus rings, 44px controls, non-color legend labels, readable type, and reduced-motion support. |
| Performance | 4/4 | No framework, CDN, font, or build-time dependency; the browser loads static HTML, CSS, and ES modules only. |
| Responsive behavior | 4/4 | Two-pane desktop workspace becomes a single-column model at tablet widths; forms, metrics, and actions reflow at mobile widths while wide tables remain scrollable. |
| Theming and system coherence | 3/4 | A compact token system controls color, spacing, borders, focus, and status feedback. It intentionally ships as a light financial workstation rather than a dual-theme product. |
| Design-pattern discipline | 4/4 | The hierarchy follows the financial job: bridge, consideration, securities, reconciled output, sensitivity, methodology, and sources. Decoration is subordinate to data. |

### Remaining limitation

The browser solver exhaustively optimizes up to 12 elective preference classes (4,096 election combinations). Larger models remain supported, but classes beyond that limit should be forced to preference or conversion based on counsel-reviewed terms.
