import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const resourceRoot = path.join(root, "content", "notes", "maoxuan", "resource")
const resourceSrc = path.join(resourceRoot, "src")
const attributionFile = path.join(resourceRoot, "ATTRIBUTION.md")
const contentIndexFile = path.join(root, "content", "notes", "maoxuan", "notes-maoxuan-resourse.md")
const publicResourceRoot = path.join(root, "public", "notes", "maoxuan", "resource")

const sourceRepo = "https://github.com/weiyinfu/MaoZeDongAnthology"
const sourceCommit = "f23ff5c48d976561f888c6ce8c594725d5670e38"

function encodePathSegmented(relativePath) {
  return relativePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
}

function htmlEscape(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

async function listMarkdownFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const nested = await listMarkdownFiles(fullPath)
      files.push(...nested.map((file) => path.join(entry.name, file)))
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(entry.name)
    }
  }

  return files.sort((a, b) => a.localeCompare(b, "zh-Hans-CN", { numeric: true }))
}

function publicHref(relativePath) {
  return `/notes/maoxuan/resource/${encodePathSegmented(relativePath.replaceAll("\\", "/"))}`
}

async function assertResourcesExist() {
  const [srcStats, attributionStats] = await Promise.all([stat(resourceSrc), stat(attributionFile)])
  if (!srcStats.isDirectory()) {
    throw new Error(`Expected source directory: ${resourceSrc}`)
  }
  if (!attributionStats.isFile()) {
    throw new Error(`Expected attribution file: ${attributionFile}`)
  }
}

async function writeContentIndex() {
  await assertResourcesExist()
  const files = await listMarkdownFiles(resourceSrc)
  const items = files
    .map((file) => {
      const relativePath = `src/${file.replaceAll("\\", "/")}`
      return `- [${file}](${publicHref(relativePath)})`
    })
    .join("\n")

  const content = `---
title: notes-maoxuan-resourse
date: 2026-06-19
publish: true
tags:
  - maoxuan
  - resource
---

# notes-maoxuan-resourse

This page publishes the raw Markdown reading resources copied from [weiyinfu/MaoZeDongAnthology](${sourceRepo}) at commit \`${sourceCommit}\`.

- [ATTRIBUTION.md](${publicHref("ATTRIBUTION.md")})
- Source file count: ${files.length}

## Source Markdown Files

${items}
`

  await mkdir(path.dirname(contentIndexFile), { recursive: true })
  await writeFile(contentIndexFile, content, "utf8")
  console.log(`Wrote ${path.relative(root, contentIndexFile)} with ${files.length} resource links.`)
}

async function copyPublicResources() {
  await assertResourcesExist()
  const files = await listMarkdownFiles(resourceSrc)

  await rm(publicResourceRoot, { recursive: true, force: true })
  await mkdir(path.join(publicResourceRoot, "src"), { recursive: true })

  await copyFile(attributionFile, path.join(publicResourceRoot, "ATTRIBUTION.md"))
  for (const file of files) {
    await copyFile(path.join(resourceSrc, file), path.join(publicResourceRoot, "src", file))
  }

  await writeFile(path.join(publicResourceRoot, "index.html"), renderHtmlIndex(files), "utf8")
  console.log(
    `Copied ${files.length} Markdown files and ATTRIBUTION.md into ${path.relative(root, publicResourceRoot)}.`,
  )
}

function renderHtmlIndex(files) {
  const links = files
    .map((file) => {
      const href = `src/${encodePathSegmented(file)}`
      return `<li><a href="${href}">${htmlEscape(file)}</a></li>`
    })
    .join("\n")

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>notes-maoxuan-resourse</title>
  <style>
    body {
      max-width: 960px;
      margin: 48px auto;
      padding: 0 24px 48px;
      color: #221b17;
      background: #fbf7ef;
      font: 16px/1.65 Georgia, "Times New Roman", serif;
    }

    h1 {
      margin-bottom: 0.25rem;
      font-size: clamp(2rem, 4vw, 3.25rem);
      line-height: 1.05;
    }

    .meta {
      color: #665a50;
      margin-bottom: 2rem;
    }

    a {
      color: #7b241c;
    }

    li {
      margin: 0.35rem 0;
    }
  </style>
</head>
<body>
  <h1>notes-maoxuan-resourse</h1>
  <p class="meta">
    Raw Markdown reading resources copied from
    <a href="${sourceRepo}">weiyinfu/MaoZeDongAnthology</a>
    at commit <code>${sourceCommit}</code>.
  </p>
  <p><a href="ATTRIBUTION.md">ATTRIBUTION.md</a></p>
  <ol>
${links}
  </ol>
</body>
</html>
`
}

const mode = process.argv[2]

if (mode === "--content-index") {
  await writeContentIndex()
} else if (mode === "--public") {
  await copyPublicResources()
} else {
  console.error("Usage: node scripts/publish-maoxuan-resources.mjs --content-index|--public")
  process.exitCode = 1
}
