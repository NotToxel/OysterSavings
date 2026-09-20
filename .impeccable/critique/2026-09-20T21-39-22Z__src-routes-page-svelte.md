---
target: OysterSavings website
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
timestamp: 2026-09-20T21-39-22Z
slug: src-routes-page-svelte
---
# OysterSavings design critique

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of system status | 3 | Good loading and active states; some dynamic updates are not announced accessibly. |
| 2 | Match system / real world | 3 | Strong TfL concepts, but some fare and rail terminology assumes expertise. |
| 3 | User control and freedom | 2 | Main flows have exits, but Planner lacks undo/reset and navigation has no useful browser history. |
| 4 | Consistency and standards | 2 | Emoji, SVGs, clickable headers, custom toggles, and tooltips do not form one control system. |
| 5 | Error prevention | 2 | Validation exists, but complex planning actions need stronger previews and undo. |
| 6 | Recognition rather than recall | 3 | Labels and inline hints are generally good; mobile hides navigation labels. |
| 7 | Flexibility and efficiency | 2 | Filters and presets help, but there is little keyboard, batch, or power-user support. |
| 8 | Aesthetic and minimalist design | 2 | Too many cards, pills, gradients, and equally weighted controls obscure the decision. |
| 9 | Error recovery | 2 | Errors appear, but recovery guidance is uneven and technical details may leak through. |
| 10 | Help and documentation | 3 | The export walkthrough and FAQ are strong; advanced decisions lack contextual help. |
| **Total** |  | **24/40** | **Acceptable — strong product foundation, significant design work needed.** |

## Design Specificity Verdict

The content and workflows feel authored for Oyster and TfL; the visual shell still reads as a generic AI dashboard. Fare caps, route classification, commute profiles, privacy, and product comparisons show deep domain knowledge. Dark navy glass cards, ambient blobs, gradient headings, pills, cyan glow, emoji avatars, and universal rounded corners could be transferred almost unchanged to a fintech or analytics SaaS.

The replacement direction should feel like a calm London transport instrument: timetable hierarchy, wayfinding geometry, route and zone structure, tabular numerals, semantic line colour, and restrained surfaces. It should not imitate TfL branding, but should borrow the discipline of transport information design.

The deterministic scan found 28 warnings: 12 layout transitions, 7 side accents, 5 bounce easings, 2 gradient-text uses, and 2 rounded-card accents. The gradient headings are genuine and visible examples of the generic visual language. Most bounded progress-bar transitions and several semantic status accents are lower priority; two Planner border warnings are false positives because a later shorthand overrides them.

## Overall Impression

OysterSavings already contains a credible, unusually thoughtful transport-cost engine. The interface weakens that credibility by presenting it as a glossy exploration dashboard. The biggest opportunity is to make the savings recommendation—not the dashboard, demo persona, or visual effect—the protagonist.

## What’s Working

- The product journey is genuinely domain-specific: export guidance, routes, caps, fare states, and travel products reflect real user needs.
- Privacy reassurance is concrete about local processing and the limited role of TfL requests.
- Dense journey data remains fairly scannable through aligned money columns, filters, badges, sticky headers, and pagination.

## Priority Issues

### [P1] The first action disguises the actual task

**Why it matters:** “Generate Analysis” opens a six-step export tutorial rather than generating anything. Experienced users cannot upload directly, and first-timers experience a broken promise.

**Fix:** Make **Upload TfL journey history** the primary action. Use **Need help exporting your CSV?** as the secondary guided path and **Try sample data** as a quiet tertiary action.

**Suggested command:** `$impeccable onboard`

### [P1] The financial payoff is buried under personality content

**Why it matters:** After sharing sensitive history, users want to know what they should buy and how much it saves. Opening with “Night Owl” makes a serious financial tool feel gimmicky.

**Fix:** Default to a recommendation summary: current spend, best alternative, estimated saving, data confidence, and one next action. Move travel-pattern personas into a secondary section or remove them.

**Suggested command:** `$impeccable distill`

### [P1] Planner exposes the whole system at once

**Why it matters:** Period controls, routines, exceptions, detected routes, cost summary, comparison, calendar, fare types, and warnings create a high-error environment for a consequential decision.

**Fix:** Stage Planner into: choose scope; add routines; review calendar/exceptions; compare recommendation. Put defaults and fare settings in a persistent assumptions drawer, with a sticky recommendation summary.

**Suggested command:** `$impeccable shape`

### [P1] Mobile and keyboard accessibility fall below the visual bar

**Why it matters:** At 390 px, navigation becomes emoji-only; accessibility names are only the emoji. Planner’s CAP column clips, date/cap buttons lack context, tooltips are hover-only, and focus treatment is inconsistent.

**Fix:** Preserve text labels or use an explicitly labelled compact menu. Add global `:focus-visible`, real buttons for sortable headers, focus/tap tooltips, Space support, `aria-live` for progress/results, and AA contrast for muted text.

**Suggested command:** `$impeccable adapt`

### [P2] The chrome is generic where the product is specific

**Why it matters:** Glass panels, decorative gradients, glow, pill proliferation, and emoji avatars are the strongest “AI-generated SaaS” signals and weaken trust.

**Fix:** Use flatter opaque surfaces, fewer containers, a sharper spacing grid, tabular numbers, a single icon family, and transport colour only when it encodes a line, mode, state, or recommendation. Replace demographic demo avatars with journey-pattern diagrams.

**Suggested command:** `$impeccable quieter`

## Persona Red Flags

**Alex (power user):** Direct upload is hidden behind the walkthrough; there are no shortcuts, batch actions, saved filters, deep links, or import-all path for detected routines.

**Sam (accessibility-dependent):** Mobile navigation has emoji-only names; focus treatment is not systematic; some sortable headers are click handlers; tooltips depend on hover; small muted metadata is difficult to read; status changes are not consistently announced.

**Casey (distracted mobile commuter):** The header, stacked calls to action, and four feature pills delay the task; navigation sits outside the thumb zone; the cross-app CSV workflow is interruption-prone; Planner becomes very tall before reaching the decision.

## Cognitive Load

Five of eight checks fail on Planner and advanced analysis: single focus, chunking, one thing at a time, minimal choices, and progressive disclosure. The largest visible choice sets are six demo profiles, eight journey filters, five period presets, seven fare types, and dozens of interactive calendar cells.

## Minor Observations

- GitHub has too much prominence for a user task and belongs in the footer or About area.
- Privacy reassurance is repeated in the nav, hero, upload area, and footer; one strong explanation would feel more confident.
- The four homepage feature pills look interactive but are not.
- “Unlock Potential Savings” overpromises when “no extra saving” is a valid result.
- “Caps frozen until 2027” and abbreviations such as NR/PAYG need contextual explanation.
- Demo demographics do not help selection; journey pattern and decision goal do.

## Questions to Consider

- What if the first screen behaved like a ticket machine: one obvious action, explicit privacy, no marketing detour?
- If only one result could appear after upload, should it be a persona label or the saving the user can act on?
- Could Planner feel like progressively building a journey plan rather than operating a control room?
- What remains of the visual identity after every gradient orb, glass panel, pill, and emoji is removed?
- Is OysterSavings a dashboard users explore, or an adviser that confidently tells them what to buy?
