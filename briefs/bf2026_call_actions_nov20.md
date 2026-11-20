# Black Friday 2026 — actions from the call with Vishen, Marisha and Dan (20 Nov)

## Your action items

1. **Dan's attribution sheet, today.** Put every email under one "Email revenue" umbrella with sub-rows: broadcast, waitlist, lifecycle members, lifecycle leads, international. Give Dan your UTMs. Map is below.
2. **Same sheet: fix Sadaf's and Pavel's definitions.** Merge "non-members" and "leads" into one Leads group (members vs everyone else). Anything with no source goes to "Undefined", never to a lifecycle row. A Billing & Subscriptions purchase with no tag is organic app revenue, not lifecycle.
3. **Social breakdown for Dan.** Mindvalley socials and Vishen's brand as separate rows, channel by channel.
4. **Write all main-week emails today and tomorrow.** Review with Vishen and Marisha tomorrow at 10:30 MYT (booked). Schedule everything on Monday; sends start Tuesday.
5. **Use Vishen's new direction in every email** (section below): Omvana's three features, the "because why" reason for the discount, wellness only, super short emails to a good custom landing page.
6. **Segment emails with matching pages.** Manifesting Mastery buyers get the Lofty Questions feature. Social Media Mastery buyers get the Expert and Authority pathway. AI Mastery buyers get the Entrepreneurship pathway. The landing page leads with the same thing as the email.
7. **Churned members.** Test 60% vs Lifetime in the first email, then send the rest of the churned sequence on the winning offer.
8. **Cyber Monday.** Omvana at $49 on Monday and Tuesday for people who didn't buy Black Friday (Marisha's idea, you agreed).
9. **Page fixes Dan is making** (check them): the offer end date reads Sat Nov 28 at 11:59 PM PST; remove the "$17 a month" framing; lead with 60% off, 110+ programs and 1,000+ meditations; real student stories above the famous faces; give Trustpilot more weight.
10. **Three-year plan.** Remove it from Billing & Subscriptions so members see one offer; downsell it in-app only to people who don't take Lifetime.
11. **Organic push.** Check YouTube descriptions and pinned comments carry the Black Friday offer; update Vishen's brand pages and the podcast. You have a call with Glenn.
12. **Find out from Dan** what made the members' Lifetime page go from about 1% to 1.7% conversion yesterday.

## Vishen's direction for the emails

- **Wellness only.** Mindvalley is wellness, longevity, mindfulness. No AI, no entrepreneurship, no social media marketing in Mindvalley-branded copy. No Naveen Jain. Lead with Vishen, Jeffrey Allen, Regan Hillyer, Paul McKenna, Marie Diamond. (Mindvalley Academy separates in January.)
- **Because why.** Every discount gets a reason. For members, Marisha already uses tenure ("because you've been with us three years").
- **What's new in Mindvalley: Omvana.** Say Mindvalley has launched new features and the membership is more than it was. The three features:
  1. **Your own meditation.** Tell it how you want to feel and it builds a custom meditation, hypnotherapy or affirmation, using Mindvalley's own methods. It even designs the cover.
  2. **It remembers you.** It knows what you've done and what you need, and recommends from there.
  3. **Your own voice.** Record yourself and blend it with 250+ new soundscapes made with world-class musicians, to make your own affirmations or Lofty Questions.
- **Omvana is a bonus, not the lead** (Marisha). People are buying Membership. Lead with the offer, then one line: "As a bonus, Omvana is included" plus one feature. Don't describe the new Mindvalley app coming in December.
- **Super short.** Short email, good custom landing page. Marisha: direct-to-checkout has sometimes worked even better.
- **Before writing,** make one custom meditation in Omvana with a cover, and one Lofty Questions track in your own voice. Use the screenshots.
- **Retention.** Get the ~20,000 Black Friday buyers into Omvana after purchase, first action "create your own meditation". Vishen will send copy; check with Dario that Omvana recognises Mindvalley members.

## Email revenue map for Dan's sheet

One umbrella, "Email revenue", with these rows. Rules are the tag patterns to match, top to bottom; the first match wins so an order is counted once. Numbers are 1 to 20 Nov 2026, from order tags in the warehouse.

| Row | Owner | Tag rule (match on order tags) | Orders | Revenue |
| --- | --- | --- | --- | --- |
| Broadcast: BF waitlist reveal | Ramya | `email_campaign_mvm_confirmation_*`, `email_campaign_nmvm_confirmation_*` (+ `_german_`, `_spanish_`) | 8 | $6,992 |
| Broadcast: BF pre-release + Vishen newsletters | Ramya | `email_campaign_<list>_email1`, `email_campaign_<list>_vlnl_<date>`, `_email_vlnl_<date>`; lists mvm, daily, highlights, weekly, coach, chumvm, nmvm, mas, events | 119 | $39,868 |
| Broadcast: sales sublists | Ramya | `email_campaign_sublist*`, `email_campaign_vip_*` | 168 | $959,760 |
| Broadcast: other / old tags | Ramya | any other tag containing `email` not matched below | 60 | $44,579 |
| International (ES, DE, RU) | Christine | `bfcm_2026-es`, `bfcm_2026-de`, `_spanish_`, `_german_`, `_ru_`, `-es`, `-de` | 1,029 | $135,261 |
| Lifecycle members | Sadaf | `bfcm_2026_member`, `_inactive_member`, `_churned_member`, `_cancelled_member` | 63 | $53,937 |
| Lifecycle leads | Pavel | `bfcm_2026_leads`, `bfcm_2026_nonmember`, `bfcm_2026_nonmem`, `bfcm_2026_pathway_upgrade` | 99 | $19,101 |
| Lifecycle evergreen journeys | Sadaf | `email_journey_*`, winback, post-churn, abandon, birthday, `newss_var_*`, retargeting | 175 | $108,750 |

Not email, keep outside the umbrella:

| Row | Tag rule | Orders | Revenue |
| --- | --- | --- | --- |
| In-app | `inapp*` | 4 | $12,596 |
| WhatsApp | `*whatsapp*` | 1 | $8,516 |
| Undefined: Black Friday tag only | `bfcm_2026`, `launch_bfcm_nov_2026`, `bf26_*_lifetime`, `bf26_pp_*` with no channel tag | 2,315 | $414,413 |

Notes for Dan:
- **Waitlist reveal is Ramya's, even though it runs as a Braze journey.** It is the email people get when they join the waitlist from her Vishen emails. It belongs under broadcast, not Sadaf's lifecycle.
- **"Just want the 60%?" link.** Waitlist-page visitors who skip the waitlist and buy the 60% land under the waitlist page's own tag. Ask Faris which tag that link carries so it can be added to the pre-release row.
- **Sales sublists ($960k) are the early-November Academy launch sends,** not Black Friday. Keep them under email, but don't count them in Black Friday email revenue.
- **Billing & Subscriptions purchases carry no tag.** Member Lifetime sold that way falls into Undefined until the Braze click fallback Lia and Zubair agreed is built.
- **One order can carry several tags.** The table counts each order once, at the first row it matches.
