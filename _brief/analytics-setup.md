# Analytics setup — vinaypasricha.com

Analytics on this site is **opt-in**. By default nothing is loaded.
To enable, edit `js/site.js` near the top — find the `ANALYTICS`
config block and change `provider` to one of the supported values.

The script tag is injected automatically across every page that
loads `js/site.js`. No per-page edits required.

## Choosing a provider

| Provider | Privacy | Cost | Read API | Recommendation |
|---|---|---|---|---|
| **Plausible** | EU-hosted, no cookies, GDPR-friendly | $9/mo (10k pageviews) | yes, clean | ✅ pick this |
| Umami | self-hostable, no cookies | free if self-hosted, $9/mo Cloud | yes | second choice |
| Fathom | privacy-first | $14/mo | yes | similar to Plausible |
| GA4 | Google, cookie-based, complex | free | yes but ugly | not recommended for this site |

The site is designed around a slow, contemplative reader. Cookie
banners and trackers would visibly violate the tone. Plausible or
Umami are the only options I would actually ship.

## Plausible — step by step

1. Sign up at [plausible.io](https://plausible.io). Choose the
   $9/mo plan (covers 10k pageviews/month; you can scale up later).
2. Add `vinaypasricha.com` as a site.
3. Open `js/site.js` in this repo.
4. Find the `ANALYTICS` block (around line 12).
5. Change:
   ```js
   const ANALYTICS = {
     provider: 'plausible',
     plausibleDomain: 'vinaypasricha.com',
     // ...
   };
   ```
6. Commit. The next page load fires its first event.
7. In Plausible dashboard, confirm events arriving (within ~30
   seconds).

Optional once-only: enable the read API in Plausible settings,
copy the API key, and stash it for when the Progress dashboard
gets wired to live data (Phase 6 of the backend plan).

## Umami — if you'd rather self-host

1. Deploy Umami to a small VPS or to Vercel (one-click templates
   exist). Free if self-hosted; $9/mo on Umami Cloud.
2. Add your site, copy the **Website ID** UUID.
3. Open `js/site.js`. Set:
   ```js
   provider: 'umami',
   umamiWebsiteId: 'your-uuid-here',
   ```
4. Commit.

## Verifying it's working

After enabling, open the live site, then check the provider
dashboard within 30 seconds. You should see one realtime visitor.

If nothing arrives:
- Check browser devtools → Network → confirm the script loaded.
- Check Console → confirm no CSP errors.
- Plausible blocks bot traffic by default; if you're testing,
  visit from a phone on cellular to bypass any local ad-blockers.

## What this does NOT do

- It does not capture personal data, IP addresses (Plausible
  anonymises), or anything you would not want a polite stranger to
  know about your visitors.
- It does not feed the Progress dashboard automatically yet. That
  requires the read API + a small server-side fetch (Phase 6 of
  `_brief/backend-plan.md`). Until then, log numbers manually in
  Studio → Progress.

## Turning it off

Set `ANALYTICS.provider` back to `'none'`. Commit. Done. The script
stops loading on next deploy.
