# 30-30-30 Fibre Challenge: landing and thank-you pages

Static pages for the Extraordinary Minds × Alba Health fibre challenge
(Mon 16 Nov – Tue 15 Dec 2026, Day 31 re-measure on Wed 16 Dec).

| File | What it is |
| --- | --- |
| `index.html` | Landing page with the sign-up form (first name + email) |
| `thank-you.html` | Guide download, then 3 steps: add to calendar, join the group, watch the video |
| `assets/config.js` | **All links and settings.** Edit this before launch |
| `calendar/events.json` | Challenge dates and live calls (single source of truth) |
| `calendar/fibre-challenge.ics` | Generated calendar feed people subscribe to |
| `scripts/build_calendar.py` | Rebuilds the `.ics` from `events.json` |

Preview locally:

```bash
python3 -m http.server 8000 --directory fibre-challenge
```

Then open http://localhost:8000.

## Before launch (TODO)

1. `formAction` in `assets/config.js`: connect the form to the list (Braze/CRM).
   While it's empty, the form skips the network call and goes straight to the thank-you page.
2. `communityUrl`: the Finer Minds group invite link. The button stays greyed out until it's set.
3. `youtubeVideoId`: the Extraordinary Minds episode with Nora.
4. Host the folder on HTTPS. Calendar subscriptions (`webcal://`) need a public HTTPS URL.

## How the add-to-calendar works

The Google, Apple and Outlook buttons **subscribe** people to `calendar/fibre-challenge.ics`.
Because it's a subscription, anything you add later (Nora's live calls) shows up in their
calendar automatically. Google refreshes subscribed calendars every few hours, not instantly.

"Download .ics" and "Just add the dates once instead" are one-off copies, so they **won't**
pick up the live calls. Those people get the live-call links by email.

### Adding Nora's live calls

Add an entry to `calendar/events.json`, using a full time with its UTC offset:

```json
{
  "id": "live-call-1",
  "title": "Live call with Nora Cavani",
  "start": "2026-11-25T19:00:00+01:00",
  "durationMinutes": 60,
  "url": "https://zoom.us/j/...",
  "description": "Live teaching and Q&A for the 30-30-30 Fibre Challenge."
}
```

Then rebuild the feed and deploy:

```bash
python3 fibre-challenge/scripts/build_calendar.py
```

The thank-you page also reads `events.json` and lists the booked calls in each visitor's local time.
Keep each `id` stable once published; calendars use it to update an event rather than duplicate it.
