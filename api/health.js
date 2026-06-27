// Lightweight health check — confirms the function is deployed and can
// reach openfootball, without re-parsing the full dataset.

const OPENFOOTBALL_URL =
  "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";

export default async function handler(req, res) {
  try {
    const upstream = await fetch(OPENFOOTBALL_URL);
    res.status(200).json({
      status: upstream.ok ? "ok" : "degraded",
      upstreamStatus: upstream.status,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(200).json({
      status: "degraded",
      error: err.message,
      checkedAt: new Date().toISOString(),
    });
  }
}
