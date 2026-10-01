# Pre-Watch

Pre-release screening for long-form video, modelled on the PreWatch tool The Diary of a CEO uses. A panel watches an
uncut episode in the browser while their webcam measures, on their own device, whether they are looking at the
screen. They press the spacebar when something grabs them, can stop and come back later, and finish with a short,
fun questionnaire. The team gets second-by-second attention, the moments and transcript lines viewers loved, what
they'd cut, the titles they'd click, and a written summary.

The product spec is the PRD doc: https://claude.ai/code/artifact/518ddc60-8d84-4429-967f-7431948328a3

## Who does what

| | Admin | Member (editors, marketers) |
| --- | --- | --- |
| See every screening, its summary, attention, feedback, hooks, audience and responses | Yes | Yes |
| Export markers to Premiere Pro / DaVinci Resolve / CSV | Yes | Yes |
| Write an AI summary with Claude | Yes | Yes |
| Create screenings, go live, edit, upload transcripts, add synthetic viewers, delete | Yes | No |
| Add people, change roles, reset passwords | Yes | No |
| See panel vendor IDs | Yes | No |

## The viewer's journey

1. **Welcome**: what is measured (and that no video of them is recorded), the length, consent.
2. **About you**: age, gender, country, member or not (used for quotas and audience splits).
3. **Camera check** and a 15-second, 9-dot calibration.
4. **Watch**: locked player (no skipping, no speed change). Spacebar = interesting, B = boring, A = answer the
   occasional attention check.
5. **Save & finish later**: one click pauses, saves their spot and gives them a personal link (copy or email it to
   themselves). The same browser also remembers them. They have 7 days.
6. **Feedback**, one question per screen, autosaved, and can also be finished later on any device:
   how it made them feel, topic relevance, did they like it, notes on the moments they marked, the transcript lines
   that stood out and why, a one-sentence pitch, a title they'd click, what they'd cut, would they recommend it,
   plus up to 5 questions of your own.
7. **Done**: a thank-you with confetti and a completion code for panel vendors.

## The team app

- **Dashboard**: every screening as a card with its poster, live status, attention, liked share and responses.
- **Summary**: a verdict, six headline numbers, key findings, what worked, what to fix, and hook candidates.
  Rule-based by default; **Write AI summary** asks Claude (model `claude-opus-5-5`) to write it from the data when
  `ANTHROPIC_API_KEY` is set. If Claude is unavailable, the automatic summary stays.
- **Attention**: the episode player synced to the attention curve, peaks, drop-offs and marker exports.
- **Feedback**: rating distributions and every answer, grouped by question.
- **Hooks & packaging**: transcript lines ranked by how many viewers picked them, title and thumbnail ideas,
  viewers' own titles and one-liners, and the words they use.
- **Audience**: attention, liking and relevance by age, gender, country and member status.
- **Responses**: every viewer, filterable, with their full answers in a side panel.
- **Manage** (admins): status, panel link, details, transcript upload, extra questions, synthetic viewers, delete.

## Run it

Requires Node.js 22.18 or newer.

```bash
npm install
npm start
```

Open http://localhost:3000/app/. On first run the server log prints a **setup code**; enter it to create the
first admin account. (Or set `ADMIN_EMAIL` and `ADMIN_PASSWORD` and the admin is created automatically.)
Add teammates under **Team**; each gets a temporary password to share with them.

Panel link for a screening: `https://<your-host>/watch/<testId>?pid=<participant id>`. Viewers need HTTPS for the
webcam on any host except localhost.

## Put it online

**GitHub Codespaces** (quickest): open
https://codespaces.new/ramyarednam/mindvalley?ref=claude/bold-carson-foqch2, wait for the server to start, open
the forwarded port 3000 address and add `/app/`. The setup code is in the terminal. Make the port public
(Ports tab → right-click → Port visibility → Public) before sending the panel link to viewers.

**Render** (permanent): New → Blueprint → this repo and branch. `render.yaml` sets up a Node service with a disk
for the database and asks for `ADMIN_EMAIL`, `ADMIN_PASSWORD` and, optionally, `ANTHROPIC_API_KEY`.

**Any Docker host**: the `Dockerfile` serves port 3000 and keeps data in `/data`.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` / `HOST` | `3000` / `0.0.0.0` | Listen address |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | unset | Create the first admin on start-up instead of using the setup code |
| `SETUP_CODE` | random, printed in the log | One-time code for creating the first admin in the browser |
| `ANTHROPIC_API_KEY` | unset | Enables AI summaries |
| `SUMMARY_MODEL` | `claude-opus-5-5` | Model for AI summaries |
| `PREWATCH_DATA_DIR` | `./data` | Database, posters, signing secret |
| `PREWATCH_SECRET` | random, saved in the data dir | Signs sessions and stream links |
| `MIN_SEGMENT_VIEWERS` | `50` | Smaller audience groups are left off charts |
| `STREAM_TOKEN_TTL_SEC` | `21600` | Lifetime of a viewer's stream link |
| `ALLOWED_MEDIA_HOSTS` | Dropbox preview hosts | Hosts the video and poster proxy may fetch from |

## How it works

| Part | Where | Notes |
| --- | --- | --- |
| Gaze tracking | `public/watch/tracker.js` | MediaPipe Face Landmarker in the browser compares head pose and iris position with the calibration. Frames never leave the device. |
| Viewer app | `public/watch/` | 4 samples a second plus key presses, uploaded every 10 s; resume link; autosaved questionnaire. |
| Video | `src/hlsProxy.ts`, `src/sources/` | Replay links resolve to Dropbox's HLS stream, proxied with per-viewer signed links so viewers never see the source. |
| Accounts | `src/auth.ts`, `src/routes/auth.ts` | scrypt-hashed passwords, signed session cookie, login rate limiting. |
| Scoring | `src/scoring.ts`, `src/quality.ts` | Attention per second, interest, drop-offs and peaks; low-quality sessions are excluded. |
| Feedback | `src/feedback.ts`, `src/summary.ts` | Validation, aggregation, rule-based and Claude summaries. |
| Storage | `src/db.ts` | SQLite with in-place migrations. |

The Dropbox Replay resolver makes the same request Replay's web player makes for an anonymous viewer, with the
public web-client key it discovers in Replay's JavaScript (override with `DROPBOX_REPLAY_CLIENT_AUTH`). If Dropbox
changes its web app, that resolver may need updating; direct HLS/MP4 links keep working.

## Development

```bash
npm test           # unit + API tests (Dropbox and Claude are mocked)
npm run typecheck
npm run dev        # restart on changes
npm run simulate -- <testId> 300
```

## Not built yet

Automatic speech-to-text (upload an SRT/VTT; Premiere, Descript and YouTube export these), email delivery of resume
links and invites (copy and share them for now), SSO, paid thumbnail/title testing, panel-vendor payouts, and
automatic deletion of raw signals after 90 days.
