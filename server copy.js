import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

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
   THE SPORTSDB CONFIG
   4429 = FIFA World Cup (4328 was EPL — wrong comp)
========================================= */

const LEAGUE_ID = "4429"; // FIFA World Cup
const BASE_URL = "https://www.thesportsdb.com/api/v1/json/3";

// How often the SERVER refreshes from TheSportsDB.
// Clients poll OUR /api/matches endpoint, which just reads this cache —
// so N users polling every 30s does NOT mean N calls to TheSportsDB.
const REFRESH_INTERVAL_MS = 30 * 1000;

/* =========================================
   IN-MEMORY CACHE
========================================= */

let cache = {
  matches: [],
  lastUpdated: null,
  lastError: null,
};

/* =========================================
   STATUS NORMALIZATION
   TheSportsDB uses inconsistent strStatus values
   across endpoints, so we match defensively.
========================================= */

function normalizeStatus(event) {
  const status = (event.strStatus || "").trim();
  const statusLower = status.toLowerCase();

  if (statusLower === "match finished" || statusLower === "ft" || statusLower === "finished") {
    return "FT";
  }

  if (statusLower === "ht" || statusLower === "halftime" || statusLower === "half time") {
    return "HT";
  }

  // Live matches report a clock value (e.g. "45", "2H") or explicit "Live"
  if (statusLower === "live" || statusLower === "in play" || /^\d+['+]?$/.test(status)) {
    return "LIVE";
  }

  if (statusLower === "not started" || statusLower === "ns" || status === "") {
    return "SCHEDULED";
  }

  if (statusLower === "postponed") return "POSTPONED";
  if (statusLower === "cancelled" || statusLower === "canceled") return "CANCELLED";

  return "SCHEDULED";
}

/* =========================================
   SHAPE MAPPER
   Converts a raw TheSportsDB event into the
   shape script.js already expects.
========================================= */

function mapEvent(m) {
  return {
    id: m.idEvent,
    timeUTC: m.strTimestamp || `${m.dateEvent}T${m.strTime || "00:00:00"}Z`,
    status: normalizeStatus(m),
    stage: m.strRound || "World Cup Match",
    group: "",
    stadium: m.strVenue || "",
    city: m.strCity || "",
    team1: m.strHomeTeam,
    team2: m.strAwayTeam,
    score: {
      home: m.intHomeScore !== null && m.intHomeScore !== undefined ? Number(m.intHomeScore) : null,
      away: m.intAwayScore !== null && m.intAwayScore !== undefined ? Number(m.intAwayScore) : null,
    },
  };
}

/* =========================================
   FETCH HELPERS
   Each endpoint can fail/return empty independently —
   we never let one bad endpoint take down the whole feed.
========================================= */

async function safeFetchJson(url, label) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const msg = `${label}: HTTP ${response.status}`;
      console.warn(msg);
      return { events: [], error: msg };
    }
    const data = await response.json();
    return { events: data.events || [], error: null };
  } catch (err) {
    const msg = `${label}: ${err.message}`;
    console.warn(msg);
    return { events: [], error: msg };
  }
}

async function fetchAllEvents() {
  const [pastResult, nextResult, liveResult] = await Promise.all([
    safeFetchJson(`${BASE_URL}/eventspastleague.php?id=${LEAGUE_ID}`, "past"),
    safeFetchJson(`${BASE_URL}/eventsnextleague.php?id=${LEAGUE_ID}`, "next"),
    // Live scores: TheSportsDB scopes this by sport, not league,
    // so we filter down to World Cup events afterward.
    safeFetchJson(`${BASE_URL}/livescore.php?l=Soccer`, "live"),
  ]);

  const errors = [pastResult.error, nextResult.error, liveResult.error].filter(Boolean);

  const liveForThisLeague = liveResult.events.filter(
    (e) => String(e.idLeague) === LEAGUE_ID
  );

  // Merge by idEvent — live data (if present) should win over
  // the past/next snapshot since it's the freshest.
  const merged = new Map();

  for (const e of [...pastResult.events, ...nextResult.events]) {
    merged.set(e.idEvent, e);
  }
  for (const e of liveForThisLeague) {
    merged.set(e.idEvent, { ...merged.get(e.idEvent), ...e });
  }

  return {
    matches: Array.from(merged.values()).map(mapEvent),
    errors,
  };
}

/* =========================================
   REFRESH LOOP
   Server polls the upstream API on its own
   schedule. Requests from clients never
   trigger an upstream call directly.
========================================= */

async function refreshCache() {
  try {
    const { matches, errors } = await fetchAllEvents();

    // Sort chronologically so the frontend doesn't have to.
    matches.sort((a, b) => new Date(a.timeUTC) - new Date(b.timeUTC));

    cache = {
      matches,
      lastUpdated: new Date().toISOString(),
      // Surfaced even on a "successful" cycle — e.g. if "live" failed
      // but "past"/"next" succeeded, you still want to know live is down.
      lastError: errors.length > 0 ? errors.join(" | ") : null,
    };

    console.log(`✅ Cache refreshed: ${matches.length} matches @ ${cache.lastUpdated}`);
    if (errors.length > 0) {
      console.warn(`⚠️  Partial failures this cycle: ${errors.join(" | ")}`);
    }
  } catch (err) {
    cache.lastError = err.message;
    console.error("❌ Cache refresh failed:", err.message);
  }
}

// Initial load, then refresh on interval.
refreshCache();
setInterval(refreshCache, REFRESH_INTERVAL_MS);

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

// Lightweight health/debug endpoint — handy while wiring this up.
app.get("/api/health", (req, res) => {
  res.json({
    status: cache.lastError ? "degraded" : "ok",
    lastUpdated: cache.lastUpdated,
    matchCount: cache.matches.length,
    lastError: cache.lastError,
  });
});

/* =========================================
   START SERVER
========================================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`⚽ FIFA Dashboard running: http://localhost:${PORT}`);
});
