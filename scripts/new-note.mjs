import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { parseArgs } from "node:util"
import { fileURLToPath } from "node:url"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const contentRoot = path.join(repoRoot, "content")
const typeDirectories = {
  exposition: "writing",
  project: "projects",
  "reading-note": "reading",
  "research-note": "research",
}

function usage() {
  return `Usage:
  npm run new:note -- --title "Note title" [options]

Options:
  --type <type>       research-note, exposition, project, or reading-note
  --dir <directory>   Override the content subdirectory
  --slug <slug>       Override the generated filename
  --lang <language>   Language tag (default: en)
  --area <area>       Research or subject area (default: general)
  --publish           Create the note with publish: true (default: false)
  --help              Show this help
`
}

function slugify(value) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
}

function safeRelativeDirectory(value) {
  const normalized = path.posix.normalize(value.replaceAll("\\", "/")).replace(/^\.\//, "")
  if (
    normalized === "" ||
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    path.posix.isAbsolute(normalized)
  ) {
    throw new Error(`Invalid content directory: ${value}`)
  }
  return normalized
}

function yamlString(value) {
  return JSON.stringify(value)
}

async function main() {
  const { values } = parseArgs({
    options: {
      area: { type: "string", default: "general" },
      dir: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
      lang: { type: "string", default: "en" },
      publish: { type: "boolean", default: false },
      slug: { type: "string" },
      title: { type: "string", short: "t" },
      type: { type: "string", default: "research-note" },
    },
    strict: true,
  })

  if (values.help) {
    console.log(usage())
    return
  }
  if (!values.title?.trim()) {
    throw new Error(`--title is required\n\n${usage()}`)
  }
  if (!(values.type in typeDirectories)) {
    throw new Error(
      `Unknown note type "${values.type}". Choose one of: ${Object.keys(typeDirectories).join(", ")}`,
    )
  }

  const directory = safeRelativeDirectory(values.dir ?? typeDirectories[values.type])
  const slug = slugify(values.slug ?? values.title)
  if (!slug) throw new Error("The title or --slug must contain at least one letter or number")

  const destinationDirectory = path.resolve(contentRoot, directory)
  if (!destinationDirectory.startsWith(`${contentRoot}${path.sep}`)) {
    throw new Error(`Content directory escapes content/: ${directory}`)
  }

  const destination = path.join(destinationDirectory, `${slug}.md`)
  const today = new Date().toISOString().slice(0, 10)
  const note = `---
title: ${yamlString(values.title.trim())}
description: ""
lang: ${yamlString(values.lang)}
type: ${yamlString(values.type)}
area: ${yamlString(values.area)}
status: seed
created: ${today}
updated: ${today}
publish: ${values.publish}
featured: false
tags: []
---

## Question

What is the main question or claim?

## Notes

Develop the idea, evidence, or argument here.

## Next step

- [ ] Add the next concrete action.
`

  await mkdir(destinationDirectory, { recursive: true })
  await writeFile(destination, note, { encoding: "utf8", flag: "wx" })
  console.log(`Created ${path.relative(repoRoot, destination)}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
