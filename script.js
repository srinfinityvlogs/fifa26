/* =========================================
   ELEMENTS
========================================= */

const matchesContainer =
  document.getElementById("matchesContainer");

const tabMatches =
  document.getElementById("tabMatches");

const searchInput =
  document.getElementById("searchInput");

const timezoneSelect =
  document.getElementById("timezoneSelect");

/* =========================================
   STATE
========================================= */

let allMatches = [];

let selectedTimezone =
  Intl.DateTimeFormat()
    .resolvedOptions()
    .timeZone;

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
   TIMEZONES
========================================= */

const timezones = [

  {
    label: "🇮🇳 IST",
    value: "Asia/Kolkata"
  },

  {
    label: "🇬🇧 GMT",
    value: "Europe/London"
  },

  {
    label: "🇺🇸 ET",
    value: "America/New_York"
  },

  {
    label: "🇺🇸 CT",
    value: "America/Chicago"
  },

  {
    label: "🇺🇸 PT",
    value: "America/Los_Angeles"
  },

  {
    label: "🇫🇷 CET",
    value: "Europe/Paris"
  },

  {
    label: "🇯🇵 JST",
    value: "Asia/Tokyo"
  },

  {
    label: "🇦🇺 AEST",
    value: "Australia/Sydney"
  }

];

/* =========================================
   HELPERS
========================================= */

function normalizeTeam(team) {

  return team
    .replace(/\s/g, "")
    .replace(/'/g, "")
    .replace(/\./g, "");

}

function getFlag(team) {

  const key = normalizeTeam(team);

  const code = flags[key];

  if (!code) return "";

  return `
    <img
      src="https://flagcdn.com/w80/${code}.png"
      alt="${team}"
    />
  `;

}

function formatMatchTime(utcTime) {

  return new Date(utcTime)
    .toLocaleString("en-IN", {

      timeZone: selectedTimezone,

      weekday: "short",

      day: "numeric",

      month: "short",

      hour: "numeric",

      minute: "2-digit",

      hour12: true

    });

}

function getLocalDateString(utcTime) {

  const formatter =
    new Intl.DateTimeFormat("en-CA", {

      timeZone: selectedTimezone,

      year: "numeric",

      month: "2-digit",

      day: "2-digit"

    });

  return formatter
    .format(new Date(utcTime));

}

function formatSectionDate(dateStr) {

  return new Date(dateStr)
    .toLocaleDateString("en-IN", {

      weekday: "long",

      day: "numeric",

      month: "long"

    });

}

/* =========================================
   MATCH CARD
========================================= */

function createMatchCard(match) {

  return `

    <div class="match-card">

      <!-- STAGE -->

      <div class="stage-badge">

        ${match.stage}

        ${match.group
          ? ` • Group ${match.group}`
          : ""
        }

      </div>

      <!-- TEAMS -->

      <div class="teams">

        <div class="team">

          ${getFlag(match.team1)}

          <div class="team-name">
            ${match.team1}
          </div>

        </div>

        <div class="vs">
          VS
        </div>

        <div class="team justify-end text-right">

          <div class="team-name">
            ${match.team2}
          </div>

          ${getFlag(match.team2)}

        </div>

      </div>

      <!-- INFO -->

      <div class="match-info">

        <div>
          🕒 ${formatMatchTime(match.timeUTC)}
        </div>

        <div>
          🏟 ${match.stadium}
        </div>

        <div>
          📍 ${match.city}
        </div>

      </div>

    </div>

  `;

}

/* =========================================
   GROUP MATCHES BY LOCAL DATE
========================================= */

function groupMatchesByDate(matches) {

  const grouped = {};

  matches.forEach(match => {

    const localDate =
      getLocalDateString(match.timeUTC);

    if (!grouped[localDate]) {

      grouped[localDate] = [];

    }

    grouped[localDate].push(match);

  });

  return grouped;

}

/* =========================================
   FULL SCHEDULE
========================================= */

function renderSchedule(matches) {

  matchesContainer.innerHTML = "";

  const grouped =
    groupMatchesByDate(matches);

  Object.keys(grouped)
    .sort()
    .forEach(date => {

      matchesContainer.innerHTML += `

        <div class="date-header">
          ${formatSectionDate(date)}
        </div>

      `;

      grouped[date]
        .forEach(match => {

          matchesContainer.innerHTML +=
            createMatchCard(match);

        });

    });

}

/* =========================================
   TODAY / TOMORROW
========================================= */

function renderTab(tabType) {

  const now = new Date();

  const target =
    new Date(now);

  if (tabType === "tomorrow") {

    target.setDate(
      target.getDate() + 1
    );

  }

  const targetDate =
    getLocalDateString(target);

  const filtered =
    allMatches.filter(match => {

      return (
        getLocalDateString(
          match.timeUTC
        ) === targetDate
      );

    });

  if (!filtered.length) {

    tabMatches.innerHTML = `

      <div class="empty-state">
        No matches
      </div>

    `;

    return;
  }

  tabMatches.innerHTML = "";

  filtered.forEach(match => {

    tabMatches.innerHTML +=
      createMatchCard(match);

  });

}

/* =========================================
   TABS
========================================= */

function setupTabs() {

  const buttons =
    document.querySelectorAll(
      ".tab-button"
    );

  buttons.forEach(button => {

    button.addEventListener(
      "click",
      () => {

        buttons.forEach(btn => {

          btn.classList.remove(
            "active-tab"
          );

        });

        button.classList.add(
          "active-tab"
        );

        renderTab(
          button.dataset.tab
        );

      }
    );

  });

}

/* =========================================
   SEARCH
========================================= */

function setupSearch() {

  searchInput.addEventListener(
    "input",
    e => {

      const query =
        e.target.value
          .toLowerCase()
          .trim();

      if (!query) {

        renderSchedule(allMatches);

        return;

      }

      const filtered =
        allMatches.filter(match => {

          return (
            match.team1
              .toLowerCase()
              .includes(query)

            ||

            match.team2
              .toLowerCase()
              .includes(query)
          );

        });

      renderSchedule(filtered);

    }
  );

}

/* =========================================
   TIMEZONE DROPDOWN
========================================= */

function setupTimezones() {

  timezoneSelect.innerHTML = "";

  timezones.forEach(tz => {

    const option =
      document.createElement(
        "option"
      );

    option.value = tz.value;

    option.textContent =
      tz.label;

    if (
      tz.value === selectedTimezone
    ) {

      option.selected = true;

    }

    timezoneSelect.appendChild(
      option
    );

  });

  timezoneSelect.addEventListener(
    "change",
    e => {

      selectedTimezone =
        e.target.value;

      rerenderEverything();

    }
  );

}

/* =========================================
   RERENDER
========================================= */

function rerenderEverything() {

  renderSchedule(allMatches);

  const activeTab =
    document.querySelector(
      ".active-tab"
    );

  renderTab(
    activeTab.dataset.tab
  );

}

/* =========================================
   INIT
========================================= */

async function init() {

  try {

    const response =
      await fetch("matches.json");

    allMatches =
      await response.json();

    allMatches.sort(
      (a, b) => {

        return (
          new Date(a.timeUTC)
          -
          new Date(b.timeUTC)
        );

      }
    );

    setupTimezones();

    setupTabs();

    setupSearch();

    renderSchedule(allMatches);

    renderTab("today");

  }

  catch (error) {

    console.error(error);

    matchesContainer.innerHTML = `

      <div class="empty-state">

        Failed to load matches.json

      </div>

    `;

  }

}

/* =========================================
   START
========================================= */

init();