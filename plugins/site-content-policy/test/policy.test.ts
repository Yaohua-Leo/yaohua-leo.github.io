import assert from "node:assert/strict"
import test from "node:test"
import { VFile } from "vfile"
import { applySiteContentPolicy } from "../src/index"

const options = {
  unlistedPrefixes: ["notes/archive/raw/"],
  listedPaths: ["notes/archive/raw/index.md"],
  unlistedPaths: ["notes/archive/legacy-index.md"],
  commentsDisabledPrefixes: ["notes/archive/raw/"],
  languageByPrefix: { "notes/archive/": "zh-CN" },
}

test("unlists raw archive pages while preserving direct publication metadata", () => {
  const file = new VFile()
  file.data = {
    relativePath: "notes/archive/raw/source.md",
    frontmatter: { publish: true },
  }

  applySiteContentPolicy(file, options)

  assert.equal(file.data.unlisted, true)
  assert.deepEqual(file.data.frontmatter, {
    publish: true,
    unlisted: true,
    comments: false,
    lang: "zh-CN",
  })
})

test("keeps the archive landing listed but disables comments", () => {
  const file = new VFile()
  file.data = {
    relativePath: "notes/archive/raw/index.md",
    frontmatter: { publish: true },
  }

  applySiteContentPolicy(file, options)

  assert.equal(file.data.unlisted, undefined)
  assert.deepEqual(file.data.frontmatter, {
    publish: true,
    comments: false,
    lang: "zh-CN",
  })
})

test("unlists legacy indexes without changing unrelated content", () => {
  const legacy = new VFile()
  legacy.data = {
    relativePath: "notes/archive/legacy-index.md",
    frontmatter: { publish: true },
  }
  applySiteContentPolicy(legacy, options)
  assert.equal(legacy.data.unlisted, true)

  const unrelated = new VFile()
  unrelated.data = {
    relativePath: "projects/current.md",
    frontmatter: { publish: true, lang: "en" },
  }
  applySiteContentPolicy(unrelated, options)
  assert.equal(unrelated.data.unlisted, undefined)
  assert.deepEqual(unrelated.data.frontmatter, { publish: true, lang: "en" })
})
