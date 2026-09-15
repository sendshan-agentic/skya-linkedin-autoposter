import { fetchTrendContext } from "./lib/trends.mjs";
import { generatePostText, generatePostImage } from "./lib/gemini.mjs";
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
  const { topics, source } = await fetchTrendContext();
  console.log(`      -> ${topics.length} topics (source: ${source})`);

  console.log("[2/5] Generating post text with Gemini...");
  const post = await generatePostText(topics);
  const fullText = `${post.content}\n\n${post.hashtags.join(" ")}`;
  console.log(`      -> "${post.title}" (${fullText.length} chars, model: ${post.modelUsed})`);
  console.log(`      -> hashtags: ${post.hashtags.join(" ")}`);

  console.log("[3/5] Generating post image with Gemini...");
  const image = await generatePostImage(post.imagePrompt);
  console.log(image ? "      -> image generated" : "      -> no image (will publish text-only)");

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
}

main().catch((err) => {
  console.error("Daily post failed:", err.message);
  process.exit(1);
});
