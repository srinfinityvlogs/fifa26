// Quick diagnostic — run this once locally with `npm run test-api`
// to confirm: (1) matches.json loads correctly, (2) your API-Football
// key works against the live=all endpoint, before trusting the full server.

import dotenv from "dotenv";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_KEY = process.env.API_FOOTBALL_KEY;
const BASE_URL = "https://v3.football.api-sports.io";

if (!API_KEY) {
  console.error(
    "❌ No API_FOOTBALL_KEY found. Create a .env file in this folder with:\nAPI_FOOTBALL_KEY=your_key_here"
  );
  process.exit(1);
}

async function checkSchedule() {
  console.log("\n--- SCHEDULE (matches.json) ---");
  try {
    const raw = await readFile(path.join(__dirname, "matches.json"), "utf-8");
    const matches = JSON.parse(raw);
    console.log(`Loaded ${matches.length} fixtures.`);

    const dates = matches.map((m) => m.timeUTC.slice(0, 10)).sort();
    console.log(`Date range: ${dates[0]} to ${dates[dates.length - 1]}`);

    if (matches[0]) {
      console.log("Sample fixture:", JSON.stringify(matches[0], null, 2));
    }
  } catch (err) {
    console.log("FAILED to load matches.json:", err.message);
  }
}

async function checkLive() {
  console.log("\n--- LIVE (API-Football, live=all) ---");
  try {
    const res = await fetch(`${BASE_URL}/fixtures?live=all`, {
      headers: { "x-apisports-key": API_KEY },
    });
    const data = await res.json();

    console.log(`HTTP status: ${res.status}`);

    if (data.errors && Object.keys(data.errors).length > 0) {
      console.log("API reported errors:", data.errors);
    }

    const results = data.response || [];
    console.log(`Live fixtures right now (any league, worldwide): ${results.length}`);

    if (results[0]) {
      const f = results[0];
      console.log("Sample live fixture:", JSON.stringify({
        id: f.fixture.id,
        date: f.fixture.date,
        status: f.fixture.status,
        league: f.league.name,
        home: f.teams.home.name,
        away: f.teams.away.name,
        score: f.goals,
      }, null, 2));
    } else {
      console.log("(Nothing live worldwide at the moment this script ran — that's normal outside match hours.)");
    }
  } catch (err) {
    console.log("FAILED:", err.message);
  }
}

(async () => {
  await checkSchedule();
  await checkLive();
})();
