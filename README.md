# ZYTHERAVON — One universe. Infinite identities.

Static site: `index.html`, `style.css`, `script.js`, plus `data/profiles.txt` and `data/posts.txt`.

## How it works
- Every positive whole number is a profile. Name, avatar and bio are generated deterministically from the ID string, so the same ID always gives the same profile and no ID is ever duplicated.
- 300 profiles render at once; the next 300 are prepared in idle time and appended when you are about 100 cards from the end. Scroll position is never touched.
- Search works on digit strings (no Number/BigInt), so IDs of any length match exactly.
- Open any card to see its profile (link `#p<ID>`).

## Adding data (no code changes)
`data/profiles.txt`: `$ID$NAME$IMAGE_URL$PROFILE_URL$` (image and URL may be empty; only http/https links are used; a bad image falls back to a generated avatar).
`data/posts.txt`: `$PROFILE_ID$POST_CONTENT$` (several lines per ID allowed).

## Publish on GitHub Pages
1. Create a repository and upload every file in this folder, keeping the `data` folder.
2. Open Settings > Pages, set Source to "Deploy from a branch", branch `main`, folder `/ (root)`, then Save.
3. After a minute the site is live at `https://USERNAME.github.io/REPOSITORY/`.
Netlify and Cloudflare Pages: drag the folder in, no build step.

Note: opening `index.html` directly from disk blocks the data files in most browsers; the site still runs on generated profiles. Use any static host or `python3 -m http.server` to load the data files.
