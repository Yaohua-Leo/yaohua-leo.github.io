import assert from "node:assert"
import test, { describe } from "node:test"
import {
  normalizeGraphSlug,
  patchGraphDist,
  patchGraphSource,
} from "./patch-quartz-graph-plugin.mjs"

describe("normalizeGraphSlug", () => {
  test("decodes encoded Chinese slugs", () => {
    assert.strictEqual(
      normalizeGraphSlug(
        "notes/maoxuan/resource/000-%E4%B8%AD%E5%9B%BD%E7%A4%BE%E4%BC%9A%E5%90%84%E9%98%B6%E7%BA%A7%E7%9A%84%E5%88%86%E6%9E%90",
      ),
      "notes/maoxuan/resource/000-中国社会各阶级的分析",
    )
  })

  test("strips decoded base path before matching content index keys", () => {
    assert.strictEqual(
      normalizeGraphSlug("library/notes/maoxuan/%E9%99%88%E7%8B%AC%E7%A7%80", "/library"),
      "notes/maoxuan/陈独秀",
    )
  })

  test("strips html suffixes from direct page URLs", () => {
    assert.strictEqual(
      normalizeGraphSlug("notes/maoxuan/%E5%BC%A0%E5%9B%BD%E7%84%98.html"),
      "notes/maoxuan/张国焘",
    )
  })
})

describe("patchQuartzGraphPlugin", () => {
  test("patches graph source slug normalization once", () => {
    const original = `  function getSlugFromUrl() {
    var slug = getFullSlugFromUrl();
    var base = getBasePath();
    if (base && slug.startsWith(base.replace(/^\\//, ""))) {
      slug = slug.slice(base.replace(/^\\//, "").length);
      if (slug.startsWith("/")) slug = slug.slice(1);
    }
    return slug;
  }`

    const patched = patchGraphSource(original)
    assert.match(patched, /decodeURIComponent/)
    assert.strictEqual(patchGraphSource(patched), patched)
  })

  test("patches compiled graph script once", () => {
    const original =
      'before function u(){var a=we(),o=Nu();return o&&a.startsWith(o.replace(/^\\\\//,""))&&(a=a.slice(o.replace(/^\\\\//,"").length),a.startsWith("/")&&(a=a.slice(1))),a} after'

    const patched = patchGraphDist(original)
    assert.match(patched, /decodeURIComponent/)
    assert.strictEqual(patchGraphDist(patched), patched)
  })
})
