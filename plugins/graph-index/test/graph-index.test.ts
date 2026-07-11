import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import type { BuildCtx, ProcessedContent } from "@quartz-community/types"
import { VFile } from "vfile"
import { buildGraphIndex, GraphIndex } from "../src/index"

const options = {
  includeUnlistedPrefixes: ["notes/archive/raw/"],
}

const makeContent = (
  relativePath: string,
  slug: string,
  { unlisted = false, links = [], tags = [] as string[] } = {},
): ProcessedContent => {
  const file = new VFile()
  file.data = {
    relativePath,
    slug,
    unlisted,
    links,
    frontmatter: { title: slug, tags },
  }
  return [{ type: "root", children: [] }, file] as ProcessedContent
}

test("includes selected raw pages without including unrelated unlisted pages", () => {
  const index = buildGraphIndex(
    [
      makeContent("about.md", "about", { links: ["notes/topic"] }),
      makeContent("notes/archive/raw/source.md", "notes/archive/raw/source", {
        unlisted: true,
        links: ["notes/topic"],
        tags: ["archive"],
      }),
      makeContent("notes/private.md", "notes/private", { unlisted: true }),
    ],
    options,
  )

  assert.deepEqual(Object.keys(index), ["about", "notes/archive/raw/source"])
  assert.deepEqual(index["notes/archive/raw/source"], {
    title: "notes/archive/raw/source",
    links: ["notes/topic"],
    tags: ["archive"],
  })
  assert.equal("content" in index["notes/archive/raw/source"], false)
  assert.equal("filePath" in index["notes/archive/raw/source"], false)
})

test("emits a metadata-only graph index", async () => {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), "graph-index-"))
  const plugin = GraphIndex(options)
  const content = [
    makeContent("notes/archive/raw/source.md", "notes/archive/raw/source", {
      unlisted: true,
    }),
  ]

  await plugin.emit({ argv: { output } } as BuildCtx, content, {
    css: [],
    js: [],
    additionalHead: [],
  })

  const emitted = JSON.parse(
    await fs.readFile(path.join(output, "static", "graphIndex.json"), "utf8"),
  )
  assert.deepEqual(Object.keys(emitted), ["notes/archive/raw/source"])
})
