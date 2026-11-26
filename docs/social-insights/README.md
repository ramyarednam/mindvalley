# Social Insights redesign

Proposed replacement for the Social Insights section of Content Studio (`/performance/social`), by Ramya Rednam, 26 November 2026. Open `social-insights.html` in a browser, or use the live prototype: https://claude.ai/artifact/4bKGp7Mo7jTLU3nMFZLDQ5

## What it replaces

The current page shows every audience at once (Everyone, Glen's Home, Vidura's Home, an editor's Home, a shoot page, an agency) and ten tabs (Overview, Posts, What Works, Library, Leaderboard, Channels, Campaigns, Money, Agencies, More), followed by a long scroll of sections: Data freshness, Impressions, Revenue, What changed, What the numbers say, Best posts, Same post different place, Where credited sales came in, Lead flows, Views by account, How we'll know this works, What we can't tell yet, How we counted.

## The proposal

One question per tab, nothing else on the page.

| Tab | Question it answers | Source today |
|---|---|---|
| Overview | Which channels do we own, which are active, when did each last post, what did it bring in | Hootsuite (Perch), Composio, Metabase 32044 / 31846 |
| Posts | What went out on each channel, and how each post did against that channel's typical post | Hootsuite, Composio; typical = median at 72 h over 60 days |
| What works | Key learnings per channel, this week and this month; patterns proven on 20+ posts | Nightly comparison (insights), approved learnings |
| Library | Inspiration from competitors and viral ideas to try; not our posts | Weekly Monday scan (trends) |
| Leaderboard | Which channel does the most on impressions, engagement, leads, revenue | Platform counts; otag-credited orders and leads |
| Campaigns | Per campaign: posts out by format and channel, and what each did | Official Calendar + post tags |
| Revenue | Total social revenue, then Mindvalley vs Vishen, then by channel | Metabase 32044 (orders), 31846 (leads) |
| Agencies | Each agency on its platform's KPIs, with its best recent post | Per-platform APIs; links tagged _talkingheads, _simplex, _2cpr |

Removed: the "See it as" audience switcher (personal homes and shoots are not performance), the Channels tab (Overview and Posts already cover it), and the Money name (now Revenue). Everything that explained the data (freshness, how we counted, what we cannot tell yet) moves to an info icon on the tab it concerns.

## Rules the page follows

- One number per tile, with the change against the period before. No paragraphs under tiles.
- Platform counts are never added across platforms. Only revenue and leads total.
- Every chart has a scale and a comparison line. Dots are posts; the line is the typical post.
- Not connected is a grey card with a one-line reason and the owner, not a text block.
- Figures marked "example" are placeholders until the source is connected; everything else in the prototype is November 2026 data from Studio.

## Agency KPIs

- YouTube (Talking Heads): views, watch time, average view duration, impressions click-through, subscribers gained, leads and revenue on their links.
- Instagram and Facebook (Rise Voice): reach, views, saves and shares, profile visits, follows gained, Facebook reach, leads and revenue on their links.
- LinkedIn (Two Comma PR): impressions, engagement rate, followers gained, link clicks, newsletter subscribers, leads and revenue on their links.
