import { EVERGREEN_ANGLES } from "./angles.mjs";

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "and", "or", "to", "of", "in", "on", "for",
  "your", "you", "what", "how", "why", "just", "with", "at", "it", "its",
  "that", "this", "be", "no", "not", "can", "now", "their", "than",
]);

function significantWords(title) {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w))
  );
}

// Jaccard similarity of significant words — catches "same story, reworded
// headline" even when no exact phrase matches.
function similarity(a, b) {
  const setA = significantWords(a);
  const setB = significantWords(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let overlap = 0;
  for (const word of setA) if (setB.has(word)) overlap++;
  return overlap / Math.min(setA.size, setB.size);
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const SIMILARITY_THRESHOLD = 0.5;

// Combines live trends with the evergreen angle pool, filters out anything
// too close to what was posted recently, shuffles so the same item doesn't
// always land first (which the prompt tends to favor), and returns a short
// candidate list for the prompt.
export function selectTopics(liveTopics, recentTitles) {
  const combined = [...liveTopics, ...EVERGREEN_ANGLES];

  const fresh = combined.filter(
    (topic) => !recentTitles.some((recent) => similarity(topic.title, recent) >= SIMILARITY_THRESHOLD)
  );

  // If literally everything overlaps with recent history (very unlikely,
  // but possible with a small pool), fall back to the full combined list
  // rather than producing no candidates at all.
  const pool = fresh.length > 0 ? fresh : combined;

  return shuffle(pool).slice(0, 6);
}
