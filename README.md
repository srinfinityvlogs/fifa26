# FIFA World Cup 2026 Live Dashboard (IST)

A web app showing FIFA World Cup 2026 schedule and results, with real final
scores, timezone conversion, and optional live in-progress badges.

## How it gets its data

**Results & schedule (always on, no setup required):** pulled from
[openfootball/worldcup.json](https://github.com/openfootball/worldcup.json),
a free, structured, actively-maintained dataset with real final scores for
every completed match — no API key, no rate limit. The server refreshes
this every 30 minutes and caches it to `matches.json` as a local fallback.

**Live "LIVE"/"HT" badges (optional):** if you set `API_FOOTBALL_KEY` in
`.env`, the server also polls API-Football's `/fixtures?live=all` every
15 minutes to show a match as LIVE while it's actually in progress —
openfootball only updates once a day, so without this, a match in
progress will just show as SCHEDULED until the next daily sync. **Final
scores always come from openfootball**, regardless of whether this is
enabled — this is purely a faster status badge, not a results source.

Without an API-Football key, the app still works correctly and shows
accurate results; you just won't see the red LIVE badge in real time.

## Verifying results are working

```
http://localhost:3000/api/debug/results
```

Shows the real status breakdown and a sample of confirmed scores, e.g.:
```json
{
  "resultsSource": "openfootball",
  "statusBreakdown": { "FT": 66, "SCHEDULED": 38 },
  "ftWithScoreSample": ["Mexico 2-0 South Africa", "..."]
}
```

`http://localhost:3000/api/health` shows overall status, last update time,
and whether live-status polling is enabled.

## Running locally vs. on Vercel

**Locally:** `server.js` runs as a normal Express app (`npm start` →
`http://localhost:3000`), with background refresh and optional
API-Football live badges.

**On Vercel:** serverless functions in `api/matches.js` and `api/health.js`
fetch fresh from openfootball on every request instead of background
polling (Vercel doesn't keep a process running between requests). The
frontend (`public/`) is unchanged — it calls `/api/matches` either way.
`server.js` and `matches.json` aren't used by the Vercel deployment at all
(see `.vercelignore`); they're for local development only.

## Getting Started

```bash
npm install
cp .env.example .env   # optional: add API_FOOTBALL_KEY if you want live badges
npm start
```

Open `http://localhost:3000`.

## Project Structure

```
fifa26/
├── server.js            # Fetches openfootball data, optional API-Football live overlay
├── matches.json          # Local cache of the last successful openfootball fetch
├── .env.example
├── public/
│   ├── index.html
│   ├── styles.css
│   └── script.js
└── README.md
```

## Match Data Shape

```json
{
  "id": "1",
  "stage": "Group Stage",
  "group": "A",
  "matchday": 1,
  "timeUTC": "2026-06-11T19:00:00Z",
  "team1": "Mexico",
  "team2": "South Africa",
  "stadium": "Mexico City Stadium",
  "city": "Mexico City",
  "status": "FT",
  "score": { "home": 2, "away": 0 }
}
```

- **status**: `SCHEDULED`, `LIVE`, `HT`, or `FT`
- **score.home / score.away**: `null` until the match has a confirmed result

## Known Limitations

- **openfootball updates roughly once a day**, not in real time. Without
  an API-Football key for the optional live overlay, a match that's
  currently being played will show as SCHEDULED until the next sync
  (usually catches up within 24 hours).
- The full bracket (Round of 32 onward) shows placeholder team codes
  (e.g. "2A", "W74") until those slots are actually decided — this
  matches the real tournament structure, not a bug.
- If openfootball is briefly unreachable, the server falls back to the
  last successfully cached `matches.json` rather than showing nothing.

## License

MIT License.
