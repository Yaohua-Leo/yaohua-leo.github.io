import type { Root as HastRoot } from "hast"
import type { QuartzTransformerPlugin } from "@quartz-community/types"
import type { PluggableList, Plugin } from "unified"
import type { VFile } from "vfile"

export interface SiteContentPolicyOptions {
  unlistedPrefixes?: string[]
  listedPaths?: string[]
  unlistedPaths?: string[]
  commentsDisabledPrefixes?: string[]
  commentsDisabledPaths?: string[]
  languageByPrefix?: Record<string, string>
}

const normalizePath = (value: unknown): string =>
  typeof value === "string" ? value.replaceAll("\\", "/").replace(/^\.\//, "") : ""

const matchesPrefix = (relativePath: string, prefixes: string[] = []): boolean =>
  prefixes.some((prefix) => relativePath.startsWith(normalizePath(prefix)))

const matchesPath = (relativePath: string, paths: string[] = []): boolean =>
  paths.some((candidate) => relativePath === normalizePath(candidate))

export function applySiteContentPolicy(file: VFile, options: SiteContentPolicyOptions = {}): void {
  const data = file.data as Record<string, unknown>
  const relativePath = normalizePath(data.relativePath)
  if (!relativePath) return

  const frontmatter = (data.frontmatter ?? {}) as Record<string, unknown>
  data.frontmatter = frontmatter

  const explicitlyListed = matchesPath(relativePath, options.listedPaths)
  const isUnlisted =
    matchesPath(relativePath, options.unlistedPaths) ||
    (!explicitlyListed && matchesPrefix(relativePath, options.unlistedPrefixes))

  if (isUnlisted) {
    data.unlisted = true
    frontmatter.unlisted = true
  }

  const commentsDisabled =
    isUnlisted ||
    matchesPath(relativePath, options.commentsDisabledPaths) ||
    matchesPrefix(relativePath, options.commentsDisabledPrefixes)

  if (commentsDisabled) {
    frontmatter.comments = false
  }

  if (typeof frontmatter.lang !== "string") {
    for (const [prefix, language] of Object.entries(options.languageByPrefix ?? {})) {
      if (relativePath.startsWith(normalizePath(prefix))) {
        frontmatter.lang = language
        break
      }
    }
  }
}

const rehypeSiteContentPolicy = (options: SiteContentPolicyOptions): Plugin<[], HastRoot> => {
  return () => (_tree: HastRoot, file: VFile) => {
    applySiteContentPolicy(file, options)
  }
}

export const SiteContentPolicy: QuartzTransformerPlugin<SiteContentPolicyOptions> = (options) => {
  return {
    name: "SiteContentPolicy",
    htmlPlugins(): PluggableList {
      return [rehypeSiteContentPolicy(options ?? {})]
    },
  }
}
