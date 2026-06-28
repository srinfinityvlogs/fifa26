const tabMatches =
  document.getElementById("tabMatches");

const groupsContainer =
  document.getElementById("groupsContainer");

const eliminatorContainer =
  document.getElementById("eliminatorContainer");

const tabEmptyState =
  document.getElementById("tabEmptyState");

const tabButtons =
  document.querySelectorAll(".tab-button");

const searchInput =
  document.getElementById("searchInput");

const timezoneSelect =
  document.getElementById("timezoneSelect");

let allMatches = [];
let filteredMatches = [];
let activeTab = "today";

let selectedTimezone =
  Intl.DateTimeFormat().resolvedOptions().timeZone;

/* =========================================
   FAVORITES (persisted locally, per-browser)
========================================= */

const FAVORITES_KEY = "fifa26_favorites";

function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set(); // corrupted/blocked storage shouldn't crash the app
  }
}

function saveFavorites(favoritesSet) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favoritesSet]));
  } catch {
    // Storage might be full or blocked (e.g. private browsing) — favoriting
    // just won't persist across reloads in that case, which is an acceptable
    // silent degradation rather than a crash.
  }
}

let favoriteIds = loadFavorites();

function isFavorite(matchId) {
  return favoriteIds.has(String(matchId));
}

function toggleFavorite(matchId) {
  const id = String(matchId);
  if (favoriteIds.has(id)) {
    favoriteIds.delete(id);
  } else {
    favoriteIds.add(id);
  }
  saveFavorites(favoriteIds);
}

/* =========================================
   FLAGS
========================================= */

const flags = {
  Algeria: "dz",
  Argentina: "ar",
  Australia: "au",
  Austria: "at",
  Belgium: "be",
  BosniaHerzegovina: "ba",
  Brazil: "br",
  Canada: "ca",
  CapeVerde: "cv",
  Colombia: "co",
  Croatia: "hr",
  Curacao: "cw",
  CzechRepublic: "cz",
  DRCongo: "cd",
  Ecuador: "ec",
  Egypt: "eg",
  England: "gb-eng",
  France: "fr",
  Germany: "de",
  Ghana: "gh",
  Haiti: "ht",
  Iran: "ir",
  Iraq: "iq",
  IvoryCoast: "ci",
  Japan: "jp",
  Jordan: "jo",
  Mexico: "mx",
  Morocco: "ma",
  Netherlands: "nl",
  NewZealand: "nz",
  Norway: "no",
  Panama: "pa",
  Paraguay: "py",
  Portugal: "pt",
  Qatar: "qa",
  SaudiArabia: "sa",
  Scotland: "gb-sct",
  Senegal: "sn",
  SouthAfrica: "za",
  SouthKorea: "kr",
  Spain: "es",
  Sweden: "se",
  Switzerland: "ch",
  Tunisia: "tn",
  Turkey: "tr",
  USA: "us",
  Uruguay: "uy",
  Uzbekistan: "uz"
};

/* =========================================
   FIFA COUNTRY CODES (Eliminator tab only)
   Used to keep the full bracket tree visible without
   needing to shrink the page — flags already identify
   the team, so a 3-letter code is enough alongside them.
========================================= */

const countryCodes = {
  "Algeria": "ALG",
  "Argentina": "ARG",
  "Australia": "AUS",
  "Austria": "AUT",
  "Belgium": "BEL",
  "Bosnia & Herzegovina": "BIH",
  "Brazil": "BRA",
  "Canada": "CAN",
  "Cape Verde": "CPV",
  "Colombia": "COL",
  "Croatia": "CRO",
  "Curaçao": "CUW",
  "Czech Republic": "CZE",
  "DR Congo": "COD",
  "Ecuador": "ECU",
  "Egypt": "EGY",
  "England": "ENG",
  "France": "FRA",
  "Germany": "GER",
  "Ghana": "GHA",
  "Haiti": "HAI",
  "Iran": "IRN",
  "Iraq": "IRQ",
  "Ivory Coast": "CIV",
  "Japan": "JPN",
  "Jordan": "JOR",
  "Mexico": "MEX",
  "Morocco": "MAR",
  "Netherlands": "NED",
  "New Zealand": "NZL",
  "Norway": "NOR",
  "Panama": "PAN",
  "Paraguay": "PAR",
  "Portugal": "POR",
  "Qatar": "QAT",
  "Saudi Arabia": "KSA",
  "Scotland": "SCO",
  "Senegal": "SEN",
  "South Africa": "RSA",
  "South Korea": "KOR",
  "Spain": "ESP",
  "Sweden": "SWE",
  "Switzerland": "SUI",
  "Tunisia": "TUN",
  "Turkey": "TUR",
  "USA": "USA",
  "Uruguay": "URU",
  "Uzbekistan": "UZB",
};

function getCountryCode(name) {
  return countryCodes[name] || name; // fall back to full name if unmapped
}

/* =========================================
   HELPERS
========================================= */

function normalizeTeam(team) {
  return team
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // strip accents (ç -> c)
    .replace(/\s/g, "")
    .replace(/[&'.]/g, "");
}

function getFlag(team) {
  const code = flags[normalizeTeam(team)];
  if (!code) return "";
  return `<img src="https://flagcdn.com/w80/${code}.png"/>`;
}

function formatMatchTime(utcTime) {
  return new Date(utcTime).toLocaleString("en-IN", {
    timeZone: selectedTimezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
}

/* =========================================
   DATE BUCKETING (TIMEZONE-AWARE)

   "Today" must mean today in the VIEWER's
   selected timezone, not UTC — a match at
   11pm IST on the 22nd is still the 22nd in
   IST, even though it might already be the
   23rd in UTC.

   We use Intl to get the Y-M-D of a UTC
   timestamp *as rendered in a given timezone*,
   then compare those strings directly.
========================================= */

function dateKeyInZone(utcTime, timeZone) {
  // en-CA gives YYYY-MM-DD directly, easy to compare as strings.
  return new Date(utcTime).toLocaleDateString("en-CA", { timeZone });
}

function getTabBuckets(matches, timeZone) {
  const todayKey = dateKeyInZone(new Date().toISOString(), timeZone);

  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowKey = dateKeyInZone(tomorrow.toISOString(), timeZone);

  const today = [];
  const tomorrowMatches = [];
  const previous = [];

  for (const m of matches) {
    const matchKey = dateKeyInZone(m.timeUTC, timeZone);

    if (matchKey === todayKey) {
      today.push(m);
    } else if (matchKey === tomorrowKey) {
      tomorrowMatches.push(m);
    } else if (matchKey < todayKey || m.status === "FT") {
      // Anything dated before today, OR already finished
      // (covers an edge case: a match that started today but
      // finished — still wanted in "today", not "previous",
      // so FT-on-today is handled by the todayKey check above
      // running first; this branch only catches genuinely past dates).
      previous.push(m);
    }
  }

  const favorites = matches.filter(m => isFavorite(m.id));

  return { today, tomorrow: tomorrowMatches, previous, all: matches, favorites };
}

/* =========================================
   STATUS FIX (IMPORTANT)
========================================= */

function getStatusUI(status) {
  if (status === "LIVE") {
    return `<span class="status live">🔴 LIVE</span>`;
  }

  if (status === "HT") {
    return `<span class="status ht">⏸ HT</span>`;
  }

  if (status === "FT") {
    return `<span class="status ft">🏁 FT</span>`;
  }

  if (status === "POSTPONED") {
    return `<span class="status scheduled">⏸ POSTPONED</span>`;
  }

  if (status === "CANCELLED") {
    return `<span class="status scheduled">✕ CANCELLED</span>`;
  }

  if (status === "LIKELY_FT") {
    // We never caught this match's live window, and the API hasn't
    // confirmed its result yet (it'll be backfilled by the daily
    // catch-up). Clearly distinct from a genuinely upcoming match.
    return `<span class="status scheduled">❔ Result Pending</span>`;
  }

  return `<span class="status scheduled">⏳ SCHEDULED</span>`;
}

/* =========================================
   MATCH CARD
========================================= */

/* =========================================
   GOAL SCORERS
========================================= */

function formatGoalEntry(g) {
  const suffix = g.ownGoal ? " (OG)" : g.penalty ? " (P)" : "";
  return `${g.name} ${g.minute}'${suffix}`;
}

function createGoalScorersBlock(match) {
  const homeGoals = match.goalsHome || [];
  const awayGoals = match.goalsAway || [];

  if (homeGoals.length === 0 && awayGoals.length === 0) return "";

  const sortByMinute = (a, b) => parseInt(a.minute) - parseInt(b.minute);

  const homeList = [...homeGoals].sort(sortByMinute).map(formatGoalEntry).join("<br>");
  const awayList = [...awayGoals].sort(sortByMinute).map(formatGoalEntry).join("<br>");

  return `
    <div class="goal-scorers">
      <div class="goal-scorers-col">
        <div class="goal-scorers-team">${match.team1}</div>
        ${homeList || "<span class=\"goal-scorers-none\">—</span>"}
      </div>
      <div class="goal-scorers-col goal-scorers-col-right">
        <div class="goal-scorers-team">${match.team2}</div>
        ${awayList || "<span class=\"goal-scorers-none\">—</span>"}
      </div>
    </div>
  `;
}

function createMatchCard(match) {

  // Only show a scoreline once the match has actually kicked off.
  // A null score means "not started" — that's different from a real 0-0.
  const hasScore =
    match.score &&
    match.score.home !== null &&
    match.score.away !== null &&
    match.status !== "SCHEDULED";

  const score = hasScore
    ? `<div class="score">${match.score.home} - ${match.score.away}</div>`
    : `<div class="vs">VS</div>`;

  const favorited = isFavorite(match.id);

  return `
    <div class="match-card">

      <button
        class="favorite-star ${favorited ? "favorite-star-active" : ""}"
        data-match-id="${match.id}"
        aria-label="${favorited ? "Remove from favorites" : "Add to favorites"}"
        title="${favorited ? "Remove from favorites" : "Add to favorites"}"
      >${favorited ? "★" : "☆"}</button>

      <div class="stage-badge">
        ${match.stage}
        ${match.group ? ` • Group ${match.group}` : ""}
        ${getStatusUI(match.status)}
      </div>

      <div class="teams-grid">

        <div class="team-left">
          ${getFlag(match.team1)}
          <div class="team-name">${match.team1}</div>
        </div>

        <div style="display:flex; flex-direction:column; align-items:center;">
          ${score}
        </div>

        <div class="team-right">
          <div class="team-name">${match.team2}</div>
          ${getFlag(match.team2)}
        </div>

      </div>

      ${hasScore ? createGoalScorersBlock(match) : ""}

      <div class="match-info-inline">

        <div class="info-chip">
          🕒 ${formatMatchTime(match.timeUTC)}
        </div>

        <div class="info-chip">
          🏟 ${match.stadium}
        </div>

        <div class="info-chip">
          📍 ${match.city}
        </div>

      </div>

    </div>
  `;
}

/* =========================================
   GROUPS TAB

   Computes standard football standings (3 pts win, 1 draw, 0 loss;
   tiebreak by goal difference, then goals scored) from FT matches
   only, per group, then renders each group's table + fixtures.
========================================= */

function computeStandings(groupMatches) {
  const teams = new Map(); // name -> stats

  function ensureTeam(name) {
    if (!teams.has(name)) {
      teams.set(name, {
        name, played: 0, won: 0, drawn: 0, lost: 0,
        gf: 0, ga: 0, gd: 0, points: 0,
      });
    }
    return teams.get(name);
  }

  // Seed every team that appears in the group's fixtures, even with
  // zero matches played yet, so the table always shows all 4 teams.
  for (const m of groupMatches) {
    ensureTeam(m.team1);
    ensureTeam(m.team2);
  }

  for (const m of groupMatches) {
    if (m.status !== "FT" || m.score.home === null || m.score.away === null) continue;

    const home = ensureTeam(m.team1);
    const away = ensureTeam(m.team2);

    home.played++; away.played++;
    home.gf += m.score.home; home.ga += m.score.away;
    away.gf += m.score.away; away.ga += m.score.home;

    if (m.score.home > m.score.away) {
      home.won++; home.points += 3;
      away.lost++;
    } else if (m.score.home < m.score.away) {
      away.won++; away.points += 3;
      home.lost++;
    } else {
      home.drawn++; away.drawn++;
      home.points++; away.points++;
    }
  }

  const standings = Array.from(teams.values()).map(t => ({
    ...t, gd: t.gf - t.ga,
  }));

  standings.sort((a, b) =>
    b.points - a.points ||
    b.gd - a.gd ||
    b.gf - a.gf ||
    a.name.localeCompare(b.name)
  );

  return standings;
}

function createStandingsTable(standings) {
  const rows = standings.map((t, i) => `
    <tr class="${i < 2 ? "qualifying" : ""}">
      <td class="sticky-col sticky-col-1">${i + 1}</td>
      <td class="sticky-col sticky-col-2">
        <div class="standings-team">
          ${getFlag(t.name)}
          <span>${t.name}</span>
        </div>
      </td>
      <td class="numeric">${t.played}</td>
      <td class="numeric">${t.won}</td>
      <td class="numeric">${t.drawn}</td>
      <td class="numeric">${t.lost}</td>
      <td class="numeric">${t.gf}</td>
      <td class="numeric">${t.ga}</td>
      <td class="numeric">${t.gd > 0 ? "+" + t.gd : t.gd}</td>
      <td class="numeric standings-pts">${t.points}</td>
    </tr>
  `).join("");

  return `
    <div class="standings-scroll">
      <table class="standings-table">
        <thead>
          <tr>
            <th class="sticky-col sticky-col-1">#</th>
            <th class="sticky-col sticky-col-2">Team</th>
            <th class="numeric">P</th>
            <th class="numeric">W</th>
            <th class="numeric">D</th>
            <th class="numeric">L</th>
            <th class="numeric">GF</th>
            <th class="numeric">GA</th>
            <th class="numeric">GD</th>
            <th class="numeric">Pts</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

function formatCondensedScorers(match) {
  const all = [...(match.goalsHome || []), ...(match.goalsAway || [])];
  if (all.length === 0) return "";

  const sorted = [...all].sort((a, b) => parseInt(a.minute) - parseInt(b.minute));
  const text = sorted.map(formatGoalEntry).join(", ");
  return `<div class="group-fixture-scorers">⚽ ${text}</div>`;
}

function createGroupFixtureRow(m) {
  const hasScore =
    m.score && m.score.home !== null && m.score.away !== null && m.status !== "SCHEDULED";

  const score = hasScore
    ? `<span class="group-fixture-score">${m.score.home} - ${m.score.away}</span>`
    : `<span class="group-fixture-score">vs</span>`;

  return `
    <div class="group-fixture-row">
      <div class="group-fixture-teams">
        ${getFlag(m.team1)}<span>${m.team1}</span>
        ${score}
        <span>${m.team2}</span>${getFlag(m.team2)}
      </div>
      ${hasScore ? formatCondensedScorers(m) : ""}
      <div class="group-fixture-meta">
        ${getStatusUI(m.status)} • ${formatMatchTime(m.timeUTC)}
      </div>
    </div>
  `;
}

function createGroupBlock(groupLetter, groupMatches) {
  const standings = computeStandings(groupMatches);
  const sortedFixtures = [...groupMatches].sort(
    (a, b) => new Date(a.timeUTC) - new Date(b.timeUTC)
  );

  return `
    <div class="group-block" id="group-${groupLetter}">
      <div class="group-block-title">Group ${groupLetter}</div>
      ${createStandingsTable(standings)}
      <div class="group-fixtures-title">Fixtures</div>
      ${sortedFixtures.map(createGroupFixtureRow).join("")}
    </div>
  `;
}

/* =========================================
   ELIMINATOR TAB (Knockout Bracket)

   Knockout fixtures reference unresolved slots two ways:
   - "W74" = winner of match id 74 (chains back through earlier rounds)
   - "1A" / "2A" = Group A winner / runner-up
   - "3A/B/C/D/F" = best third-placed team among the listed groups

   We resolve "W##" references by looking up that match: if it's
   finished, show the actual winner; otherwise show a readable
   "Winner of Team1 vs Team2" placeholder. Group-letter codes are
   shown as-is (e.g. "Group A Winner") since standings already surface
   that fact accurately in the Groups tab.
========================================= */

const ROUND_ORDER = [
  "Round of 32", "Round of 16", "Quarter-final",
  "Semi-final", "Match for third place", "Final",
];

function isPlaceholderCode(name) {
  return /^([WL]\d+|\d[A-L](\/[A-L])*|\d[A-L]\/[A-L\/]+)$/.test(name || "");
}

// Returns the REAL resolved team name if known, or null if still undecided.
// Used to determine actual bracket progression (for highlighting/connecting),
// as opposed to resolveTeamLabel which always returns a human-readable string
// (placeholder text included) for display.
function resolveActualTeam(code, matchesById, wantWinner = true) {
  if (!code) return null;
  if (!isPlaceholderCode(code)) return code; // already a real team name

  const ref_match = code.match(/^([WL])(\d+)$/);
  if (ref_match) {
    const [, kind, id] = ref_match;
    const ref = matchesById.get(id);
    if (!ref || ref.status !== "FT" || ref.score.home === null) return null;
    if (ref.score.home === ref.score.away) return null; // shouldn't happen in knockout

    const winner = ref.score.home > ref.score.away ? ref.team1 : ref.team2;
    const loser = ref.score.home > ref.score.away ? ref.team2 : ref.team1;
    const resultTeam = (kind === "W") === wantWinner ? winner : loser;

    // The team stored on the match might ITSELF be unresolved (e.g. a R16
    // match between two still-placeholder R32 winners) — recurse via the
    // same resolution path used for display, but here we want the truth,
    // so if resultTeam is still a code, resolve it too.
    return isPlaceholderCode(resultTeam)
      ? resolveActualTeam(resultTeam, matchesById, true)
      : resultTeam;
  }

  return null; // group-slot codes (1A, 3A/B/C) aren't resolved to a real team here
}

function resolveTeamLabel(code, matchesById) {
  if (!code) return "TBD";

  const winnerMatch = code.match(/^W(\d+)$/);
  if (winnerMatch) {
    const ref = matchesById.get(winnerMatch[1]);
    if (!ref) return `Winner of Match ${winnerMatch[1]}`;

    if (ref.status === "FT" && ref.score.home !== null) {
      if (ref.score.home === ref.score.away) return `Winner of ${getCountryCode(ref.team1)} vs ${getCountryCode(ref.team2)}`;
      return getCountryCode(ref.score.home > ref.score.away ? ref.team1 : ref.team2);
    }

    const t1 = isPlaceholderCode(ref.team1) ? resolveTeamLabel(ref.team1, matchesById) : getCountryCode(ref.team1);
    const t2 = isPlaceholderCode(ref.team2) ? resolveTeamLabel(ref.team2, matchesById) : getCountryCode(ref.team2);
    return `${t1} / ${t2}`;
  }

  const loserMatch = code.match(/^L(\d+)$/);
  if (loserMatch) {
    const ref = matchesById.get(loserMatch[1]);
    if (!ref) return `Loser of Match ${loserMatch[1]}`;
    if (ref.status === "FT" && ref.score.home !== null && ref.score.home !== ref.score.away) {
      return getCountryCode(ref.score.home > ref.score.away ? ref.team2 : ref.team1);
    }
    return `Loser: ${getCountryCode(ref.team1)} vs ${getCountryCode(ref.team2)}`;
  }

  const groupSlot = code.match(/^(\d)([A-L])$/);
  if (groupSlot) {
    const [, place, letter] = groupSlot;
    const ordinal = place === "1" ? "Winner" : "Runner-up";
    return `Group ${letter} ${ordinal}`;
  }

  const thirdPlace = code.match(/^3([A-L](?:\/[A-L])*)$/);
  if (thirdPlace) {
    return `Best 3rd: Grp ${thirdPlace[1].split("/").join("/")}`;
  }

  return code; // already a real team name
}

/* =========================================
   BRACKET TREE CONSTRUCTION

   Builds a binary tree purely from match ID references (W##/L##), so
   it works for any tournament shape without hardcoding round names or
   match counts. Each node = { match, team1Source, team2Source, left, right }
   where left/right are the matches feeding into this one (or null for
   the very first round, which has real or group-slot starting values).
========================================= */

function findSourceMatch(code, matchesById) {
  const m = (code || "").match(/^[WL](\d+)$/);
  return m ? matchesById.get(m[1]) : null;
}

function buildBracketNode(match, matchesById) {
  if (!match) return null;
  return {
    match,
    left: findSourceMatch(match.team1, matchesById)
      ? buildBracketNode(findSourceMatch(match.team1, matchesById), matchesById)
      : null,
    right: findSourceMatch(match.team2, matchesById)
      ? buildBracketNode(findSourceMatch(match.team2, matchesById), matchesById)
      : null,
  };
}

function createBracketSlot(teamCode, match, matchesById) {
  const isReal = !isPlaceholderCode(teamCode);
  const label = isReal ? getCountryCode(teamCode) : resolveTeamLabel(teamCode, matchesById);

  // Determine if THIS slot is the winner, to highlight progression —
  // only meaningful once the match has a real result.
  let isWinner = false;
  if (match.status === "FT" && match.score.home !== null && match.score.home !== match.score.away) {
    const winningTeamName = match.score.home > match.score.away ? match.team1 : match.team2;
    isWinner = isReal && teamCode === winningTeamName;
  }

  return `
    <div class="bracket-slot ${isReal ? "" : "bracket-slot-tbd"} ${isWinner ? "bracket-slot-winner" : ""}">
      ${isReal ? getFlag(teamCode) : '<span class="bracket-slot-dash">•</span>'}
      <span class="bracket-slot-name">${label}</span>
    </div>
  `;
}

function createBracketMatchBox(match, matchesById) {
  return `
    <div class="bracket-box">
      <div class="bracket-box-meta">${formatMatchTime(match.timeUTC)}</div>
      ${createBracketSlot(match.team1, match, matchesById)}
      ${createBracketSlot(match.team2, match, matchesById)}
    </div>
  `;
}

function renderEliminator(matches) {
  const knockoutMatches = matches.filter(m => ROUND_ORDER.includes(m.stage));

  if (knockoutMatches.length === 0) {
    eliminatorContainer.innerHTML = `<div class="text-center text-zinc-500 py-12">Knockout stage hasn't started yet.</div>`;
    return;
  }

  const matchesById = new Map(matches.map(m => [String(m.id), m]));

  const finalMatch = knockoutMatches.find(m => m.stage === "Final");
  const thirdPlaceMatch = knockoutMatches.find(m => m.stage === "Match for third place");

  if (!finalMatch) {
    // Fallback: knockout data exists but no Final entry found (shouldn't
    // happen with a real tournament dataset) — show a flat list instead
    // of a broken bracket.
    eliminatorContainer.innerHTML = renderFlatKnockoutFallback(knockoutMatches, matchesById);
    return;
  }

  const tree = buildBracketNode(finalMatch, matchesById);

  // Collect every match at each depth from the Final backward, so we can
  // render proper columns (Final is the rightmost-center column; R32 is
  // the outermost columns on both sides).
  const leftHalf = tree.left;   // SF1 branch -> everything feeding it
  const rightHalf = tree.right; // SF2 branch -> everything feeding it

  function collectByDepth(node, depth, acc) {
    if (!node) return;
    if (!acc[depth]) acc[depth] = [];
    acc[depth].push(node);
    collectByDepth(node.left, depth + 1, acc);
    collectByDepth(node.right, depth + 1, acc);
  }

  const leftDepths = {};
  collectByDepth(leftHalf, 0, leftDepths);
  const rightDepths = {};
  collectByDepth(rightHalf, 0, rightDepths);

  const maxDepth = Math.max(
    ...Object.keys(leftDepths).map(Number),
    ...Object.keys(rightDepths).map(Number)
  );

  const STAGE_NAMES = { 0: "Semi-final", 1: "Quarter-final", 2: "Round of 16", 3: "Round of 32" };

  function renderHalf(depths, side) {
    const cols = [];
    for (let d = maxDepth; d >= 0; d--) {
      const nodes = (depths[d] || []).slice();
      cols.push(`
        <div class="bracket-col">
          <div class="bracket-col-label">${STAGE_NAMES[d] || "Round"}</div>
          ${nodes.map(n => createBracketMatchBox(n.match, matchesById)).join("")}
        </div>
      `);
    }
    return `<div class="bracket-half bracket-half-${side}">${cols.join("")}</div>`;
  }

  const finalCol = `
    <div class="bracket-col bracket-col-final">
      <div class="bracket-col-label bracket-final-label">Final</div>
      ${createBracketMatchBox(finalMatch, matchesById)}
      ${thirdPlaceMatch ? `
        <div class="bracket-col-label bracket-third-label">3rd Place</div>
        ${createBracketMatchBox(thirdPlaceMatch, matchesById)}
      ` : ""}
    </div>
  `;

  eliminatorContainer.innerHTML = `
    <div class="bracket-scroll">
      <div class="bracket-wrap">
        ${renderHalf(leftDepths, "left")}
        ${finalCol}
        ${renderHalf(rightDepths, "right")}
      </div>
    </div>
  `;
}

function renderFlatKnockoutFallback(knockoutMatches, matchesById) {
  const byRound = {};
  for (const m of knockoutMatches) {
    if (!byRound[m.stage]) byRound[m.stage] = [];
    byRound[m.stage].push(m);
  }

  const sections = ROUND_ORDER
    .filter(round => byRound[round] && byRound[round].length > 0)
    .map(round => {
      const roundMatches = [...byRound[round]].sort(
        (a, b) => new Date(a.timeUTC) - new Date(b.timeUTC)
      );
      return `
        <div class="elim-round">
          <div class="elim-round-title">${round}</div>
          <div class="elim-round-grid">
            ${roundMatches.map(m => createBracketMatchBox(m, matchesById)).join("")}
          </div>
        </div>
      `;
    });

  return sections.join("");
}

function renderGroups(matches) {
  const groupStageMatches = matches.filter(m => m.stage === "Group Stage" && m.group);

  const byGroup = {};
  for (const m of groupStageMatches) {
    if (!byGroup[m.group]) byGroup[m.group] = [];
    byGroup[m.group].push(m);
  }

  const groupLetters = Object.keys(byGroup).sort();

  if (groupLetters.length === 0) {
    groupsContainer.innerHTML = `<div class="text-center text-zinc-500 py-12">No group stage data available.</div>`;
    return;
  }

  const nav = `
    <div class="groups-nav">
      ${groupLetters.map(g => `<a class="group-nav-link" href="#group-${g}">Group ${g}</a>`).join("")}
    </div>
  `;

  const blocks = groupLetters.map(g => createGroupBlock(g, byGroup[g])).join("");

  groupsContainer.innerHTML = nav + blocks;
}



function render(matches) {
  renderActiveTab(matches);
  renderLastUpdated();
}

function renderActiveTab(matches) {
  if (activeTab === "groups") {
    tabMatches.classList.add("hidden");
    eliminatorContainer.classList.add("hidden");
    tabEmptyState.classList.add("hidden");
    groupsContainer.classList.remove("hidden");
    renderGroups(matches);
    return;
  }

  if (activeTab === "eliminator") {
    tabMatches.classList.add("hidden");
    groupsContainer.classList.add("hidden");
    tabEmptyState.classList.add("hidden");
    eliminatorContainer.classList.remove("hidden");
    renderEliminator(matches);
    return;
  }

  tabMatches.classList.remove("hidden");
  groupsContainer.classList.add("hidden");
  eliminatorContainer.classList.add("hidden");

  const buckets = getTabBuckets(matches, selectedTimezone);
  let tabMatchList = buckets[activeTab] || [];

  if (activeTab === "previous") {
    // Most recent result first — more useful than chronological for a results tab.
    tabMatchList = [...tabMatchList].reverse();
  }

  if (tabMatchList.length === 0) {
    tabMatches.innerHTML = "";
    tabEmptyState.classList.remove("hidden");
    tabEmptyState.textContent = activeTab === "favorites"
      ? "No favorites yet — tap the ☆ on any match to add it here."
      : "No matches to show here.";
  } else {
    tabEmptyState.classList.add("hidden");
    tabMatches.innerHTML = tabMatchList.map(createMatchCard).join("");
  }
}

function renderLastUpdated() {
  const el = document.getElementById("lastUpdated");
  if (!el) return;

  if (!lastUpdatedAt) {
    el.textContent = "";
    return;
  }

  const time = new Date(lastUpdatedAt).toLocaleTimeString("en-IN", {
    timeZone: selectedTimezone,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });

  el.textContent = `Updated ${time}`;
}

/* =========================================
   FETCH API
========================================= */

let lastKnownGoodMatches = [];
let lastUpdatedAt = null;

async function fetchMatches() {
  try {
    const res = await fetch("/api/matches");
    const data = await res.json();

    if (data.error) {
      console.warn("Backend reported an upstream error:", data.error);
    }

    lastUpdatedAt = data.lastUpdated || null;

    // Only overwrite our known-good data if the server actually
    // returned something — an empty/failed cycle shouldn't blank the UI.
    if (Array.isArray(data.data) && data.data.length > 0) {
      // Sort chronologically here, once, at the source — every tab
      // (Today, Tomorrow, Previous, All Matches, Groups) then inherits
      // correct first-to-last ordering automatically without needing
      // its own sort logic.
      lastKnownGoodMatches = [...data.data].sort(
        (a, b) => new Date(a.timeUTC) - new Date(b.timeUTC)
      );
    }

    return lastKnownGoodMatches;
  } catch (err) {
    console.log("API error", err);
    return lastKnownGoodMatches;
  }
}

/* =========================================
   TABS (Today / Tomorrow / Previous Matches / All Matches)
========================================= */

function setupTabs() {
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      tabButtons.forEach(b => b.classList.remove("active-tab"));
      btn.classList.add("active-tab");

      activeTab = btn.dataset.tab;
      renderActiveTab(filteredMatches);
    });
  });
}

/* =========================================
   FAVORITES UI WIRING

   Uses event delegation on the container (not per-button listeners)
   since match cards are fully replaced via innerHTML on every render —
   individual listeners would be destroyed and need re-attaching constantly.
========================================= */

function setupFavorites() {
  tabMatches.addEventListener("click", (e) => {
    const btn = e.target.closest(".favorite-star");
    if (!btn) return;

    const matchId = btn.dataset.matchId;
    toggleFavorite(matchId);

    // Re-render just the active tab so the star's visual state updates
    // immediately, without waiting for the next 30s poll.
    renderActiveTab(filteredMatches);
  });
}

/* =========================================
   INIT
========================================= */

async function init() {

  allMatches = await fetchMatches();
  filteredMatches = allMatches;

  render(allMatches);

  setupTimezone();
  setupSearch();
  setupTabs();
  setupFavorites();

  // live refresh
  setInterval(async () => {
    allMatches = await fetchMatches();
    filteredMatches = allMatches;
    render(filteredMatches);
  }, 30000);
}

/* =========================================
   TIMEZONE
========================================= */

function setupTimezone() {

  timezoneSelect.innerHTML = "";

  const zones = [
    { label: "IST", value: "Asia/Kolkata" },
    { label: "GMT", value: "Europe/London" },
    { label: "ET", value: "America/New_York" },
    { label: "PT", value: "America/Los_Angeles" }
  ];

  zones.forEach(z => {
    const opt = document.createElement("option");
    opt.value = z.value;
    opt.textContent = z.label;

    if (z.value === selectedTimezone) {
      opt.selected = true;
    }

    timezoneSelect.appendChild(opt);
  });

  timezoneSelect.addEventListener("change", e => {
    selectedTimezone = e.target.value;
    render(filteredMatches);
  });
}

/* =========================================
   SEARCH (FIXED)
========================================= */

function setupSearch() {

  searchInput.addEventListener("input", e => {

    const q = e.target.value.toLowerCase();

    filteredMatches = allMatches.filter(m =>
      m.team1.toLowerCase().includes(q) ||
      m.team2.toLowerCase().includes(q)
    );

    render(filteredMatches);
  });
}

init();