import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const resourceRoot = path.join(root, "content", "notes", "maoxuan", "resource")
const contentIndexFile = path.join(root, "content", "notes", "maoxuan", "notes-maoxuan-resourse.md")
const resourceIndexFile = path.join(resourceRoot, "index.md")

const sourceRepo = "https://github.com/weiyinfu/MaoZeDongAnthology"
const sourceCommit = "f23ff5c48d976561f888c6ce8c594725d5670e38"

function encodePathSegmented(relativePath) {
  return relativePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
}

async function listMarkdownFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const nested = await listMarkdownFiles(fullPath)
      files.push(...nested.map((file) => path.join(entry.name, file)))
    } else if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== "index.md") {
      files.push(entry.name)
    }
  }

  return files.sort((a, b) => a.localeCompare(b, "zh-Hans-CN", { numeric: true }))
}

function resourceMarkdownHref(relativePath) {
  return `resource/${encodePathSegmented(relativePath.replaceAll("\\", "/"))}`
}

async function assertResourcesExist() {
  const resourceStats = await stat(resourceRoot)
  if (!resourceStats.isDirectory()) {
    throw new Error(`Expected resource directory: ${resourceRoot}`)
  }
}

function titleFromFile(relativePath) {
  return path.basename(relativePath, ".md")
}

function frontmatterFor(relativePath) {
  return `---
title: ${JSON.stringify(titleFromFile(relativePath))}
publish: true
tags:
  - maoxuan
  - resource
---

`
}

function hasFrontmatter(content) {
  return content.startsWith("---\n") || content.startsWith("---\r\n")
}

function ensurePublishedFrontmatter(relativePath, content) {
  let updated = content.replace(
    /This file is kept under `content\/notes\/maoxuan\/resource\/` as reading source material and intentionally has no `publish: true` frontmatter\./g,
    "This file is kept under `content/notes/maoxuan/resource/` as published reading source material.",
  )
  updated = updated.replace(
    /The copied Markdown files are intentionally not marked with `publish: true`, so Quartz's explicit-publish filter should keep them out of the public site unless they are deliberately reviewed and published later\./g,
    "The copied Markdown files are deliberately marked with `publish: true` so Quartz publishes the `resource` folder and its contents in the site explorer.",
  )

  if (hasFrontmatter(updated)) {
    return updated
  }

  return `${frontmatterFor(relativePath)}${updated}`
}

async function prepareResourceFiles(files) {
  for (const file of files) {
    const fullPath = path.join(resourceRoot, file)
    const content = await readFile(fullPath, "utf8")
    const updated = ensurePublishedFrontmatter(file, content)
    if (updated !== content) {
      await writeFile(fullPath, updated, "utf8")
    }
  }
}

async function writeResourceIndex(files) {
  const items = files
    .map((file) => `- [${file}](${encodePathSegmented(file.replaceAll("\\", "/"))})`)
    .join("\n")

  const content = `---
title: Maoxuan Resources
date: 2026-06-19
publish: true
tags:
  - maoxuan
  - resource
---

# Maoxuan Resources

This folder publishes the Markdown reading resources copied from [weiyinfu/MaoZeDongAnthology](${sourceRepo}) at commit \`${sourceCommit}\`.

- Published Markdown page count: ${files.length}
- Attribution: [ATTRIBUTION.md](ATTRIBUTION.md)

## Published Files

${items}
`

  await writeFile(resourceIndexFile, content, "utf8")
}

async function writeContentIndex() {
  await assertResourcesExist()
  const files = await listMarkdownFiles(resourceRoot)
  await prepareResourceFiles(files)
  await writeResourceIndex(files)

  const items = files
    .map((file) => {
      return `- [${file}](${resourceMarkdownHref(file)})`
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

This page indexes the Maoxuan reading resources copied from [weiyinfu/MaoZeDongAnthology](${sourceRepo}) at commit \`${sourceCommit}\`.

- Open the folder page: [resource](/notes/maoxuan/resource/index.md)
- Attribution: [ATTRIBUTION.md](resource/ATTRIBUTION.md)
- Published Markdown page count: ${files.length}

## Published Markdown Files

${items}
`

  await mkdir(path.dirname(contentIndexFile), { recursive: true })
  await writeFile(contentIndexFile, content, "utf8")
  console.log(
    `Prepared ${files.length} resource pages and wrote ${path.relative(root, contentIndexFile)} plus ${path.relative(root, resourceIndexFile)}.`,
  )
}

async function copyPublicResources() {
  console.log(
    "Maoxuan resources are published by Quartz content pages; no public copy step is needed.",
  )
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
