import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { readFile, writeFile } from "fs/promises";

dotenv.config();

const app = express();
app.use(cors());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* =========================================
   DATA SOURCES

   PRIMARY (results): openfootball/worldcup.json — a real, structured,
   community-maintained dataset (399 stars, active) with actual final
   scores for every completed match. No API key, no rate limit, no
   budget concerns. Updates roughly once a day. This is what actually
   answers "what was the score" reliably.

   SECONDARY (live status, optional): API-Football's /fixtures?live=all.
   Free tier, 100 req/day. Used ONLY to detect "is a match in progress
   right now" faster than openfootball's once-daily cadence — purely
   cosmetic LIVE/HT status, not relied on for final results. If you
   don't have an API-Football key, the app still works correctly; it
   just won't show a red LIVE badge until openfootball's next daily sync.

   matches.json is a LOCAL CACHE of openfootball's data, refreshed
   periodically and used as the schedule + results of record between
   refreshes. It is overwritten automatically — don't hand-edit it.
========================================= */

const API_KEY = process.env.API_FOOTBALL_KEY;
const API_FOOTBALL_BASE = "https://v3.football.api-sports.io";
const OPENFOOTBALL_URL =
  "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";

const MATCHES_FILE = path.join(__dirname, "matches.json");

const WORLD_CUP_LEAGUE_ID = 1; // API-Football's id for FIFA World Cup

// How often to re-pull openfootball's dataset. It updates roughly once
// a day, so checking every 30 min comfortably catches that without
// being wasteful (this source has no rate limit, but no need to hammer it).
const RESULTS_REFRESH_MS = 30 * 60 * 1000;

// How often to check API-Football for live status, IF a key is configured.
// 100 req/day budget -> roughly every 15 min stays safely within it.
const LIVE_STATUS_POLL_MS = 15 * 60 * 1000;

const GROUP_LETTER = {
  "Group A": "A", "Group B": "B", "Group C": "C", "Group D": "D",
  "Group E": "E", "Group F": "F", "Group G": "G", "Group H": "H",
  "Group I": "I", "Group J": "J", "Group K": "K", "Group L": "L",
};

const GROUND_MAP = {
  "Mexico City": ["Mexico City Stadium", "Mexico City", "Mexico"],
  "Guadalajara (Zapopan)": ["Guadalajara Stadium", "Guadalajara", "Mexico"],
  "Toronto": ["Toronto Stadium", "Toronto", "Canada"],
  "Vancouver": ["Vancouver Stadium", "Vancouver", "Canada"],
  "Los Angeles (Inglewood)": ["Los Angeles Stadium", "Inglewood", "USA"],
  "San Francisco Bay Area (Santa Clara)": ["San Francisco Bay Area Stadium", "Santa Clara", "USA"],
  "Seattle": ["Seattle Stadium", "Seattle", "USA"],
  "Houston": ["Houston Stadium", "Houston", "USA"],
  "Dallas (Arlington)": ["Dallas Stadium", "Arlington", "USA"],
  "Kansas City": ["Kansas City Stadium", "Kansas City", "USA"],
  "Atlanta": ["Atlanta Stadium", "Atlanta", "USA"],
  "Miami (Miami Gardens)": ["Miami Stadium", "Miami Gardens", "USA"],
  "New York/New Jersey (East Rutherford)": ["New York New Jersey Stadium", "East Rutherford", "USA"],
  "Philadelphia": ["Philadelphia Stadium", "Philadelphia", "USA"],
  "Boston (Foxborough)": ["Boston Stadium", "Foxborough", "USA"],
  "Monterrey (Guadalupe)": ["Monterrey Stadium", "Monterrey", "Mexico"],
};

/* =========================================
   IN-MEMORY CACHE
========================================= */

let cache = {
  matches: [],
  lastUpdated: null,
  lastError: null,
  liveCount: 0,
  resultsSource: null,
};

/* =========================================
   PARSE OPENFOOTBALL'S FORMAT
========================================= */

function parseTimeToUtc(dateStr, timeStr) {
  // timeStr like "13:00 UTC-6"
  const m = timeStr.match(/(\d{1,2}):(\d{2}) UTC([+-]\d+)/);
  if (!m) return `${dateStr}T00:00:00Z`;
  const [, hh, mm, offset] = m;
  const local = new Date(`${dateStr}T${hh.padStart(2, "0")}:${mm}:00`);
  // UTC = local time - offset (since local = UTC + offset)
  local.setUTCHours(local.getUTCHours() - Number(offset));
  return local.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function mapOpenFootballMatch(m, index) {
  const timeUTC = parseTimeToUtc(m.date, m.time);
  const isGroupStage = m.round.startsWith("Matchday");

  let score = { home: null, away: null };
  let status = "SCHEDULED";
  if (m.score && Array.isArray(m.score.ft)) {
    score = { home: m.score.ft[0], away: m.score.ft[1] };
    status = "FT";
  }

  const group = GROUP_LETTER[m.group] || "";
  const ground = m.ground || "";
  const [stadium, city, hostCountry] = GROUND_MAP[ground] || [ground, ground, ""];

  return {
    id: String(m.num || index + 1),
    stage: isGroupStage ? "Group Stage" : m.round,
    group,
    matchday: isGroupStage ? Number(m.round.match(/\d+/)?.[0]) : null,
    timeUTC,
    team1: m.team1,
    team2: m.team2,
    stadium,
    city,
    hostCountry,
    status,
    score,
  };
}

/* =========================================
   FETCH + CACHE: openfootball (primary results)
========================================= */

async function fetchOpenFootballSchedule() {
  try {
    const res = await fetch(OPENFOOTBALL_URL);
    if (!res.ok) {
      return { matches: null, error: `openfootball: HTTP ${res.status}` };
    }
    const data = await res.json();
    const matches = (data.matches || []).map(mapOpenFootballMatch);
    return { matches, error: null };
  } catch (err) {
    return { matches: null, error: `openfootball: ${err.message}` };
  }
}

async function refreshResults() {
  const { matches, error } = await fetchOpenFootballSchedule();

  if (error || !matches) {
    console.warn(`⚠️  openfootball refresh failed: ${error}`);
    if (cache.matches.length === 0) {
      // No cache yet at all -- try loading whatever's on disk as a fallback.
      await loadMatchesFromDisk();
    }
    cache.lastError = error;
    return;
  }

  cache.matches = matches;
  cache.lastUpdated = new Date().toISOString();
  cache.lastError = null;
  cache.resultsSource = "openfootball";

  const finishedCount = matches.filter((m) => m.status === "FT").length;
  console.log(
    `✅ openfootball refresh: ${matches.length} matches loaded, ${finishedCount} with confirmed final scores @ ${cache.lastUpdated}`
  );

  // Persist as a local cache/fallback for next startup, in case
  // openfootball is briefly unreachable.
  try {
    await writeFile(MATCHES_FILE, JSON.stringify(matches, null, 2), "utf-8");
  } catch (err) {
    console.warn(`⚠️  Could not write local matches.json cache: ${err.message}`);
  }
}

async function loadMatchesFromDisk() {
  try {
    const raw = await readFile(MATCHES_FILE, "utf-8");
    const matches = JSON.parse(raw);
    cache.matches = matches;
    cache.lastUpdated = new Date().toISOString();
    cache.resultsSource = "local-cache";
    console.log(`📅 Loaded ${matches.length} matches from local matches.json cache (openfootball unreachable).`);
  } catch (err) {
    console.error(`❌ No local matches.json cache available either: ${err.message}`);
  }
}

/* =========================================
   OPTIONAL: API-Football live status overlay
   Purely cosmetic LIVE/HT badges between openfootball's daily syncs.
   Disabled automatically if no API key is configured.
========================================= */

function normalizeApiFootballStatus(shortCode) {
  if (shortCode === "HT") return "HT";
  if (["1H", "2H", "ET", "BT", "P", "SUSP", "INT"].includes(shortCode)) return "LIVE";
  if (["FT", "AET", "PEN"].includes(shortCode)) return "FT";
  return null; // anything else: don't override
}

function normalizeTeamName(name) {
  return (name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function sameMatch(scheduleMatch, liveFixture) {
  const liveHome = normalizeTeamName(liveFixture.teams.home.name);
  const liveAway = normalizeTeamName(liveFixture.teams.away.name);
  const schedHome = normalizeTeamName(scheduleMatch.team1);
  const schedAway = normalizeTeamName(scheduleMatch.team2);

  const sameOrder = liveHome === schedHome && liveAway === schedAway;
  const swapped = liveHome === schedAway && liveAway === schedHome;
  if (!sameOrder && !swapped) return false;

  const schedDate = new Date(scheduleMatch.timeUTC).getTime();
  const liveDate = new Date(liveFixture.fixture.date).getTime();
  return Math.abs(schedDate - liveDate) < 24 * 60 * 60 * 1000;
}

async function pollLiveStatus() {
  if (!API_KEY) return; // feature disabled, no key configured

  try {
    const res = await fetch(`${API_FOOTBALL_BASE}/fixtures?live=all`, {
      headers: { "x-apisports-key": API_KEY },
    });
    if (!res.ok) {
      console.warn(`⚠️  Live status poll: HTTP ${res.status}`);
      return;
    }
    const data = await res.json();
    if (data.errors && Object.keys(data.errors).length > 0) {
      console.warn(`⚠️  Live status poll error: ${JSON.stringify(data.errors)}`);
      return;
    }

    const liveFixtures = (data.response || []).filter(
      (f) => f.league && f.league.id === WORLD_CUP_LEAGUE_ID
    );

    let liveCount = 0;
    for (const m of cache.matches) {
      if (m.status === "FT") continue; // never overwrite a confirmed final result
      const live = liveFixtures.find((f) => sameMatch(m, f));
      if (!live) continue;

      const normalized = normalizeApiFootballStatus(live.fixture.status.short);
      if (!normalized) continue;

      m.status = normalized;
      if (normalized !== "FT") {
        // Only borrow the live score while in progress; a real FT score
        // always comes from openfootball on the next sync, to keep one
        // consistent source of truth for final results.
        m.score = { home: live.goals.home, away: live.goals.away };
      }
      if (normalized === "LIVE" || normalized === "HT") liveCount++;
    }

    cache.liveCount = liveCount;
    if (liveCount > 0) {
      console.log(`🔴 Live status poll: ${liveCount} match(es) currently in progress.`);
    }
  } catch (err) {
    console.warn(`⚠️  Live status poll failed: ${err.message}`);
  }
}

/* =========================================
   STARTUP + SCHEDULING
========================================= */

async function start() {
  await refreshResults();
  setInterval(refreshResults, RESULTS_REFRESH_MS);

  if (API_KEY) {
    await pollLiveStatus();
    setInterval(pollLiveStatus, LIVE_STATUS_POLL_MS);
  } else {
    console.log(
      "ℹ️  No API_FOOTBALL_KEY configured — live LIVE/HT badges are disabled. " +
      "Results still update correctly from openfootball (roughly once a day)."
    );
  }
}

start();

/* =========================================
   API ROUTES
========================================= */

app.get("/api/matches", (req, res) => {
  res.json({
    data: cache.matches,
    count: cache.matches.length,
    lastUpdated: cache.lastUpdated,
    error: cache.lastError,
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: cache.lastError && cache.matches.length === 0 ? "degraded" : "ok",
    lastUpdated: cache.lastUpdated,
    matchCount: cache.matches.length,
    liveCount: cache.liveCount,
    resultsSource: cache.resultsSource,
    liveStatusEnabled: Boolean(API_KEY),
    lastError: cache.lastError,
  });
});

// Verification provision: confirms whether real final scores are
// actually present, independent of the rendered UI.
app.get("/api/debug/results", (req, res) => {
  const statusBreakdown = {};
  for (const m of cache.matches) {
    statusBreakdown[m.status] = (statusBreakdown[m.status] || 0) + 1;
  }

  const finishedWithScore = cache.matches.filter(
    (m) => m.status === "FT" && m.score.home !== null
  );
  const finishedWithoutScore = cache.matches.filter(
    (m) => m.status === "FT" && m.score.home === null
  );

  res.json({
    resultsSource: cache.resultsSource,
    lastUpdated: cache.lastUpdated,
    statusBreakdown,
    totalMatches: cache.matches.length,
    ftWithScoreCount: finishedWithScore.length,
    ftWithScoreSample: finishedWithScore.slice(0, 8).map(
      (m) => `${m.team1} ${m.score.home}-${m.score.away} ${m.team2}`
    ),
    ftWithoutScoreCount: finishedWithoutScore.length,
    ftWithoutScoreSample: finishedWithoutScore.slice(0, 8).map(
      (m) => `${m.team1} vs ${m.team2} (${m.timeUTC})`
    ),
  });
});

/* =========================================
   START SERVER
========================================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`⚽ FIFA Dashboard running: http://localhost:${PORT}`);
});
