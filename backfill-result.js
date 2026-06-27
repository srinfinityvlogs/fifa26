// Manual backfill helper — use this if worldcup26.ir doesn't work out.
// Usage:
//   node backfill-result.js <matchId> <homeScore> <awayScore>
// Example (Mexico vs South Africa, match id 1, finished 2-0):
//   node backfill-result.js 1 2 0
//
// This writes directly into results.json using the same shape the
// server itself would write, so it's picked up identically on the
// next merge cycle — no server restart required, it'll show up
// within the next live-poll interval.

import { readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MATCHES_FILE = path.join(__dirname, "matches.json");
const RESULTS_FILE = path.join(__dirname, "results.json");

const [, , matchIdArg, homeScoreArg, awayScoreArg] = process.argv;

if (!matchIdArg || homeScoreArg === undefined || awayScoreArg === undefined) {
  console.error(
    "Usage: node backfill-result.js <matchId> <homeScore> <awayScore>\n" +
    "Example: node backfill-result.js 1 2 0"
  );
  process.exit(1);
}

const matchId = String(matchIdArg);
const homeScore = Number(homeScoreArg);
const awayScore = Number(awayScoreArg);

if (Number.isNaN(homeScore) || Number.isNaN(awayScore)) {
  console.error("Scores must be numbers.");
  process.exit(1);
}

async function main() {
  const matchesRaw = await readFile(MATCHES_FILE, "utf-8");
  const matches = JSON.parse(matchesRaw);
  const match = matches.find((m) => String(m.id) === matchId);

  if (!match) {
    console.error(`No match found with id ${matchId} in matches.json.`);
    process.exit(1);
  }

  let results = {};
  try {
    const raw = await readFile(RESULTS_FILE, "utf-8");
    results = JSON.parse(raw);
  } catch {
    // results.json doesn't exist yet -- that's fine, we'll create it.
  }

  if (results[matchId]) {
    console.log(
      `⚠️  Match ${matchId} already has a saved result: ` +
      `${JSON.stringify(results[matchId].score)}. Overwriting with the value you provided.`
    );
  }

  results[matchId] = {
    status: "FT",
    score: { home: homeScore, away: awayScore },
    finalizedAt: new Date().toISOString(),
    note: "Manually backfilled",
  };

  await writeFile(RESULTS_FILE, JSON.stringify(results, null, 2), "utf-8");

  console.log(
    `✅ Recorded: ${match.team1} ${homeScore}-${awayScore} ${match.team2} ` +
    `(match id ${matchId}). This will appear in the dashboard within the next live-poll cycle.`
  );
}

main();
