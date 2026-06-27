const matchesContainer =
  document.getElementById("matchesContainer");

const tabMatches =
  document.getElementById("tabMatches");

const searchInput =
  document.getElementById("searchInput");

const timezoneSelect =
  document.getElementById("timezoneSelect");

let allMatches = [];
let filteredMatches = [];

let selectedTimezone =
  Intl.DateTimeFormat().resolvedOptions().timeZone;

/* =========================================
   FLAGS
========================================= */

const flags = {
  Argentina: "ar",
  Australia: "au",
  Austria: "at",
  Belgium: "be",
  BosniaandHerzegovina: "ba",
  Brazil: "br",
  Canada: "ca",
  Colombia: "co",
  Croatia: "hr",
  Curacao: "cw",
  Czechia: "cz",
  Ecuador: "ec",
  Egypt: "eg",
  England: "gb-eng",
  France: "fr",
  Germany: "de",
  Ghana: "gh",
  Haiti: "ht",
  Iraq: "iq",
  IRIran: "ir",
  Japan: "jp",
  Jordan: "jo",
  KoreaRepublic: "kr",
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
  Spain: "es",
  Sweden: "se",
  Switzerland: "ch",
  Tunisia: "tn",
  Turkiye: "tr",
  Uruguay: "uy",
  USA: "us",
  Uzbekistan: "uz"
};

/* =========================================
   HELPERS
========================================= */

function normalizeTeam(team) {
  return team.replace(/\s/g, "").replace(/'/g, "").replace(/\./g, "");
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

  return `<span class="status scheduled">⏳ SCHEDULED</span>`;
}

/* =========================================
   MATCH CARD
========================================= */

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
   RENDER
========================================= */

function render(matches) {

  const html = matches.map(createMatchCard).join("");

  matchesContainer.innerHTML = html;
  tabMatches.innerHTML = html;

  renderLastUpdated();
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
      lastKnownGoodMatches = data.data;
    }

    return lastKnownGoodMatches;
  } catch (err) {
    console.log("API error", err);
    return lastKnownGoodMatches;
  }
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