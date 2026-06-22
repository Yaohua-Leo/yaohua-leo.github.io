import assert from "node:assert"
import test, { describe } from "node:test"
import { normalizeMarkdownBlankLines } from "./publish-maoxuan-resources.mjs"

describe("normalizeMarkdownBlankLines", () => {
  test("turns ideographic-space-only separators into real Markdown blank lines", () => {
    const input = [">[!info] 读者注", "> 说明文字", "　　", "　　正文段落", ""].join("\n")

    const output = normalizeMarkdownBlankLines(input)

    assert.strictEqual(output, [">[!info] 读者注", "> 说明文字", "", "　　正文段落", ""].join("\n"))
  })

  test("preserves ideographic indentation on non-empty body lines", () => {
    assert.strictEqual(
      normalizeMarkdownBlankLines("　　[[地主阶级]]和[[买办阶级]]。"),
      "　　[[地主阶级]]和[[买办阶级]]。",
    )
  })

  test("normalizes mixed whitespace-only lines", () => {
    assert.strictEqual(normalizeMarkdownBlankLines("before\n \t　 \nafter"), "before\n\nafter")
  })
})
