import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parseDocument } from "yaml"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const contentRoot = path.join(repoRoot, "content")
const legacyPrefixes = ["notes/maoxuan/"]
const privatePathSegments = new Set([
  "diary",
  "drafts",
  "journal",
  "private",
  "secrets",
  "sensitive",
])

async function listMarkdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listMarkdownFiles(fullPath)))
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath)
    }
  }

  return files.sort()
}

function relativeContentPath(filePath) {
  return path.relative(contentRoot, filePath).split(path.sep).join("/")
}

function isLegacy(relativePath) {
  return legacyPrefixes.some((prefix) => relativePath.startsWith(prefix))
}

function parseFrontmatter(source, relativePath) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!match) {
    throw new Error(`${relativePath}: missing or unclosed YAML frontmatter`)
  }

  const document = parseDocument(match[1], { uniqueKeys: true })
  if (document.errors.length > 0) {
    throw new Error(`${relativePath}: invalid YAML: ${document.errors[0].message}`)
  }

  const data = document.toJS()
  if (data === null || Array.isArray(data) || typeof data !== "object") {
    throw new Error(`${relativePath}: frontmatter must be a YAML mapping`)
  }

  return { data, body: source.slice(match[0].length) }
}

function markdownH1s(body) {
  const headings = []
  const lines = body.split(/\r?\n/)
  let fence = null

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    const fenceMatch = line.match(/^\s{0,3}(`{3,}|~{3,})/)
    if (fenceMatch) {
      const marker = fenceMatch[1][0]
      if (fence === null) fence = marker
      else if (fence === marker) fence = null
      continue
    }
    if (fence !== null) continue

    const atx = line.match(/^\s{0,3}#\s+(.+?)\s*#*\s*$/)
    if (atx) {
      headings.push(atx[1].trim())
      continue
    }

    if (line.trim() && /^\s{0,3}=+\s*$/.test(lines[index + 1] ?? "")) {
      headings.push(line.trim())
      index++
    }
  }

  return headings
}

function normalizedTitle(value) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ")
}

function isIsoDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function validateModernPage(relativePath, data, body, warnings, titleFiles) {
  if (data.description !== undefined && typeof data.description !== "string") {
    throw new Error(`${relativePath}: description must be a string when present`)
  }
  if (data.publish && (!data.description || data.description.trim() === "")) {
    warnings.push(`${relativePath}: add a concise description for search and link previews`)
  }
  if (data.lang !== undefined && typeof data.lang !== "string") {
    throw new Error(`${relativePath}: lang must be a string when present`)
  }
  if (data.publish && (!data.lang || data.lang.trim() === "")) {
    warnings.push(`${relativePath}: add an explicit lang value (for example, en or zh-CN)`)
  }
  if (data.type !== undefined && typeof data.type !== "string") {
    throw new Error(`${relativePath}: type must be a string when present`)
  }
  if (data.status !== undefined && typeof data.status !== "string") {
    throw new Error(`${relativePath}: status must be a string when present`)
  }
  if (data.featured !== undefined && typeof data.featured !== "boolean") {
    throw new Error(`${relativePath}: featured must be true or false when present`)
  }
  for (const field of ["created", "updated"]) {
    if (data[field] !== undefined && !isIsoDate(data[field])) {
      throw new Error(`${relativePath}: ${field} must use YYYY-MM-DD format when present`)
    }
  }
  if (data.created && data.updated && data.updated < data.created) {
    throw new Error(`${relativePath}: updated date must not be earlier than created date`)
  }
  if (data.publish) {
    for (const field of ["type", "status", "created", "updated"]) {
      if (data[field] === undefined) {
        warnings.push(`${relativePath}: add ${field} metadata to this published page`)
      }
    }
  }

  const key = normalizedTitle(data.title)
  const matches = titleFiles.get(key) ?? []
  matches.push(relativePath)
  titleFiles.set(key, matches)

  const headings = markdownH1s(body)
  if (headings.length > 1) {
    warnings.push(`${relativePath}: contains ${headings.length} level-one headings`)
  }
  if (headings.some((heading) => normalizedTitle(heading) === key)) {
    warnings.push(
      `${relativePath}: repeats the frontmatter title as an H1; Quartz already renders the article title`,
    )
  }
}

async function main() {
  const files = await listMarkdownFiles(contentRoot)
  const errors = []
  const warnings = []
  const titleFiles = new Map()
  let legacyCount = 0

  for (const filePath of files) {
    const relativePath = relativeContentPath(filePath)
    const legacy = isLegacy(relativePath)
    if (legacy) legacyCount++

    try {
      const source = await readFile(filePath, "utf8")
      const { data, body } = parseFrontmatter(source, relativePath)

      if (!legacy && (typeof data.title !== "string" || data.title.trim() === "")) {
        throw new Error(`${relativePath}: title must be a non-empty string`)
      }
      if (legacy && data.title !== undefined && typeof data.title !== "string") {
        throw new Error(`${relativePath}: title must be a string when present`)
      }
      if (!legacy && typeof data.publish !== "boolean") {
        throw new Error(`${relativePath}: publish must be explicitly set to true or false`)
      }
      if (legacy && data.publish !== undefined && typeof data.publish !== "boolean") {
        throw new Error(`${relativePath}: publish must be true or false when present`)
      }
      if (data.tags !== undefined && !Array.isArray(data.tags)) {
        throw new Error(`${relativePath}: tags must be a YAML list when present`)
      }
      if (!legacy && data.tags?.some((tag) => typeof tag !== "string")) {
        throw new Error(`${relativePath}: every tag must be a string`)
      }

      const pathSegments = relativePath.toLocaleLowerCase().split("/")
      const privateSegment = pathSegments.find((segment) => privatePathSegments.has(segment))
      if (privateSegment) {
        throw new Error(
          `${relativePath}: content inside a public repository must not live in a "${privateSegment}" directory`,
        )
      }

      if (!legacy) {
        validateModernPage(relativePath, data, body, warnings, titleFiles)
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `${relativePath}: ${String(error)}`)
    }
  }

  for (const duplicates of titleFiles.values()) {
    if (duplicates.length > 1) {
      warnings.push(`duplicate frontmatter title: ${duplicates.join(", ")}`)
    }
  }

  for (const warning of warnings) console.warn(`warning: ${warning}`)
  for (const error of errors) console.error(`error: ${error}`)

  const checkedCount = files.length - legacyCount
  console.log(
    `Checked ${checkedCount} current page(s); accepted ${legacyCount} legacy Maoxuan page(s) with baseline checks only.`,
  )

  if (errors.length > 0) {
    console.error(`Content validation failed with ${errors.length} error(s).`)
    process.exitCode = 1
  } else {
    console.log(`Content validation passed with ${warnings.length} advisory warning(s).`)
  }
}

await main()
