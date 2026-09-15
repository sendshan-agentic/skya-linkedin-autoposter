# SKYA Daily LinkedIn Auto-Poster

Every day at 9:00 AM IST, a GitHub Actions workflow:
1. Pulls trending AI topics.
2. Writes one on-brand LinkedIn post with Gemini (following the SKYA playbook).
3. Generates a matching image with Gemini.
4. Uploads the image and publishes the post to **your** LinkedIn profile — automatically, with no server to keep running.

## Why this is different from the old AI Studio app

The old app stored your LinkedIn login in memory on a Render server, which
gets wiped every time Render's free tier restarts — that's why the
connection kept dying. It also used LinkedIn's old posting API, which has
no supported way to attach an image. This repo fixes both: GitHub Actions
doesn't sleep or lose state between runs, and it uses LinkedIn's current
Posts + Images API.

## One-time setup

### 1. Create the repo
Create a new, empty repository on GitHub (no README/license), then in your
git GUI: clone it, copy all these files into the folder, commit, and push.

### 2. Get a Gemini API key
From [Google AI Studio](https://aistudio.google.com/apikey) — you likely
already have one from the original app.

### 3. Get your LinkedIn tokens (run once, on your own laptop)
This step needs to happen in your own browser since it requires you to log
into LinkedIn and click "Allow" — it can't be done by an AI assistant.

```bash
npm install
cp .env.example .env.local
# fill in LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET from
# developer.linkedin.com > your app > Auth tab
node --env-file=.env.local scripts/get-linkedin-token.mjs
```

Follow the printed instructions (open the URL, log in, click Allow, paste
the redirected URL back). It will print your `LINKEDIN_ACCESS_TOKEN` (and
`LINKEDIN_REFRESH_TOKEN`, if your app is issued one).

### 4. Add GitHub Secrets
In your repo: **Settings → Secrets and variables → Actions → New repository secret**.
Add each of these:

| Secret name | Value |
|---|---|
| `GEMINI_API_KEY` | your Gemini key |
| `LINKEDIN_ACCESS_TOKEN` | printed in step 3 |
| `LINKEDIN_REFRESH_TOKEN` | printed in step 3 (if issued) |
| `LINKEDIN_CLIENT_ID` | from your LinkedIn app |
| `LINKEDIN_CLIENT_SECRET` | from your LinkedIn app |

### 5. Test it before trusting it
Go to the **Actions** tab → "Daily LinkedIn Post" → **Run workflow** → tick
**dry_run** → Run. Check the log output — it prints the full generated post
text and confirms whether an image was generated, but publishes nothing.
Once that looks right, run it again with dry_run unticked to publish a real
test post, or just wait for tomorrow's 9:00 AM IST run.

## Ongoing maintenance

- **If your app got a refresh token:** the workflow refreshes automatically
  and prints a new token in the run log if it rotates — check occasionally
  and update the `LINKEDIN_ACCESS_TOKEN`/`LINKEDIN_REFRESH_TOKEN` secrets if
  you see a new one logged.
- **If your app did NOT get a refresh token:** LinkedIn access tokens
  expire after 60 days. Put a recurring reminder ~50 days out to re-run
  `scripts/get-linkedin-token.mjs` and update the secrets.
- **To change the posting time:** edit the `cron` line in
  `.github/workflows/daily-post.yml` (it's in UTC).
- **To change the LinkedIn API version:** LinkedIn versions its REST API by
  date (`LINKEDIN_VERSION` in `scripts/lib/linkedin.mjs`). If posts start
  failing with a version-related error, bump it to a more recent
  `YYYYMM` string per LinkedIn's [versioning docs](https://learn.microsoft.com/en-us/linkedin/marketing/versioning).

## Files

- `.github/workflows/daily-post.yml` — the cron trigger.
- `scripts/daily-post.mjs` — orchestrates the whole daily run.
- `scripts/lib/trends.mjs` — trend context, with an offline fallback.
- `scripts/lib/gemini.mjs` — post text + image generation.
- `scripts/lib/linkedin.mjs` — token refresh, image upload, publishing.
- `scripts/get-linkedin-token.mjs` — one-time local auth helper.
