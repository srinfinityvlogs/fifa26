const matchesContainer = document.getElementById("matchesContainer");
const todayMatches = document.getElementById("todayMatches");
const searchInput = document.getElementById("searchInput");

let allMatches = [];

function convertToIST(utcTime) {
  return new Date(utcTime).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
}

function createMatchCard(match) {

  const istDate = convertToIST(match.timeUTC);

  return `
    <div class="match-card bg-zinc-900 border border-zinc-800 rounded-2xl p-5">

      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

        <div>
          <div class="text-2xl font-bold">
            ${match.team1}
            <span class="text-zinc-500 mx-2">vs</span>
            ${match.team2}
          </div>

          <div class="mt-2 text-zinc-400">
            🏟 ${match.stadium}
          </div>
        </div>

        <div class="md:text-right">
          <div class="text-lg font-semibold text-blue-400">
            ${istDate}
          </div>

          <div class="text-zinc-500 mt-1">
            Group ${match.group}
          </div>
        </div>

      </div>

    </div>
  `;
}

function renderMatches(matches) {

  matchesContainer.innerHTML = "";

  matches.forEach(match => {
    matchesContainer.innerHTML += createMatchCard(match);
  });

}

function renderToday(matches) {

  const today = new Date().toISOString().split("T")[0];

  const todays = matches.filter(match => {
    return match.date === today;
  });

  if (!todays.length) {
    todayMatches.innerHTML = `
      <div class="text-zinc-500">
        No matches today
      </div>
    `;
    return;
  }

  todayMatches.innerHTML = "";

  todays.forEach(match => {
    todayMatches.innerHTML += createMatchCard(match);
  });
}

function filterMatches() {

  const query = searchInput.value.toLowerCase();

  const filtered = allMatches.filter(match =>
    match.team1.toLowerCase().includes(query) ||
    match.team2.toLowerCase().includes(query)
  );

  renderMatches(filtered);
}

searchInput.addEventListener("input", filterMatches);

async function init() {

  const response = await fetch("matches.json");

  allMatches = await response.json();

  renderToday(allMatches);

  renderMatches(allMatches);
}

init();