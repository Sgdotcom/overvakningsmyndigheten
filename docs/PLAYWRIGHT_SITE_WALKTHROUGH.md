# Playwright — full site walkthrough (video)

This project includes a **Playwright** test that visits **every HTML page**, scrolls through it, and records a **video** of the browser session.

## One-time setup

```bash
npm install
npx playwright install chromium
```

## Run (starts Vite dev server automatically)

```bash
npm run test:e2e
```

**`npx playwright show-report` only works after a successful run** — it reads the `playwright-report/` folder that Playwright creates when tests finish. That folder is **not in git** (gitignored), so after cloning you must run the tests once first.

One command to run tests **and** open the HTML report in a browser:

```bash
npm run test:e2e:run-and-report
```

- **Dev server:** `http://127.0.0.1:5173` (started by Playwright if not already running).
- **Test file:** `e2e/site-walkthrough.spec.ts`
- **Config:** `playwright.config.ts`

## Where is the video?

After the run:

- **`test-results/`** — contains the **`.webm`** video for the test (path shown in the terminal output).
- **`playwright-report/`** — HTML report; open with:

```bash
npx playwright show-report
```

## Custom base URL (optional)

If you already run the dev server elsewhere:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 npx playwright test
```

Disable the built-in `webServer` by commenting it out in `playwright.config.ts` if you only use an external server.

## Pages included

Matches all Vite HTML entries: root `index.html`, `pages/index.html`, `pages/poi-1.html` … `poi-6.html`, `live-feed.html`, `summary.html`, `sources.html`, `terms.html`.

## Notes

- External iframes (e.g. live facescan) may load slowly; the script waits on `domcontentloaded`, not full network idle.
- Cookie banner: the test accepts cookies on the first page when the banner is shown so “Din data” can appear on the homepage in the recording.
- **Google Translate** is blocked during the walkthrough (`translate.google.com`). Loading that script can replace the page and break Playwright with `Execution context was destroyed`. The recording still covers the site; only the translate widget is skipped.

## Troubleshooting

- **`http://127.0.0.1:5173 is already used`:** Another dev server is running. Playwright is configured to **reuse** the existing server (unless `PLAYWRIGHT_FORCE_NEW_SERVER=1` is set).
- **Video path:** After a successful run, the terminal lists the `.webm` under `test-results/…/video.webm`, or open `npx playwright show-report`.
