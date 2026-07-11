import fs from "node:fs/promises"
import path from "node:path"
import type {
  BuildCtx,
  FilePath,
  ProcessedContent,
  QuartzEmitterPlugin,
  SimpleSlug,
} from "@quartz-community/types"

export interface GraphIndexOptions {
  outputPath?: string
  includeUnlistedPrefixes?: string[]
}

export interface GraphIndexEntry {
  title: string
  links: SimpleSlug[]
  tags: string[]
}

export type GraphIndexData = Record<string, GraphIndexEntry>

const defaultOptions: Required<GraphIndexOptions> = {
  outputPath: "static/graphIndex.json",
  includeUnlistedPrefixes: [],
}

const normalizePath = (value: unknown): string =>
  typeof value === "string" ? value.replaceAll("\\", "/").replace(/^\.\//, "") : ""

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string")

export function shouldIncludeInGraph(
  data: Record<string, unknown>,
  options: GraphIndexOptions = {},
): boolean {
  if (data.unlisted !== true) return true

  const relativePath = normalizePath(data.relativePath)
  return (options.includeUnlistedPrefixes ?? []).some((prefix) =>
    relativePath.startsWith(normalizePath(prefix)),
  )
}

export function buildGraphIndex(
  content: ProcessedContent[],
  options: GraphIndexOptions = {},
): GraphIndexData {
  const index: GraphIndexData = {}

  for (const [, file] of content) {
    const data = (file.data ?? {}) as Record<string, unknown>
    if (!shouldIncludeInGraph(data, options)) continue

    const slug = data.slug
    if (typeof slug !== "string" || slug.length === 0) continue

    const frontmatter = (data.frontmatter ?? {}) as Record<string, unknown>
    index[slug] = {
      title: typeof frontmatter.title === "string" ? frontmatter.title : "",
      links: isStringArray(data.links) ? (data.links as SimpleSlug[]) : [],
      tags: isStringArray(frontmatter.tags) ? frontmatter.tags : [],
    }
  }

  return index
}

export const GraphIndex: QuartzEmitterPlugin<GraphIndexOptions> = (userOptions) => {
  const options = { ...defaultOptions, ...userOptions }

  const emitAll = async (ctx: BuildCtx, content: ProcessedContent[]): Promise<FilePath[]> => {
    const outputPath = path.join(ctx.argv.output, options.outputPath) as FilePath
    await fs.mkdir(path.dirname(outputPath), { recursive: true })
    await fs.writeFile(outputPath, JSON.stringify(buildGraphIndex(content, options)))
    return [outputPath]
  }

  return {
    name: "GraphIndex",
    emit: emitAll,
    partialEmit: emitAll,
  }
}
