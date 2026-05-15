const matchesContainer = document.getElementById("matchesContainer");
const tabMatches = document.getElementById("tabMatches");
const searchInput = document.getElementById("searchInput");
const timezoneSelect = document.getElementById("timezoneSelect");

let allMatches = [];

let selectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

/* COUNTRY FLAGS */

const flags = {
  Brazil: "br",
  Germany: "de",
  Argentina: "ar",
  France: "fr",
  Mexico: "mx",
  Japan: "jp",
  Spain: "es",
  Portugal: "pt",
  England: "gb-eng",
  USA: "us"
};

/* TIMEZONE LIST */

const timezones = [
  "Asia/Kolkata",
  "Europe/London",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Europe/Paris",
  "Asia/Tokyo",
  "Australia/Sydney"
];

/* FORMAT TIME */

function formatTime(utcTime) {

  return new Date(utcTime).toLocaleString([], {

    timeZone: selectedTimezone,

    weekday: "short",

    day: "numeric",

    month: "short",

    hour: "numeric",

    minute: "2-digit",

    hour12: true

  });

}

/* DATE FORMAT */

function prettyDate(dateStr) {

  return new Date(dateStr).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });

}

/* FLAG */

function getFlag(team) {

  const code = flags[team];

  if (!code) return "";

  return `
    <img
      src="https://flagcdn.com/w80/${code}.png"
      alt="${team}"
    />
  `;

}

/* CARD */

function createMatchCard(match, today = false) {

  return `

    <div class="match-card ${today ? "today-card" : ""}">

      <div class="teams">

        <div class="team">
          ${getFlag(match.team1)}
          <div class="team-name">
            ${match.team1}
          </div>
        </div>

        <div class="vs">VS</div>

        <div class="team justify-end text-right">
          <div class="team-name">
            ${match.team2}
          </div>
          ${getFlag(match.team2)}
        </div>

      </div>

      <div class="match-info">
        <div>🕒 ${formatTime(match.timeUTC)}</div>
        <div>🏟 ${match.stadium}</div>
        <div>🏆 ${match.stage}</div>
      </div>

    </div>

  `;

}

/* GROUP BY DATE */

function groupByDate(matches) {

  const grouped = {};

  matches.forEach(match => {

    if (!grouped[match.date]) {
      grouped[match.date] = [];
    }

    grouped[match.date].push(match);

  });

  return grouped;

}

/* FULL SCHEDULE */

function renderSchedule(matches) {

  matchesContainer.innerHTML = "";

  const grouped = groupByDate(matches);

  Object.keys(grouped)
    .sort()
    .forEach(date => {

      matchesContainer.innerHTML += `
        <div class="date-header">
          ${prettyDate(date)}
        </div>
      `;

      grouped[date].forEach(match => {
        matchesContainer.innerHTML += createMatchCard(match);
      });

    });

}

/* RENDER TABS */

function renderTabs(matches) {

  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split("T")[0];

  const todayMatches = matches.filter(match => match.date === today);
  const tomorrowMatches = matches.filter(match => match.date === tomorrow);

  let html = "";

  if (todayMatches.length === 0 && tomorrowMatches.length === 0) {
    html = `<div class="text-zinc-500">No matches today or tomorrow</div>`;
  } else {
    if (todayMatches.length > 0) {
      html += `<div class="mb-6">
        <h3 class="text-lg font-semibold mb-3">Today</h3>`;
      todayMatches.forEach(match => {
        html += createMatchCard(match, true);
      });
      html += `</div>`;
    }

    if (tomorrowMatches.length > 0) {
      html += `<div>
        <h3 class="text-lg font-semibold mb-3">Tomorrow</h3>`;
      tomorrowMatches.forEach(match => {
        html += createMatchCard(match, true);
      });
      html += `</div>`;
    }
  }

  tabMatches.innerHTML = html;

}

/* RENDER ALL */

function renderAll() {
  renderSchedule(allMatches);
  renderTabs(allMatches);
}

/* SETUP TIMEZONES */

function setupTimezones() {

  timezones.forEach(tz => {

    const option = document.createElement("option");

    option.value = tz;

    option.textContent = tz;

    if (tz === selectedTimezone) {
      option.selected = true;
    }

    timezoneSelect.appendChild(option);

  });

  timezoneSelect.addEventListener("change", e => {

    selectedTimezone = e.target.value;

    renderAll();

  });

}

/* SEARCH */

function filterMatches() {

  const query = searchInput.value.toLowerCase();

  const filtered = allMatches.filter(match =>
    match.team1.toLowerCase().includes(query) ||
    match.team2.toLowerCase().includes(query)
  );

  renderSchedule(filtered);

}

/* EVENT LISTENERS */

searchInput.addEventListener("input", filterMatches);

/* INIT */

async function init() {

  const response = await fetch("matches.json");

  allMatches = await response.json();

  allMatches.sort(
    (a, b) =>
      new Date(a.timeUTC) -
      new Date(b.timeUTC)
  );

  setupTimezones();
  renderAll();

}

init();