# All site URLs

HTML routes match `vite.config.js` (`rollupOptions.input`).

## Script

```bash
# Print every page URL (default base: http://127.0.0.1:5173)
npm run site:urls

# Or against production / preview
BASE_URL=https://your-domain.example npm run site:urls

# With dev server running: verify each URL returns 2xx (or 304)
npm run dev   # other terminal
npm run site:urls:check
```

Shell: `./scripts/site-all-urls.sh` and `./scripts/site-all-urls.sh --check`
