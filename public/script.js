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

  return { today, tomorrow: tomorrowMatches, previous, all: matches };
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

  return `
    <div class="match-card">

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
  return /^(W\d+|\d[A-L](\/[A-L])*|\d[A-L]\/[A-L\/]+)$/.test(name || "");
}

function resolveTeamLabel(code, matchesById) {
  if (!code) return "TBD";

  const winnerMatch = code.match(/^W(\d+)$/);
  if (winnerMatch) {
    const ref = matchesById.get(winnerMatch[1]);
    if (!ref) return `Winner of Match ${winnerMatch[1]}`;

    if (ref.status === "FT" && ref.score.home !== null) {
      const winnerName = ref.score.home > ref.score.away ? ref.team1 : ref.team2;
      // Tie in a knockout match shouldn't happen (extra time/penalties
      // resolve it), but guard anyway rather than guess.
      if (ref.score.home === ref.score.away) return `Winner of ${ref.team1} vs ${ref.team2}`;
      return winnerName;
    }

    const t1 = isPlaceholderCode(ref.team1) ? resolveTeamLabel(ref.team1, matchesById) : ref.team1;
    const t2 = isPlaceholderCode(ref.team2) ? resolveTeamLabel(ref.team2, matchesById) : ref.team2;
    return `Winner: ${t1} vs ${t2}`;
  }

  const groupSlot = code.match(/^(\d)([A-L])$/);
  if (groupSlot) {
    const [, place, letter] = groupSlot;
    const ordinal = place === "1" ? "Winner" : "Runner-up";
    return `Group ${letter} ${ordinal}`;
  }

  const thirdPlace = code.match(/^3([A-L](?:\/[A-L])*)$/);
  if (thirdPlace) {
    return `Best 3rd: Group ${thirdPlace[1].split("/").join("/")}`;
  }

  return code; // already a real team name
}

function createEliminatorMatchCard(match, matchesById) {
  const team1Label = isPlaceholderCode(match.team1)
    ? resolveTeamLabel(match.team1, matchesById)
    : match.team1;
  const team2Label = isPlaceholderCode(match.team2)
    ? resolveTeamLabel(match.team2, matchesById)
    : match.team2;

  const team1IsReal = !isPlaceholderCode(match.team1);
  const team2IsReal = !isPlaceholderCode(match.team2);

  const hasScore =
    match.score && match.score.home !== null && match.score.away !== null && match.status !== "SCHEDULED";

  const score = hasScore
    ? `<span class="elim-score">${match.score.home} - ${match.score.away}</span>`
    : `<span class="elim-score elim-vs">vs</span>`;

  return `
    <div class="elim-match">
      <div class="elim-match-meta">${formatMatchTime(match.timeUTC)} • ${match.city}</div>
      <div class="elim-teams">
        <div class="elim-team ${team1IsReal ? "" : "elim-team-tbd"}">
          ${team1IsReal ? getFlag(match.team1) : ""}
          <span>${team1Label}</span>
        </div>
        ${score}
        <div class="elim-team elim-team-right ${team2IsReal ? "" : "elim-team-tbd"}">
          <span>${team2Label}</span>
          ${team2IsReal ? getFlag(match.team2) : ""}
        </div>
      </div>
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
            ${roundMatches.map(m => createEliminatorMatchCard(m, matchesById)).join("")}
          </div>
        </div>
      `;
    });

  eliminatorContainer.innerHTML = sections.join("");
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
   INIT
========================================= */

async function init() {

  allMatches = await fetchMatches();
  filteredMatches = allMatches;

  render(allMatches);

  setupTimezone();
  setupSearch();
  setupTabs();

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