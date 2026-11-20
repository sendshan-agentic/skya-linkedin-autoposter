import { fetchTrendContext } from "./lib/trends.mjs";
import { selectTopics } from "./lib/topic-selector.mjs";
import { generatePostText, generatePostImage } from "./lib/gemini.mjs";
import { loadHistory, appendHistory } from "./lib/history.mjs";
import { pickPillar } from "./lib/pillars.mjs";
import { fetchFreshHeadlines } from "./lib/news.mjs";
import { isDuplicateOfHistory, similarity, sharedEntities } from "./lib/similarity.mjs";
import {
  maybeRefreshToken,
  resolvePersonUrn,
  uploadImage,
  publishPost,
} from "./lib/linkedin.mjs";

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required environment variable/secret: ${name}`);
    process.exit(1);
  }
  return v;
}

async function main() {
  const dryRun = process.env.DRY_RUN === "true";

  const geminiKey = requireEnv("GEMINI_API_KEY");
  let accessToken = requireEnv("LINKEDIN_ACCESS_TOKEN");
  const refreshToken = process.env.LINKEDIN_REFRESH_TOKEN || null;
  const clientId = process.env.LINKEDIN_CLIENT_ID || null;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET || null;
  void geminiKey;

  if (refreshToken && clientId && clientSecret) {
    const refreshed = await maybeRefreshToken({ accessToken, refreshToken, clientId, clientSecret });
    accessToken = refreshed.accessToken;
  }

  const history = loadHistory();
  const pillar = pickPillar(history);
  console.log(`[1/5] Post type: ${pillar.label}. Gathering stories...`);

  let candidates = [];
  if (pillar.searchBrief) {
    const avoid = history.slice(-15).map((h) => h.hook || h.title);
    candidates = await fetchFreshHeadlines(pillar, avoid);
    console.log(`      -> ${candidates.length} fresh headlines via Google Search`);
  }
  if (candidates.length === 0) {
    const { topics: liveTopics, source } = await fetchTrendContext();
    console.log(`      -> ${liveTopics.length} live trend topics (source: ${source})`);
    candidates = liveTopics;
  }

  const topics = selectTopics(candidates, history, { includeEvergreen: !pillar.searchBrief });
  console.log(`      -> ${topics.length} candidate topics after removing anything already covered`);

  console.log("[2/5] Generating post text with Gemini...");
  let post = null;
  let pool = topics;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const draft = await generatePostText(pool, history, pillar);
    const opening = draft.content.slice(0, 300);
    const dup =
      isDuplicateOfHistory(draft.sourceTopic, history) ||
      history.find((h) => h.opening && (similarity(opening, h.opening) >= 0.45 || sharedEntities(opening, h.opening) >= 3));
    if (!dup) {
      post = draft;
      break;
    }
    console.warn(`      draft ${attempt} repeats a past post ("${dup.hook || dup.title}"), regenerating with that story removed...`);
    pool = pool.filter((t) => t.title !== draft.sourceTopic && similarity(t.title, draft.sourceTopic) < 0.6);
    if (pool.length === 0) break;
  }
  if (!post) {
    throw new Error("Could not produce a post that differs from recent ones; skipping today rather than posting a repeat.");
  }

  const fullText = `${post.content}\n\n${post.hashtags.join(" ")}`;
  console.log(`      -> "${post.title}" (${fullText.length} chars, model: ${post.modelUsed})`);
  console.log(`      -> story: ${post.sourceTopic}`);
  console.log(`      -> hashtags: ${post.hashtags.join(" ")}`);

  console.log("[3/5] Generating post image with Gemini...");
  const imagesEnabled = process.env.ENABLE_IMAGES === "true";
  const image = imagesEnabled ? await generatePostImage(post.imagePrompt) : null;
  if (!imagesEnabled) {
    console.log("      -> images disabled (set ENABLE_IMAGES=true once billing is on to turn back on)");
  }
  console.log(image ? "      -> image generated" : imagesEnabled ? "      -> no image (will publish text-only)" : "");

  if (dryRun) {
    console.log("\n===== DRY RUN — nothing was published =====");
    console.log(`[pillar: ${pillar.id}]`);
    console.log(fullText);
    console.log(`Image generated: ${Boolean(image)}`);
    return;
  }

  console.log("[4/5] Resolving LinkedIn author URN...");
  const authorUrn = await resolvePersonUrn(accessToken);
  console.log(`      -> ${authorUrn}`);

  let imageUrn = null;
  if (image) {
    console.log("      Uploading image to LinkedIn...");
    imageUrn = await uploadImage(accessToken, authorUrn, image.bytes, image.mimeType);
    console.log(imageUrn ? `      -> uploaded (${imageUrn})` : "      -> upload failed, continuing text-only");
  }

  console.log("[5/5] Publishing to LinkedIn...");
  const result = await publishPost(accessToken, authorUrn, fullText, imageUrn);
  console.log(`      -> published: ${result.postUrn || "(urn not returned)"}`);

  appendHistory({
    title: post.title,
    hook: post.sourceTopic,
    opening: post.content.slice(0, 300),
    pillar: pillar.id,
  });
  console.log("      -> saved this topic to history so it isn't repeated in the next post");
}

main().catch((err) => {
  console.error("Daily post failed:", err.message);
  process.exit(1);
});
