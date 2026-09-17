// Tracks recently-posted topics so the daily post doesn't repeat the same
// trending story two days in a row. Stored as a small JSON file in the repo
// itself (data/posted-topics.json) — the workflow commits this file back
// after each real (non-dry-run) publish, since GitHub Actions gives every
// run a clean checkout with no memory of previous runs otherwise.
import fs from "node:fs";
import path from "node:path";

const HISTORY_PATH = path.join(process.cwd(), "data", "posted-topics.json");
const MAX_HISTORY = 30;

export function loadRecentTitles() {
  try {
    const raw = fs.readFileSync(HISTORY_PATH, "utf-8");
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map((entry) => entry.title).filter(Boolean) : [];
  } catch {
    return []; // no history file yet — first run, or file was removed
  }
}

export function appendHistory(title) {
  let history = [];
  try {
    history = JSON.parse(fs.readFileSync(HISTORY_PATH, "utf-8"));
    if (!Array.isArray(history)) history = [];
  } catch {
    history = [];
  }
  history.push({ title, date: new Date().toISOString().slice(0, 10) });
  const trimmed = history.slice(-MAX_HISTORY);
  fs.mkdirSync(path.dirname(HISTORY_PATH), { recursive: true });
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(trimmed, null, 2) + "\n");
}
