# Email Creator 2.0 — Product Requirements

**Product:** Content Studio › Create › Email Creator
**Owner:** Ramya Rednam
**Status:** Draft for build (v0.1, 27 Oct 2026)
**Companion:** interactive blueprint `email-creator-blueprint.html` (same folder)

---

## 1. Why

Today the Email Creator needs a person to open **New sequence**, pick a campaign, paste a promise, write "what do you want", and press **Start with Research**. Every sequence is hand-started, and the plan it proposes does not know what the Comms Calendar has already parked for that campaign.

Everything the system needs to start on its own already exists in two Airtable tables:

| Table | What it holds | What Email Creator needs from it |
|---|---|---|
| **Official Calendar** (`app9SSYzpUiFmc9QH / tblgbY2OofnOiJ7vs`) | One row per campaign: name, event type, start/end date, Key Message Doc, Launch Plan, $ Rev target, promotions start date, responsible | The trigger (Key Message Doc and/or Launch Plan filled), the brief links, the event type, the dates, the target |
| **Comms Calendar** (`app9YRZOVeE65fJPA / tblUUVMKdSrLVhTx8`) | One row per day: linked Official Cal campaign, Phase (Promotions / LIVE / Sales / Retention / Brand), No. of Emails, "📧 Emails" slot names with list codes, Initiative (No Email Day, Vishen's Newsletter) | Which days carry an email, which phase each day is, what else is going out that day |
| **Event Type** (lookup table behind Official Calendar) | Per event type: production type, campaign size, promotions duration, average revenue, rules ("4 Week Runway before Virtual Summits") | The sequence recipe and the default runway |

Email Creator 2.0 reads those tables, builds the sequences by itself, drafts every email into the Email Studio editor for review, schedules the approved emails, and reports against a baseline campaign. Humans review and approve. They no longer start, plan, or paste.

## 2. Goals

1. **Zero-touch start.** A campaign whose Official Calendar row has a Key Message Doc or Launch Plan filled appears in Email Creator within 15 minutes, with a proposed plan. No form.
2. **Plans that respect the Comms Calendar.** Every proposed email lands on a day the Comms Calendar has parked for that campaign, in the right phase, within each list's weekly cap.
3. **Every email is a Mindvalley email.** Drafts follow the Mindvalley email frameworks (one belief, slippery slide, one CTA, Bari's locked rules) and quote the Key Message Doc.
4. **Review in Email Studio.** Every draft opens in the HTML email editor the team already loves, with versions, AI quick edits, and a "talk to this email" thread.
5. **Baseline and target on day one.** Each campaign is planned against the best comparable past campaign (up to 5 years back) and a target of at least 30% above it, or the calendar's $ Rev target when one is set.
6. **UTM done once.** One link in, every email (and later every channel) gets a correct tracked link out. No hand-built UTMs.
7. **Four phases, four views.** Planning → Review & approval → Scheduled → Performance & tracking, as separate views inside Email Creator.

## 3. Non-goals (this release)

- Replacing Braze as the sending system. Email Creator schedules *into* Braze; it does not send.
- Writing social, push, SMS, or banner assets. The UTM engine is built so they can plug in later; the drafting is email only.
- Editing the Airtable calendars. Email Creator reads them. Changes to dates and slots stay in Airtable.
- Automatic approval. Nothing is scheduled without a named human approving the plan and each email.
- Multilingual drafting (ES/DE/etc.). English first; language is a field so it can follow.

## 4. Users

| Role | What they do in Email Creator |
|---|---|
| **Campaign owner** (e.g. Jaideep, Daniel, Gareth, Ramya) | Fills the Official Calendar. Reviews the proposed plan. Approves. Watches performance. |
| **Email writer / reviewer** | Opens drafts in Email Studio, edits, talks to the email, marks approved. |
| **Email ops** | Checks the Scheduled view, pushes to Braze, fixes pre-flight failures. |
| **Admin (Ramya)** | Edits recipes, cadence caps, list codes, UTM convention, baseline rules. |

## 5. The process, end to end

```
Official Calendar row gets Key Message Doc and/or Launch Plan
        │
        ▼
 ① WATCH   Calendar Watcher sees the change (poll every 5 min or Airtable webhook)
        │   → creates a Campaign in Email Creator, state = Detected
        ▼
 ② BRIEF   Brief Builder fetches every link in Key Message Doc + Launch Plan
        │   (Google Doc, GitHub Pages brief, Blinklife agenda, PDF) → one structured brief
        │   Event Type row → recipe, promotions duration, average revenue, rules
        ▼
 ③ RESEARCH  existing Content Studio research step runs on the brief (kept as is)
        ▼
 ④ BASELINE  Baseline Finder picks the best comparable past campaign from Metabase
        │   (same event type → same pathway/product → same list mix; 5y → 3y → 2y lookback)
        │   target = max(calendar $ Rev target, baseline revenue × 1.30)
        ▼
 ⑤ PLAN    Sequence Planner reads Comms Calendar slots for this campaign
        │   → places each sequence's emails on parked days, per list, within cadence caps
        │   → proposes segmentation from the Launch Plan
        │   → flags conflicts (No Email Day, overlapping campaigns, newsletter day)
        │   state = Plan proposed  ──► human approves plan ──► state = Drafting
        ▼
 ⑥ DRAFT   Drafting Engine writes every email (subject, preview, body HTML) with the
        │   Mindvalley email skill, quotes the brief, inserts UTM'd links
        │   → each draft is created in Email Studio as status "In review"
        ▼
 ⑦ REVIEW  Reviewer edits / talks to the email / approves in Email Studio
        │   state per email: In review → Approved
        ▼
 ⑧ SCHEDULE  Scheduler runs pre-flight (naming convention, UTM, list, send time, cadence)
        │   → creates Braze campaigns, status "Scheduled" → after send, "Sent"
        ▼
 ⑨ TRACK   Tracker pulls opens/clicks/conversions/revenue per email (Analyst OS + Metabase)
            → compares to baseline and target → feeds "Make more of this" learnings
```

## 6. Functional requirements

### 6.1 Sources & trigger (Calendar Watcher)

- **FR-1.1** Poll the Official Calendar every 5 minutes (or subscribe to an Airtable webhook). A row becomes a Campaign when `Status` is `Confirmed` or `Completed` is false and at least one of `Key Message Doc`, `Launch Plan` is non-empty.
- **FR-1.2** Read these fields: `Name of project`, `Unique Name`, `Status`, `Event type`, `Type`, `💿 Production Type`, `Start date`, `End Date`, `Promotions Start Date`, `Promotions Duration`, `$ Rev target`, `Key Message Doc`, `Launch Plan`, `Responsible`, `Notes`, `Ticket` (Free/Paid), `Medium`.
- **FR-1.3** Resolve the Event Type row for `Event type` and read `Campaign Type`, `Promotions Duration`, `Average revenue`, `Rules`, `Example URL`, `DNA URL`.
- **FR-1.4** Read every Comms Calendar row whose `📅 Official Cal` equals the campaign's `Name of project`. Keep `Date`, `Day`, `Phase`, `No. of Emails`, `📧 Emails`, `Internal Note`, `Initiative`, `🖌️ Feature Banner`, `🔔 Marketing Notifications`.
- **FR-1.5** Also read Comms Calendar rows on the same dates that are *not* this campaign (other campaigns, `✋ No Email Day`, `🎯 Vishen's Newsletter`) so the planner can see the load on each list.
- **FR-1.6** Re-sync on every poll. If dates, slots, or links change after a plan is approved, mark the plan `Needs re-plan` and show a diff. Never silently move an approved email.
- **FR-1.7** If `Key Message Doc` and `Launch Plan` are both empty, show the campaign in the Sources view as **Waiting for brief**, with the owner's name, so the gap is visible.

### 6.2 Brief Builder

- **FR-2.1** Extract every URL from `Key Message Doc` and `Launch Plan` (they are free-text cells that may hold several links, or prose such as "Challenge PDF"). Fetch Google Docs via the Drive API, GitHub Pages / Blinklife / other HTML via a fetcher, PDFs via text extraction.
- **FR-2.2** Produce one structured brief: promise, problem, mechanism, offer and price, dates, speakers, proof points, segmentation notes, claims that need compliance review. Store the source URL and a fetched-at timestamp per field.
- **FR-2.3** If a link cannot be fetched (permissions), show it as **Needs access** with a one-click "request access" note to the responsible owner. Planning may proceed with the rest.
- **FR-2.4** The existing **Research** step in Content Studio runs on this brief, unchanged. Its research pack attaches to the campaign.

### 6.3 Baseline Finder

- **FR-3.1** Candidate pool: past campaigns in Metabase (`l3_leads.dim_email_campaign` joined to `fact_email_engagement`, `bridge_email_revenue`, and `fact_braze_campaign_daily`), grouped by `campaign_product` and `campaign_sequence`, plus the Official Calendar's historical rows (`Actuals`, `$ Rev target`).
- **FR-3.2** Matching order: same `Event type` → same production type / pathway (e.g. AI, Manifesting, Coach) → same `Ticket` (free/paid) → same list mix. Score each candidate; show the top 3 with the score.
- **FR-3.3** Lookback: try 5 years. If fewer than 2 qualifying campaigns, widen to anything in 3 years; if still fewer than 2, 2 years. Always state which window was used.
- **FR-3.4** "Best" means highest revenue vs. its own target (ratio), tie-break on revenue per email sent.
- **FR-3.5** Target rule: `target = max(Official Calendar $ Rev target, baseline revenue × 1.30)`. When the two disagree, show both and let the owner pick; record the choice.
- **FR-3.6** Pull from the baseline campaign: email-by-email subject lines, send days relative to event, list mix, open/click/conversion rates, revenue per email. These become reference rows in the Planning view and few-shot examples for drafting.

### 6.4 Sequence Planner

- **FR-4.1** Choose the recipe for the event type (see §7.1). Recipes are config, editable by an admin, not code.
- **FR-4.2** Place emails only on dates the Comms Calendar has parked for this campaign, matching phase: Promotions → invite; LIVE → live/show-up; Sales → sales. If the recipe needs more emails than there are slots, show the shortfall and the days it would propose adding.
- **FR-4.3** Per-list weekly caps (config, defaults in §7.2). Count every email on every list across *all* campaigns that week, not just this one. When a cap would be exceeded, drop the lowest-priority email for that list and say which.
- **FR-4.4** Honor `✋ No Email Day` and `🎯 Vishen's Newsletter` days. If a LIVE or Sales day is also a No Email Day (it happens: 31 Oct and 1 Nov 2026 are both LIVE for AI for Founders and No Email Day), flag it as a conflict for the owner instead of guessing.
- **FR-4.5** Registrant-triggered sequences (confirmation, show-up, retargeting, sales retargeting) are not calendar slots; they are triggered flows with relative timing (e.g. T+0, T-1 day, T-1 hour). Plan them alongside, with their trigger and exit rules.
- **FR-4.6** Segmentation proposal: parse the Launch Plan for audience rules (spend thresholds, member vs non-member, past buyers, pathway interest). Propose segments and any test split (e.g. 50/50 VIP-free vs generic for $1,000+ spenders, customers and members held separately). Each segment gets its own variant of the affected emails.
- **FR-4.7** Every email in the plan has: sequence, number, working title, phase, date, send time (default per sequence, config), lists, segment, sender (Vishen vs team), goal (register / show up / buy), reference email from baseline, link target (LP / SP / other).
- **FR-4.8** The plan view is a calendar grid plus a sequence list. The owner can move an email to another parked day, remove it, change lists, change sender. Approving the plan starts drafting.

### 6.5 Drafting Engine

- **FR-5.1** For each planned email, generate subject line (3 options, one chosen), preview text, HTML body in the Email Studio template, plain-text version, and a one-line "why this email" note.
- **FR-5.2** Drafting context = brief + research pack + baseline reference email + the Mindvalley email skill (one belief, Julie's four stages, slippery slide, Halbert subject formulas, Bari's locked rules, 250–350 words pre-event, one CTA).
- **FR-5.3** Every link in the body is produced by the UTM engine (§6.8). No raw LP/SP URL is ever inserted.
- **FR-5.4** Each draft is written into Email Studio's store as a new email: launch = campaign, send date/time, list or segment, status `In review`, version 1 named "Email Creator draft".
- **FR-5.5** Pre-send checklist runs automatically on every draft and shows pass/fail per item in Email Studio (forbidden phrases, more than one CTA, word count, missing P.S., untracked link, claim without source).

### 6.6 Review & approval (Email Studio)

- **FR-6.1** Email Studio is the review surface. Keep everything it has: list, launch filter, send date in PT/ET/UK/MYT, status, versions with word diff, AI quick edits, export HTML, "someone else updated" notice.
- **FR-6.2** Add a **Talk to this email** panel: a thread per email where the reviewer types ("make the opening a scene at 11pm", "shorter", "swap the proof for the student story") and the engine proposes a new version. Each accepted suggestion is a saved version.
- **FR-6.3** Add **Approve** per email (status `Approved`, records who and when) and **Approve all in sequence**.
- **FR-6.4** Add the sequence context in the sidebar: where this email sits (Invite 4 of 9), the previous and next email's subject, so a reviewer sees the slide, not one slide.
- **FR-6.5** A reviewer can **request a rewrite** with a note; the email returns to `Draft` and the engine redrafts with the note.

### 6.7 Scheduled

- **FR-7.1** Table of every approved email: Braze campaign name (convention `YYYY-MM-DD <Campaign> - <Sequence> E<n> [<List>]`, which keeps `is_marketing_convention = true` in `dim_email_campaign`), send time in PT/ET/UK/MYT, list, segment, UTM'd primary link, status.
- **FR-7.2** Pre-flight checks before push: naming convention, send time not on a No Email Day, list cap not exceeded, all links tracked with the campaign's UTM set and otag, subject under 60 characters, unsubscribe footer present, segment exists in Braze.
- **FR-7.3** Push to Braze via API as scheduled campaigns; store the Braze campaign id on the email. Status `Scheduled`. After the send time, confirm via Braze and set `Sent`.
- **FR-7.4** Un-schedule / re-schedule from this view; both require a reason and write an audit line.

### 6.8 UTM engine

- **FR-8.1** One **Links** card per campaign: LP link, SP link, video/blog link, other link (the same four inputs the existing UTM sheet asks the launch manager for), plus a launch code (default: `<campaign-short>_<mon>_<yyyy>`, e.g. `aiffs_oct_2026`).
- **FR-8.2** Email convention (proposed, confirm with Ramya): `utm_source=email`, `utm_medium=<list code>` (daily, members, coach, events, weekly, highlights, vishen, sublist), `utm_campaign=<launch code>`, `utm_content=<sequence>_e<n>` (e.g. `invite_e04`), `utm_term=<segment or test arm>` when present. Add the `otags` parameter that `bridge_email_revenue` matches on.
- **FR-8.3** Every email's links are generated from the card at draft time and regenerated if the card changes (drafts in `In review` or earlier only; `Approved` and later show a warning and need re-approval).
- **FR-8.4** The same card generates the social set from the existing sheet's `utm_source` table (mv_fb, vl_ig_story, mv_yt_description, …) so the sheet can be retired later. Export as CSV in the sheet's layout.
- **FR-8.5** A link checker fetches each final URL once and confirms it resolves (200) with the parameters intact.

### 6.9 Performance & tracking

- **FR-9.1** Per campaign: registrations (or purchases) vs target pace, revenue vs target, and per email: sends, delivered, opens, clicks, conversions, unsubscribes, revenue, revenue per email. Sources: Analyst OS `open_rate_email`, `click_rate_email`, `conversion_rate_email`, `unsubscribe_rate_email` (table `fact_braze_campaign_daily`, refreshed daily 12:00 MYT) and Metabase `bridge_email_revenue` / "Campaign Efficiency Scorecard" (question 36338, already used by Content Studio).
- **FR-9.2** Side-by-side with the baseline campaign's email-by-email rows (same shape as Metabase "Baseline Campaign Performance" / "Current Campaign Performance").
- **FR-9.3** After each send's first 3 days, feed the existing **Make more of this** learnings card (already in Email Creator) with this campaign's winners.
- **FR-9.4** Write back to the Official Calendar `Actuals` only if the owner clicks "Write actuals" (explicit, not automatic).

## 7. Rules (config, admin-editable)

### 7.1 Sequence recipes by event type

| Event type (Official Calendar) | Recipe | Sender default |
|---|---|---|
| 🌐 Mastery Online Summit – Free / Paid / Hybrid | **Invite** on every Promotions slot (announce → story → proof → speakers → agenda → objection → 48h → last call) · **Confirmation** (T+0 after register) · **Retargeting** (clicked, not registered; T+2d) · **Show-up** (T-3d, T-1d, T-1h) · **Live** on each LIVE slot (day 1 live, day 1 recap + day 2 live, …) · **Sales** on each Sales slot until the Mastery class start · **Sales retargeting** (visited SP, no purchase; T+1d) | Invites: Vishen. Show-up/live: team. Sales: Vishen + team |
| 💻 Quest Release Webinar | Announce · reminder · we're live · last call / replay (3–4) | Author / team |
| 🚀 Quest Soft Release | 2 emails (announce, last day) | Team |
| 📺 Extraordinary Minds (Podcast) / 📧 Value Email | 1 email | Vishen |
| 💻 Academy / Accelerator / Cert Presentation / Guild / Lifebook / WildFit webinar | Announce · reminder · we're live · last call · replay (per Promotions Duration) | Host |
| 💻 Cert Online 1 Day Seminar | Invite (15-day runway) · show-up · live · sales to cert class start | Host |
| 🎓 Mindvalley U / 🎉 Festival / 🎫 Event Campaign | Ticket sales to Events list every other day for the promotion window | Team |
| 🛍️ Membership Major Sale (Black Friday) | Daily sales emails on each slot; last-48h, last-24h, final-hours | Team |
| 🏆 Mastery / 👟 Certification / ♾️ Guild class start | Terminal date for the preceding Sales sequence; onboarding emails after purchase | Team |

### 7.2 List cadence caps (per list, per ISO week, across all campaigns)

| List | Cap |
|---|---|
| Daily (Mindvalley daily) | 5 / week |
| Members | 3 / week |
| Coach | 3 / week |
| Events | 2–3 / week |
| Weekly | 1 / week |
| Highlights, Vishen's list, Sublist | to confirm |

### 7.3 Baseline & target

- Lookback 5 years → 3 years → 2 years (first window with ≥ 2 comparable campaigns).
- Best = highest revenue ÷ its own target; tie-break revenue per email.
- Target = max(calendar $ Rev target, baseline × 1.30).

### 7.4 Drafting guardrails (from the Mindvalley email skill)

One belief per sequence. One CTA per email. 250–350 words pre-event. Never "productivity", never fear of job loss, never jargon, never "pitch", never "We're excited to announce". "No replays. No recordings." from the 48-hour email onward for live events. "Invitation", not pitch. Subject line passes the text-a-friend test.

### 7.5 Comms Calendar constraints

`✋ No Email Day` blocks all lists. `🎯 Vishen's Newsletter` day counts 1 against Daily. A day with `Internal Note` containing "no email" is not a slot.

## 8. Data model

```
Campaign        id, airtable_record_id, name, unique_name, event_type, type, production_type,
                ticket, start_date, end_date, promo_start, promo_duration, rev_target, responsible,
                key_message_links[], launch_plan_links[], brief(json), research_pack_id,
                baseline_campaign_id, target_chosen, state
Slot            campaign_id, date, phase, no_of_emails, raw_emails_text, initiative, notes
Sequence        campaign_id, kind (invite|confirmation|retargeting|showup|live|sales|sales_retargeting),
                trigger (calendar|event), exit_rule
Email           sequence_id, n, title, date, send_time_pt, lists[], segment_id, sender, goal,
                reference_email_id, link_target, status (planned|draft|in_review|approved|
                scheduled|sent|measured), braze_campaign_id, braze_name, email_studio_id
Version         email_id, n, subject, preview, html, text, author (engine|user), note, created_at
Segment         campaign_id, name, rule(json), test_arm, braze_segment_id
LinkCard        campaign_id, lp, sp, video, other, launch_code, otag
TrackedLink     email_id, target, final_url, utm(json), checked_at, http_status
Baseline        campaign_id, candidate_campaign_ids[], scores[], window_used, revenue, target_ratio
Metric          email_id, date, sends, delivered, opens, clicks, conversions, unsubs, revenue
Approval        entity (plan|email), entity_id, user, at, note
```

## 9. Integrations

| System | Direction | How |
|---|---|---|
| Airtable Official Calendar, Comms Calendar, Event Type | read | REST API with a service token; poll 5 min or webhook |
| Google Drive / Docs | read | Drive API (brief docs) |
| GitHub Pages / Blinklife / other URLs | read | HTTP fetch + readability extraction |
| Metabase | read | SQL over `l3_leads.dim_email_campaign`, `fact_email_engagement`, `bridge_email_revenue`; saved questions 6197/36338 |
| Analyst OS | read | `query_metrics` for the email scope |
| Email Studio | read/write | shared store: emails, versions, statuses (same records Email Studio lists) |
| Braze | write/read | create scheduled campaigns, read send confirmation and ids |
| Content Studio Research | internal | existing step, unchanged |

## 10. States

Campaign: `Detected → Brief ready → Researched → Plan proposed → Plan approved → Drafting → In review → Approved → Scheduled → Live → Measured`. Side states: `Waiting for brief`, `Needs access`, `Needs re-plan`.

Email: `Planned → Draft → In review → Approved → Scheduled → Sent → Measured`, with `Rewrite requested` looping back to `Draft`.

## 11. Views inside Email Creator

1. **Sources** — campaigns detected from the calendars, what was read, what is missing.
2. **Planning** — brief, baseline, target, segmentation proposal, calendar grid of emails, sequence list, conflicts, approve plan.
3. **Review & approval** — Email Studio with sequence context, talk-to-email, approve.
4. **Scheduled** — pre-flight, Braze names, send times, push.
5. **Performance & tracking** — pace vs target, baseline vs current, learnings.
6. **Rules** (admin) — recipes, caps, list codes, UTM convention, baseline rules.

The current **Sequences** table and the **Make more of this** card stay on the Email Creator home.

## 12. Acceptance criteria

- AC-1: Fill the Key Message Doc on the AI for Founders Summit row in a test base → within 15 min a campaign appears in Sources with 15 slots read from the Comms Calendar (3 Oct Brand, 16–29 Oct Promotions, 30 Oct–1 Nov LIVE, 2 Nov Sales) and two conflicts flagged (31 Oct and 1 Nov are No Email Day).
- AC-2: The proposed plan has no list over its weekly cap when combined with Vishen's Newsletter (21 Oct, 28 Oct) and WildFit (6 Oct) on the Daily list.
- AC-3: Baseline for AI for Founders Summit resolves to an AI summit (AI Summit Mar 2026 / Jul 2025 / Jul 2024 / Jul 2023 candidates), states the 5-year window, and shows target = max($2.5M, baseline × 1.3) with both numbers visible.
- AC-4: Every drafted email exists in Email Studio with status In review, its links carry `utm_source=email`, `utm_campaign=aiffs_oct_2026`, `utm_content=<seq>_e<n>` and an otag, and the pre-send checklist shows per-item results.
- AC-5: Approving an email in Email Studio and pushing from Scheduled creates a Braze campaign whose name starts with `YYYY-MM-DD` and returns an id stored on the email.
- AC-6: Performance view shows per-email metrics from Analyst OS within one day of send and a side-by-side with the baseline's email rows.
- AC-7: Changing a slot date in the Comms Calendar after plan approval sets `Needs re-plan` and shows the diff; no scheduled email moves on its own.

## 13. Milestones

| # | Scope | Done when |
|---|---|---|
| M1 Sources | Watcher + Brief Builder + Sources view | AC-1 |
| M2 Planning | Baseline Finder + Planner + Planning view + recipes/caps config | AC-2, AC-3, AC-7 |
| M3 Drafting + Review | Drafting Engine + Email Studio integration (talk-to-email, approve) + UTM engine | AC-4 |
| M4 Scheduled | Pre-flight + Braze push | AC-5 |
| M5 Tracking | Metrics + baseline comparison + learnings feed | AC-6 |
| M6 Segmentation tests | Launch-plan parsing, test arms, Braze segments | VIP 50/50 test runs end to end |

## 14. Risks

- **Brief links behind permissions** (Google Docs not shared with the service account). Mitigation: Needs access state, owner nudge.
- **Comms Calendar free text** ("📧 Emails" cells mix names and list codes in inconsistent JSON-ish strings). Mitigation: parse best-effort, always show the raw cell, never depend on it for placement; placement uses Date + Phase + No. of Emails.
- **Two campaigns share a name** across years (the UI already warns "Six pairs of campaigns share a name; pick by date"). Key on Airtable record id, never on name.
- **Baseline mismatch** (AI for Founders is not AI Summit). Mitigation: show top 3 candidates with scores; owner can override.
- **Braze naming drift** breaking `is_marketing_convention`. Mitigation: pre-flight check is blocking.

## 15. Open questions for Ramya

1. In the Comms Calendar "📧 Emails" cell, what do the numbers in `"1,2: Daily", 3: Members, 5: Coach` mean: list ids, send batches, or time slots?
2. Default send times per sequence and per list (the Black Friday row shows 11:00 NY; a live email shows 7:45 AM PST). Is there one default per list?
3. Which Braze lists/segments map to the list codes Daily, Members, Coach, Events, Weekly, Highlights, Vishen's List, Sublist, Members Pro?
4. Caps for Highlights, Vishen's list, Sublist, Members Pro?
5. UTM: confirm `utm_source=email` and `utm_medium=<list>`, or do you want `utm_source=<list>` to mirror the social sheet (`mv_fb`, `vl_ig_story`)? What is the otag format Braze links carry today?
6. When the calendar's `$ Rev target` is lower than baseline × 1.3 (AI for Founders: $2.5M vs AI Summit Mar 2026's $4.26M × 1.3 = $5.5M), which one is the system's target?
7. Should the system also propose slots when the Comms Calendar has fewer than the recipe needs, or only ever use parked days?
8. Who approves a plan: the `Responsible` person on the Official Calendar row, or you for every campaign?
9. For registrant-triggered flows (confirmation, show-up, retargeting), does Braze already own the triggers, so Email Creator only supplies the copy and timing?
10. Sales retargeting needs a "visited sales page, did not buy" audience. Is that event available in Braze today?
11. Languages: English only for v1?
12. Is the Email Studio artifact's store (its `db` capability) the system of record for drafts, or should Email Creator own drafts and Email Studio read them?
