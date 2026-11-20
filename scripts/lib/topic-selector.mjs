import { EVERGREEN_ANGLES } from "./angles.mjs";
import { isDuplicateOfHistory } from "./similarity.mjs";

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Drops any candidate whose title/description matches a past post's title,
// underlying story (hook) or opening paragraph, by wording OR by shared
// names/version numbers (e.g. "Fable", "Mythos", "5.1").
export function selectTopics(candidates, history, { includeEvergreen = true } = {}) {
  const combined = includeEvergreen ? [...candidates, ...EVERGREEN_ANGLES] : [...candidates];

  const fresh = combined.filter((t) => {
    const dup = isDuplicateOfHistory(`${t.title}. ${t.description || ""}`, history);
    if (dup) console.log(`      skip (already covered): "${t.title}"  ~ "${dup.hook || dup.title}"`);
    return !dup;
  });

  if (fresh.length === 0) {
    console.warn("      every candidate overlaps recent posts; using evergreen angles only");
    return shuffle(EVERGREEN_ANGLES).slice(0, 6);
  }

  // Keep caller-supplied order priority (fresh news first), shuffle within groups.
  const fromCandidates = fresh.filter((t) => candidates.includes(t));
  const fromEvergreen = fresh.filter((t) => !candidates.includes(t));
  return [...shuffle(fromCandidates), ...shuffle(fromEvergreen)].slice(0, 6);
}
