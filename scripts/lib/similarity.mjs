const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "and", "or", "to", "of", "in", "on", "for",
  "your", "you", "what", "how", "why", "just", "with", "at", "it", "its",
  "that", "this", "be", "no", "not", "can", "now", "their", "than", "from",
  "about", "into", "have", "has", "will", "they", "them", "were", "been",
  "brand", "brands", "buyers", "every", "when", "while", "more", "most",
]);

export function significantWords(text) {
  return new Set(
    String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9.\s]/g, " ")
      .split(/\s+/)
      .map((w) => w.replace(/^\.+|\.+$/g, ""))
      .filter((w) => (w.length > 3 || /\d/.test(w)) && !STOPWORDS.has(w))
  );
}

// Share of the smaller text's significant words that appear in the other.
export function similarity(a, b) {
  const A = significantWords(a);
  const B = significantWords(b);
  if (!A.size || !B.size) return 0;
  let overlap = 0;
  for (const w of A) if (B.has(w)) overlap++;
  return overlap / Math.min(A.size, B.size);
}

// Proper nouns and version numbers ("Fable", "Mythos", "5.1", "Nvidia")
// identify a news story better than general words do. Two posts that share
// 2+ of these are almost certainly the same story.
export function keyEntities(text) {
  const raw = String(text || "");
  const ents = new Set();
  for (const m of raw.matchAll(/\b\d+(?:\.\d+)+\b|\b\d+%/g)) ents.add(m[0]);
  for (const m of raw.matchAll(/\b[A-Z][a-zA-Z0-9]{2,}\b/g)) {
    const w = m[0];
    if (!GENERIC_CAPS.has(w)) ents.add(w.toLowerCase());
  }
  return ents;
}

const GENERIC_CAPS = new Set([
  "AI", "The", "This", "That", "Skya", "SKYA", "ChatGPT", "Gemini", "Perplexity",
  "Claude", "Google", "Overviews", "LinkedIn", "Audit", "When", "What", "Your",
  "Brands", "Buyers", "But", "And", "Here", "Most", "Every", "Today", "AIVisibilityIntelligence",
  "Its", "They", "Now", "Not", "For", "Why", "How", "Who", "Our", "You", "Yet", "Still", "Just",
  "One", "Two", "Three", "First", "New", "Big", "Real", "Stop", "Imagine", "Think", "Meanwhile",
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "Overview",
]);

export function sharedEntities(a, b) {
  const A = keyEntities(a);
  const B = keyEntities(b);
  let n = 0;
  for (const e of A) if (B.has(e)) n++;
  return n;
}

// True if `text` looks like a repeat of any history entry.
// Short fields (title, hook) need fewer shared names to count as a match
// than the longer opening paragraph does.
export function isDuplicateOfHistory(text, history, { wordThreshold = 0.5 } = {}) {
  return history.find((h) => {
    const checks = [
      [h.title, 2],
      [h.hook, 2],
      [h.opening, 3],
    ];
    return checks.some(
      ([f, entityThreshold]) =>
        f && (similarity(text, f) >= wordThreshold || sharedEntities(text, f) >= entityThreshold)
    );
  });
}
