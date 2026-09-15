// Lists every model available to your API key, with the methods each
// supports, so we can pick the right one for image generation by name
// instead of guessing. Run with: node --env-file=.env.local scripts/list-image-models.mjs
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Missing GEMINI_API_KEY. Run with --env-file=.env.local");
  process.exit(1);
}

const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
if (!res.ok) {
  console.error(`ListModels failed (${res.status}):`, await res.text());
  process.exit(1);
}
const data = await res.json();
const models = data.models || [];

console.log(`Found ${models.length} total models for your key.\n`);
console.log("Models with 'image' anywhere in their name:");
const byNameMatch = models.filter((m) => m.name.toLowerCase().includes("image"));
if (byNameMatch.length === 0) console.log("  (none)");
for (const m of byNameMatch) {
  console.log(`  - ${m.name.replace("models/", "")}  [${(m.supportedGenerationMethods || []).join(", ")}]`);
}

console.log("\nAll models (full list):");
for (const m of models) {
  console.log(`  - ${m.name.replace("models/", "")}  [${(m.supportedGenerationMethods || []).join(", ")}]`);
}
