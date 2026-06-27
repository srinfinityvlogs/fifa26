// Vercel serverless function — replaces server.js's Express route + background
// polling. Vercel runs this fresh per request (or from a short-lived cache),
// so there's no setInterval here — every call fetches openfootball directly.
// openfootball has no rate limit, so this is safe to call on every page load.

const OPENFOOTBALL_URL =
  "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";

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

function parseTimeToUtc(dateStr, timeStr) {
  const m = timeStr.match(/(\d{1,2}):(\d{2}) UTC([+-]\d+)/);
  if (!m) return `${dateStr}T00:00:00Z`;
  const [, hh, mm, offset] = m;
  const local = new Date(`${dateStr}T${hh.padStart(2, "0")}:${mm}:00`);
  local.setUTCHours(local.getUTCHours() - Number(offset));
  return local.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function parseGoals(goalsArray, benefitingTeam, otherTeam) {
  return (goalsArray || []).map((g) => ({
    name: g.name,
    minute: g.minute,
    // goals1/goals2 are keyed by which side the goal counts FOR. A normal
    // goal's scorer plays for that same side. An own goal's scorer plays
    // for the OTHER side, even though it counts for this side's score.
    team: g.owngoal ? otherTeam : benefitingTeam,
    ownGoal: Boolean(g.owngoal),
    penalty: Boolean(g.penalty),
  }));
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

  // goals1 = goals counted for team1's score; goals2 = goals counted for
  // team2's score. An own-goal entry in goals1 means a team2 player
  // scored into their own net, so team1's score benefits but the named
  // player is from team2 (and vice versa for goals2).
  const goalsHome = parseGoals(m.goals1, m.team1, m.team2);
  const goalsAway = parseGoals(m.goals2, m.team2, m.team1);

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
    goalsHome,
    goalsAway,
  };
}

export default async function handler(req, res) {
  try {
    const upstream = await fetch(OPENFOOTBALL_URL);

    if (!upstream.ok) {
      res.status(200).json({
        data: [],
        count: 0,
        lastUpdated: null,
        error: `openfootball: HTTP ${upstream.status}`,
      });
      return;
    }

    const raw = await upstream.json();
    const matches = (raw.matches || []).map(mapOpenFootballMatch);

    // Cache at Vercel's edge for 5 minutes so repeated page loads in that
    // window don't all hit GitHub directly — purely a performance nicety,
    // not a correctness requirement since openfootball has no rate limit.
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

    res.status(200).json({
      data: matches,
      count: matches.length,
      lastUpdated: new Date().toISOString(),
      error: null,
    });
  } catch (err) {
    res.status(200).json({
      data: [],
      count: 0,
      lastUpdated: null,
      error: `openfootball: ${err.message}`,
    });
  }
}
