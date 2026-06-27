// Standalone probe — run this once with `node probe-worldcup26.js` to find out,
// for real, whether worldcup26.ir works without auth and what its data looks like.
// This does NOT touch your main server or any saved data — it's purely diagnostic.

const BASE = "https://worldcup26.ir";

async function tryEndpoint(label, path) {
  console.log(`\n--- ${label}: ${path} ---`);
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "Accept": "application/json" },
    });
    console.log(`HTTP status: ${res.status}`);

    const contentType = res.headers.get("content-type") || "";
    const text = await res.text();

    if (contentType.includes("application/json")) {
      try {
        const json = JSON.parse(text);
        console.log("Response (JSON):", JSON.stringify(json, null, 2).slice(0, 1500));
      } catch {
        console.log("Claimed JSON but failed to parse. Raw (first 500 chars):", text.slice(0, 500));
      }
    } else {
      console.log(`Non-JSON response (content-type: ${contentType}). First 300 chars:`, text.slice(0, 300));
    }
  } catch (err) {
    console.log("FAILED:", err.message);
  }
}

(async () => {
  // 1. Health check -- README says this needs no auth at all.
  await tryEndpoint("Health check (should need no auth)", "/health");
  await tryEndpoint("Alt health check", "/api/health");

  // 2. The actual data endpoint we'd want, unauthenticated -- per the
  // marketing snippet this should work with "no API key required for read access".
  await tryEndpoint("All matches, NO auth header", "/get/games");

  // 3. Same endpoint, but the README's documented behavior says this needs
  // a JWT bearer token or it should 401.
  await tryEndpoint("All teams, NO auth header (cross-check)", "/get/teams");
})();
