import { fetchTrendContext } from "./lib/trends.mjs";
import { selectTopics } from "./lib/topic-selector.mjs";
import { generatePostText, generatePostImage } from "./lib/gemini.mjs";
import { loadRecentTitles, appendHistory } from "./lib/history.mjs";
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

  console.log("[1/5] Fetching trend context...");
  const { topics: liveTopics, source } = await fetchTrendContext();
  console.log(`      -> ${liveTopics.length} live topics (source: ${source})`);

  const recentTitles = loadRecentTitles();
  if (recentTitles.length) {
    console.log(`      Avoiding ${recentTitles.length} recently-covered topic(s).`);
  }

  // Mix live trends with a rotating pool of evergreen angles and drop
  // anything too similar to recent posts — the live feed alone isn't a
  // reliable source of day-to-day variety (it can return the same top
  // story for days), so we don't depend on it exclusively.
  const topics = selectTopics(liveTopics, recentTitles);
  console.log(`      -> ${topics.length} candidate topics after dedup/shuffle`);

  console.log("[2/5] Generating post text with Gemini...");
  const post = await generatePostText(topics, recentTitles);
  const fullText = `${post.content}\n\n${post.hashtags.join(" ")}`;
  console.log(`      -> "${post.title}" (${fullText.length} chars, model: ${post.modelUsed})`);
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

  appendHistory(post.title);
  console.log("      -> saved this topic to history so it isn't repeated tomorrow");
}

main().catch((err) => {
  console.error("Daily post failed:", err.message);
  process.exit(1);
});
