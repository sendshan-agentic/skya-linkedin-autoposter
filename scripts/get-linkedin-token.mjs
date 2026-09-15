// Run this ONCE on your own machine (not in GitHub Actions) to get the
// tokens you'll paste into GitHub Secrets. It cannot be run by an AI
// assistant on your behalf because it requires YOU to log into LinkedIn
// in a real browser and approve the app.
//
// Usage:
//   1. cp .env.example .env.local   and fill in LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET
//   2. node --env-file=.env.local scripts/get-linkedin-token.mjs
//   3. Open the printed URL, log in, click Allow.
//   4. You'll land on a blank/error page — that's fine. Copy the FULL
//      resulting URL from the address bar and paste it back into the
//      terminal prompt.
//   5. The script prints your access token (and refresh token, if LinkedIn
//      issued one for your app). Copy these into GitHub repo Secrets.

import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const REDIRECT_URI = "https://www.linkedin.com/developers/tools/oauth/redirect"; // any HTTPS URL registered on your app's Auth tab works for a one-time manual copy/paste flow

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name}. Set it in .env.local first.`);
    process.exit(1);
  }
  return v;
}

async function main() {
  const clientId = requireEnv("LINKEDIN_CLIENT_ID");
  const clientSecret = requireEnv("LINKEDIN_CLIENT_SECRET");

  const scope = "openid profile email w_member_social";
  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?${new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    scope,
    state: "manual_setup",
  })}`;

  console.log("\n1) Make sure this exact Redirect URL is added under your LinkedIn app's Auth tab:");
  console.log(`   ${REDIRECT_URI}\n`);
  console.log("2) Open this URL, log in, and click Allow:\n");
  console.log(authUrl + "\n");

  const rl = readline.createInterface({ input: stdin, output: stdout });
  const pasted = await rl.question("3) Paste the FULL URL you were redirected to: ");
  rl.close();

  const code = new URL(pasted.trim()).searchParams.get("code");
  if (!code) {
    console.error("Could not find a `code` parameter in that URL. Did you copy the full address bar?");
    process.exit(1);
  }

  const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!tokenRes.ok) {
    console.error(`Token exchange failed (${tokenRes.status}):`, await tokenRes.text());
    process.exit(1);
  }

  const data = await tokenRes.json();
  const userRes = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  const profile = userRes.ok ? await userRes.json() : null;

  console.log("\n===== SUCCESS — copy these into your GitHub repo's Settings > Secrets and variables > Actions =====\n");
  console.log(`LINKEDIN_ACCESS_TOKEN = ${data.access_token}`);
  if (data.refresh_token) {
    console.log(`LINKEDIN_REFRESH_TOKEN = ${data.refresh_token}`);
  } else {
    console.log("(No refresh_token was issued for this app — you'll need to re-run this script to");
    console.log(" get a new access token roughly every 60 days. See README for the reminder setup.)");
  }
  console.log(`LINKEDIN_CLIENT_ID = ${clientId}`);
  console.log(`LINKEDIN_CLIENT_SECRET = ${clientSecret}`);
  if (profile) {
    console.log(`\nConnected as: ${profile.name || "(name unavailable)"} — urn:li:person:${profile.sub}`);
  }
  console.log(`\nAccess token expires in ~${Math.round((data.expires_in || 0) / 86400)} days.`);
}

main().catch((err) => {
  console.error("Setup failed:", err.message);
  process.exit(1);
});
