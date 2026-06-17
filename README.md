# Leo's Library

Quartz 5 personal knowledge site for <https://yaohua-leo.github.io/>.

## Local Commands

```powershell
npm ci
npx quartz build
npx quartz build --serve
```

## Publishing Rules

This repository is public. Only add content that is safe to publish.

- Markdown pages must include `publish: true` in frontmatter before Quartz includes them in the site.
- Keep private diaries, private PDFs, drafts, and unreviewed exports out of this repository.
- Put public PDFs under `content/assets/pdf/` and link them from a published Markdown page.

## Comments

Comments use Giscus through GitHub Discussions in `Yaohua-Leo/yaohua-leo.github.io`.
The repo and category IDs are configured in `quartz.config.yaml`.

The Giscus GitHub App must be installed for the repository before comments can render and write discussions.
