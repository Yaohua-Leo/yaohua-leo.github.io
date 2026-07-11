# Yaohua (Leo)

Academic homepage and public research notebook for [Yaohua (Leo)](https://yaohua-leo.github.io/), built with Quartz 5.

The site focuses on Jordan algebras, Quillen (co)homology, formalization in mathlib, and AI-assisted mathematics. Selected reading archives live alongside the research material without entering the site's primary discovery surfaces.

## Content Structure

- `content/research/` — research directions and explanatory overviews
- `content/projects/` — active research, formalization, and workflow projects
- `content/writing/` — self-contained essays and expository notes
- `content/reading/` — reading collections and curated entry points
- `content/notes/maoxuan/` — Chinese-language concept notes and a source-text archive

Raw source-text pages under `content/notes/maoxuan/resource/` remain available by direct URL. The local `site-content-policy` plugin excludes them from Explorer, search, graph, RSS, sitemap, folder listings, comments, and indexing metadata so they do not dominate the academic homepage.

## Local Commands

```powershell
npm ci
npm run dev
npm run verify
npm run build
```

Create a structured draft with:

```powershell
npm run new:note -- --title "My note" --type research-note --area jordan-algebra
```

Available note types are `research-note`, `exposition`, `project`, and `reading-note`. New notes default to `publish: false` and `status: seed`.

## Publishing Rules

This repository is public. A file is not private merely because Quartz does not publish it.

- Keep private diaries, sensitive PDFs, credentials, and unreviewed research outside this repository.
- A Markdown page must include an explicit `publish: true` before Quartz includes it.
- Use `status` to describe maturity and `featured` to control editorial prominence; do not overload `publish` for those purposes.
- Put public PDFs under `content/assets/pdf/` and link them from a published page.
- Run `npm run verify` before opening a pull request.

## Validation and Deployment

Pull requests run content validation, type checking, formatting, tests, and a complete Quartz build. Pushes to `main` repeat those checks before deploying to GitHub Pages.

Comments use Giscus through GitHub Discussions in `Yaohua-Leo/yaohua-leo.github.io`. They are disabled on the homepage, folder indexes, tags, and archived source-text pages.
