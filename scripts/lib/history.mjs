// Tracks recently-posted content so posts don't repeat. Stored in
// data/posted-topics.json, committed back by the workflow after each real
// publish (GitHub Actions has no memory between runs otherwise).
//
// Each entry now records more than the catchy title Gemini invents:
//   - hook:    the underlying news story / topic the post was built on
//   - opening: the first ~300 chars of the post
//   - pillar:  which content pillar it belonged to
// Titles alone were the root cause of duplicates — "The Knowledge Work
// Shift" and "The Enterprise Fact-Mangle" look different but can be the
// same news story underneath.
import fs from "node:fs";
import path from "node:path";

const HISTORY_PATH = path.join(process.cwd(), "data", "posted-topics.json");
const MAX_HISTORY = 40;

// data/covered-stories.json is a hand-edited list of stories to never post
// about again (add an entry here if a repeat ever slips through).
const MANUAL_PATH = path.join(process.cwd(), "data", "covered-stories.json");

function readJsonArray(p) {
  try {
    const arr = JSON.parse(fs.readFileSync(p, "utf-8"));
    return Array.isArray(arr) ? arr.filter((e) => e && e.title) : [];
  } catch {
    return [];
  }
}

export function loadHistory() {
  return [...readJsonArray(MANUAL_PATH), ...readJsonArray(HISTORY_PATH)];
}

export function loadRecentTitles() {
  return loadHistory().map((e) => e.title);
}

export function appendHistory(entry) {
  const history = readJsonArray(HISTORY_PATH);
  const record = typeof entry === "string" ? { title: entry } : entry;
  history.push({ ...record, date: new Date().toISOString().slice(0, 10) });
  fs.mkdirSync(path.dirname(HISTORY_PATH), { recursive: true });
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history.slice(-MAX_HISTORY), null, 2) + "\n");
}
