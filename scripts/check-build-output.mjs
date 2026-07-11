import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const publicDir = path.join(repoRoot, "public")
const rawSourceDir = path.join(repoRoot, "content", "notes", "maoxuan", "resource")

const rawPrefix = "notes/maoxuan/resource/"
const rawSlug = `${rawPrefix}000-中国社会各阶级的分析`
const archiveIndexSlug = `${rawPrefix}index`
const legacyIndexSlug = "notes/maoxuan/notes-maoxuan-resourse"
const expectedNeighbour = "notes/maoxuan/两种倾向"
const allowedGraphFields = new Set(["title", "links", "tags"])

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

const readJson = async (filePath) => JSON.parse(await fs.readFile(filePath, "utf8"))

const collectFiles = async (directory) => {
  const files = []
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await collectFiles(entryPath)))
    else files.push(entryPath)
  }
  return files
}

const contentIndex = await readJson(path.join(publicDir, "static", "contentIndex.json"))
const graphIndex = await readJson(path.join(publicDir, "static", "graphIndex.json"))
const contentKeys = Object.keys(contentIndex)
const graphKeys = Object.keys(graphIndex)

const rawMarkdownCount = (await fs.readdir(rawSourceDir)).filter(
  (name) => name.endsWith(".md") && name !== "index.md",
).length
const contentRawKeys = contentKeys.filter((key) => key.startsWith(rawPrefix))
const graphRawKeys = graphKeys.filter((key) => key.startsWith(rawPrefix))

assert(
  contentRawKeys.length === 1 && contentRawKeys[0] === archiveIndexSlug,
  "Search index must contain only the public archive landing under the raw-resource prefix",
)
assert(!(rawSlug in contentIndex), "Representative raw source leaked into the search index")
assert(rawSlug in graphIndex, "Representative raw source is missing from the graph index")
assert(
  graphRawKeys.length === rawMarkdownCount + 1,
  `Graph index has ${graphRawKeys.length} raw entries; expected ${rawMarkdownCount + 1}`,
)
assert(!(legacyIndexSlug in contentIndex), "Legacy archive index leaked into search")
assert(!(legacyIndexSlug in graphIndex), "Legacy archive index leaked into Graph")
assert("about" in contentIndex && "about" in graphIndex, "Listed pages must remain in both indexes")

for (const [slug, entry] of Object.entries(graphIndex)) {
  const fields = Object.keys(entry)
  assert(
    fields.every((field) => allowedGraphFields.has(field)),
    `Graph entry ${slug} contains a discovery-only or content field: ${fields.join(", ")}`,
  )
}

assert(
  graphIndex[rawSlug].links.includes(expectedNeighbour),
  "Representative raw source lost its expected graph edge",
)
assert(expectedNeighbour in graphIndex, "Representative graph edge points to a missing node")

const rawHtml = await fs.readFile(path.join(publicDir, `${rawSlug}.html`), "utf8")
assert(rawHtml.includes('class="graph"'), "Raw source page is missing the Graph component")
assert(
  rawHtml.includes('<meta name="robots" content="noindex, nofollow"'),
  "Raw source page lost its noindex metadata",
)
assert(!rawHtml.includes("giscus"), "Raw source page unexpectedly enables comments")
assert(
  rawHtml.includes("static/contentIndex.json"),
  "Search must continue to load the public content index",
)

for (const feed of ["sitemap.xml", "index.xml"]) {
  const content = await fs.readFile(path.join(publicDir, feed), "utf8")
  assert(!content.includes(`${rawPrefix}000-`), `${feed} exposes a raw source page`)
}

const graphScripts = []
for (const filePath of await collectFiles(publicDir)) {
  if (!filePath.endsWith(".js")) continue
  const source = await fs.readFile(filePath, "utf8")
  if (source.includes("static/graphIndex.json")) graphScripts.push({ filePath, source })
}

assert(graphScripts.length === 1, `Expected one Graph data loader, found ${graphScripts.length}`)
assert(
  !graphScripts[0].source.includes("await fetchData"),
  "Graph bundle still reads the searchable content index",
)

console.log(
  `Build output validation passed: ${contentKeys.length} searchable pages, ${graphKeys.length} graph nodes, ${rawMarkdownCount} raw sources isolated from discovery.`,
)
