# Shopify Compressor Pro — Demo Video Script

**Target length:** 2–3 minutes
**Format:** Screen recording with voiceover (or captions)
**Tool:** QuickTime screen recording, OBS, or Loom

---

## Pre-recording Setup

1. Open a terminal with a clean prompt
2. Have a Shopify theme project ready with some uncompressed assets in an `input/` folder (a few images, JS files, CSS, a Liquid template)
3. Make sure `shopify-compressor-pro` is installed globally or via npx
4. Have the free version output ready to compare (or just run both live)

---

## Script

### [0:00–0:15] Intro

**Show:** Terminal or title slide

> "Shopify Compressor Pro is a CLI tool that optimises your Shopify theme assets — images, JavaScript, CSS, SVGs, and Liquid templates. Let me show you what it does."

---

### [0:15–0:40] Show the source files

**Show:** `ls input/` — show the files and their sizes

```bash
ls -lh input/
```

> "Here we have a typical Shopify theme's assets — some hero images, JavaScript bundles, stylesheets, and Liquid templates. Let's see the total size."

```bash
du -sh input/
```

---

### [0:40–1:00] Run a basic build (free version comparison)

**Show:** Run with the free version first (optional — skip if time-constrained)

```bash
scomp-pro build
```

> "Running the free version processes files one at a time. It works, but on larger themes it can be slow."

---

### [1:00–1:30] Run Pro build with parallel processing + report

**Show:** The Pro build command

```bash
scomp-pro build --parallel --report html
```

> "With Pro, we add `--parallel` for multi-core processing and `--report html` to generate a build report. Watch how much faster it runs."

**Show:** The terminal output — file counts, sizes, compression ratios, timing

> "Done in under 2 seconds. Images compressed by 60%, JS minified by 40%, CSS down by 50%."

---

### [1:30–1:50] Show the HTML report

**Show:** Open the generated HTML report in the browser

```bash
open reports/shopify-compressor-report.html
```

> "The HTML report gives you a full dashboard — total savings, per-type breakdowns, and if you have history enabled, build-over-build trends."

**Pan across:** Summary stats, the compression bars, the per-type tables

---

### [1:50–2:15] Show asset budgets

**Show:** Run with budget enforcement

```bash
scomp-pro build --parallel --budget "js:50KB,css:30KB" --fail-on-budget
```

> "Asset budgets let you set size limits. Here we're saying JS can't exceed 50KB total and CSS can't exceed 30KB. If a budget is exceeded, the build fails — perfect for CI pipelines."

**Show:** The budget pass/fail output in the terminal

---

### [2:15–2:30] CI/CD mention

> "In CI, just set the `SCOMP_PRO_LICENSE_KEY` environment variable — no interactive activation needed. Add the build step to your GitHub Actions or GitLab CI config and asset budgets will gate your deployments."

**Show:** (Optional) A quick flash of the GitHub Actions YAML from the README

---

### [2:30–2:45] Wrap up

> "Shopify Compressor Pro — faster builds, rich reports, and budget enforcement for your Shopify themes. Free version available on npm, Pro starts at $29 per year. Links in the description."

---

## Recording Tips

- **Resolution:** 1920×1080 minimum
- **Terminal font size:** 16pt+ so it's readable
- **Use a dark terminal theme** — it looks better on video
- **Pre-run the commands once** so caches are warm and you don't wait for npm installs on camera
- **Keep it brisk** — no long pauses, cut dead air in editing
- **Add captions** if you don't want to do voiceover — Loom and YouTube can auto-generate them

## Upload

Upload to YouTube (unlisted is fine) or Loom and share the link with LemonSqueezy.
