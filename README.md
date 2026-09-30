# Pre-Watch

Pre-release audience attention testing for long-form video, modelled on the PreWatch tool The Diary of a CEO uses.
A panel watches an uncut episode in the browser. Their webcam measures whether they are looking at the screen, and
they press the spacebar when something is interesting. Editors get a per-second attention curve, the top peaks and
drop-offs, audience splits and markers they can import into Premiere Pro or DaVinci Resolve.

The product spec is the PRD doc: https://claude.ai/code/artifact/518ddc60-8d84-4429-967f-7431948328a3

## Run it

Requires Node.js 22.18 or newer (it runs TypeScript directly and uses the built-in SQLite). No runtime dependencies.

```bash
npm install          # dev tools only (TypeScript for type checking)
STUDIO_PASSWORD=change-me npm start
```

- Studio: http://localhost:3000/studio/ (password from `STUDIO_PASSWORD`, default `prewatch`)
- Panel link for a test: `http://localhost:3000/watch/<testId>?pid=<participant id>`

To let panelists reach it, deploy behind HTTPS (webcam access requires HTTPS on any host except localhost).

## Put it online

**Try it in GitHub Codespaces (quickest, uses your GitHub account)**

1. Open https://codespaces.new/ramyarednam/mindvalley?ref=claude/bold-carson-foqch2 and click **Create codespace**.
2. Wait for setup; the server starts by itself and the **Ports** tab shows port 3000 ("Pre-Watch").
   Open its address (`https://<name>-3000.app.github.dev`) and add `/studio/`. Password: `prewatch`.
3. The address is private to your GitHub login by default. To let panelists in, right-click the port →
   **Port visibility → Public**, and first set a real password: stop the server (Ctrl+C in the terminal) and run
   `STUDIO_PASSWORD=your-password npm start`.

A codespace stops when idle and its data is tied to that codespace, so use it for demos and small pilots.

**Permanent deploy on Render**

1. In Render: **New → Blueprint**, connect GitHub, pick this repo and the branch `claude/bold-carson-foqch2`.
2. Render reads `render.yaml`: a Node web service with a 1 GB disk for the database (Starter plan, needed for the
   disk) and a generated `STUDIO_PASSWORD`, which you can read under the service's **Environment** tab.
3. The service gets an `https://prewatch-….onrender.com` address; the studio is at `/studio/`.

**Any Docker host** (Fly.io, Railway, Cloud Run, a VM): the `Dockerfile` runs the server on port 3000 and keeps
data in `/data`; mount a volume there and set `STUDIO_PASSWORD`.

## Workflow

1. **New test** in the studio. Paste a Dropbox Replay share link (for example
   `https://replay.dropbox.com/share/qxsXZ0hahSv4hgSx`). The title, length, resolution and frame rate are read
   automatically. Direct `.m3u8` or `.mp4` links also work if you enter the duration. Add up to 4 cuts for an A/B test;
   viewers are split evenly.
2. Set the panel size, quotas, attention checks, an optional chapter range, survey questions and an optional SRT/VTT
   transcript.
3. Set the test to **Live** and send the panel link to your vendor (Prolific, Cint, etc.) or community. Use the
   completion redirect with `{code}` and `{pid}` to hand viewers back to the vendor.
4. Viewers: consent, a few audience questions, camera check, 9-dot calibration, then the locked player
   (no seeking, no speed change). Spacebar = interesting, B = boring, A = answer an attention check. Survey at the end.
5. **Report**: attention curve with 95% band, rolling baseline, still-watching line, interest lane, drop-off bands,
   ranked peaks and drop-offs with transcript text, audience overlays, survey results and panel quality.
   Click the chart to jump the player; drag to zoom.
6. **Export** markers: Premiere Pro (FCP7 XML), DaVinci Resolve (EDL with coloured markers) or CSV.

Use **Add synthetic viewers** on a test to see a full report before real viewers arrive. Synthetic rows are labelled
and can be deleted; `npm run simulate -- <testId> 500` does the same from the command line.

## How it works

| Part | Where | Notes |
| --- | --- | --- |
| Gaze tracking | `public/watch/tracker.js` | MediaPipe Face Landmarker runs in the browser. Head pose and iris position are compared with the calibrated envelope. Frames never leave the device. |
| Viewer app | `public/watch/` | 4 samples a second `[time, face, attentive, tabVisible]`, events for key presses and pauses; uploaded every 10 s with retry. |
| Video | `src/hlsProxy.ts`, `src/sources/` | Replay links resolve to Dropbox's HLS playlist. The server proxies it so panelists never see the source URL; every segment URL is HMAC-signed and tied to that viewer's expiring token. |
| Storage | `src/db.ts` | SQLite. Samples are stored as per-second totals per viewer. |
| Quality | `src/quality.ts` | Excludes failed calibration, under 70% watched, face visible under 50%, failed attention checks, key mashing. |
| Scoring | `src/scoring.ts` | Attention = share of valid viewers looking at the screen each second. Interest = presses per 100 viewers in a 5 s window. Drop-off = 20 s or more at least 10 points under a 5-minute rolling baseline. Peak = top 5% of interest. |
| Exports | `src/exports.ts` | CSV, CMX3600 EDL with Resolve marker colours, FCP7 XML for Premiere. |

### Dropbox Replay

Replay has no public API for resolving a share link. The server makes the same request the Replay web player makes for
an anonymous viewer, using the public web-client key that Replay ships in its JavaScript bundle. The key is discovered
at runtime, so nothing is committed. To pin it, set `DROPBOX_REPLAY_CLIENT_AUTH="id:secret"`. If Dropbox changes
its web app, this resolver is the part that may need updating; direct HLS/MP4 links keep working.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` / `HOST` | `3000` / `0.0.0.0` | Listen address |
| `STUDIO_PASSWORD` | `prewatch` | Studio sign-in; change it before sharing the server |
| `PREWATCH_DATA_DIR` | `./data` | SQLite database and signing secret |
| `PREWATCH_SECRET` | random, saved in the data dir | HMAC key for sessions and stream URLs |
| `MIN_SEGMENT_VIEWERS` | `50` | Audience splits with fewer valid viewers are hidden |
| `STREAM_TOKEN_TTL_SEC` | `21600` | Lifetime of a viewer's stream link |
| `ALLOWED_MEDIA_HOSTS` | Dropbox preview hosts | Hosts the video proxy may fetch from |

## Development

```bash
npm test         # unit + API integration tests (Dropbox is mocked)
npm run typecheck
npm run dev      # restart on file changes
```

## Not built yet

These PRD items are not in this version: automatic speech-to-text (upload an SRT/VTT instead), LLM summaries of
open-text answers, transcript-aligned cut comparison (cuts are compared side by side in the report), paid thumbnail
and title testing (V2), panel-vendor API integration and payouts (use the completion redirect), SSO (single studio
password for now), and automatic deletion of raw signal data after 90 days.
