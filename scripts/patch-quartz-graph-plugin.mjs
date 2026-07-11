import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const sourcePath = path.join(
  repoRoot,
  ".quartz",
  "plugins",
  "graph",
  "src",
  "components",
  "scripts",
  "graph.inline.ts",
)
const distPaths = [
  path.join(repoRoot, ".quartz", "plugins", "graph", "dist", "index.js"),
  path.join(repoRoot, ".quartz", "plugins", "graph", "dist", "components", "index.js"),
]

export function normalizeGraphSlug(rawSlug, rawBasePath = "") {
  let slug = decodeGraphSlugPart(rawSlug)
  const base = decodeGraphSlugPart(rawBasePath).replace(/^\//, "")

  if (base && slug.startsWith(base)) {
    slug = slug.slice(base.length)
    if (slug.startsWith("/")) slug = slug.slice(1)
  }

  if (slug.endsWith(".html")) {
    slug = slug.slice(0, -".html".length)
  }

  return slug
}

function decodeGraphSlugPart(value) {
  try {
    return decodeURIComponent(String(value))
  } catch {
    return String(value)
  }
}

const sourceMarker = "function decodeGraphSlugComponent"
const sourcePatch = `  function decodeGraphSlugComponent(value) {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  function getSlugFromUrl() {
    var slug = decodeGraphSlugComponent(getFullSlugFromUrl());
    var base = decodeGraphSlugComponent(getBasePath()).replace(/^\\//, "");
    if (base && slug.startsWith(base)) {
      slug = slug.slice(base.length);
      if (slug.startsWith("/")) slug = slug.slice(1);
    }
    if (slug.endsWith(".html")) slug = slug.slice(0, -".html".length);
    return slug;
  }`

const sourcePattern =
  /  function getSlugFromUrl\(\) \{\r?\n    var slug = getFullSlugFromUrl\(\);\r?\n    var base = getBasePath\(\);\r?\n    if \(base && slug\.startsWith\(base\.replace\(\/\^\\\/\/, ""\)\)\) \{\r?\n      slug = slug\.slice\(base\.replace\(\/\^\\\/\/, ""\)\.length\);\r?\n      if \(slug\.startsWith\("\/"\)\) slug = slug\.slice\(1\);\r?\n    \}\r?\n    return slug;\r?\n  \}/

const sourceDataMarker = "function getGraphData()"
const sourceDataAnchor = "  function loadScript(src) {"
const sourceDataPatch = `  var graphDataPromise;

  function getGraphData() {
    if (!graphDataPromise) {
      graphDataPromise = fetch(resolveBasePath("static/graphIndex.json")).then(function (response) {
        if (!response.ok) {
          throw new Error("[Graph] Failed to load graph index: " + response.status);
        }
        return response.json();
      });
    }
    return graphDataPromise;
  }

  function loadScript(src) {`
const sourceFetchOriginal = "        var dataRaw = await fetchData;"
const sourceFetchPatch = "        var dataRaw = await getGraphData();"

const distSlugMarker = "decodeURIComponent(w)"
const distOriginal =
  'function u(){var a=we(),o=Nu();return o&&a.startsWith(o.replace(/^\\\\//,""))&&(a=a.slice(o.replace(/^\\\\//,"").length),a.startsWith("/")&&(a=a.slice(1))),a}'
const distPatch =
  'function u(){function d(w){try{return decodeURIComponent(w)}catch{return w}}var a=d(we()),o=d(Nu()).replace(/^\\\\//,"");return o&&a.startsWith(o)&&(a=a.slice(o.length),a.startsWith("/")&&(a=a.slice(1))),a.endsWith(".html")&&(a=a.slice(0,-5)),a}'

const distDataMarker = "__leoGetGraphData"
const distDataAnchor = "(function(){function u(){"
const distDataPatch =
  '(function(){var __leoGraphDataPromise;function __leoGetGraphData(){return __leoGraphDataPromise||(__leoGraphDataPromise=fetch($u("static/graphIndex.json")).then(function(r){if(!r.ok)throw new Error("[Graph] Failed to load graph index: "+r.status);return r.json()})),__leoGraphDataPromise}function u(){'
const distFetchOriginal = "await fetchData"
const distFetchPatch = "await __leoGetGraphData()"

export function patchGraphSource(text) {
  let next = text

  if (!next.includes(sourceMarker)) {
    const slugPatched = next.replace(sourcePattern, sourcePatch)
    if (slugPatched === next) {
      throw new Error("Could not find graph source slug function to patch")
    }
    next = slugPatched
  }

  if (!next.includes(sourceDataMarker)) {
    const dataLoaderPatched = next.replace(sourceDataAnchor, sourceDataPatch)
    if (dataLoaderPatched === next) {
      throw new Error("Could not find graph source data-loader anchor")
    }
    next = dataLoaderPatched
  }

  if (next.includes(sourceFetchOriginal)) {
    next = next.replace(sourceFetchOriginal, sourceFetchPatch)
  } else if (!next.includes(sourceFetchPatch)) {
    throw new Error("Could not find graph source data fetch")
  }

  return next
}

export function patchGraphDist(text) {
  let next = text

  if (!next.includes(distSlugMarker)) {
    const slugPatched = next.replace(distOriginal, distPatch)
    if (slugPatched === next) {
      throw new Error("Could not find graph dist slug function to patch")
    }
    next = slugPatched
  }

  if (!next.includes(distDataMarker)) {
    const dataLoaderPatched = next.replace(distDataAnchor, distDataPatch)
    if (dataLoaderPatched === next) {
      throw new Error("Could not find graph dist data-loader anchor")
    }
    next = dataLoaderPatched
  }

  if (next.includes(distFetchOriginal)) {
    next = next.replace(distFetchOriginal, distFetchPatch)
  } else if (!next.includes(distFetchPatch)) {
    throw new Error("Could not find graph dist data fetch")
  }

  return next
}

async function patchFile(filePath, patcher) {
  const original = await fs.readFile(filePath, "utf8")
  const next = patcher(original)
  if (next === original) {
    console.log(`Quartz graph plugin already patched: ${path.relative(repoRoot, filePath)}`)
    return
  }
  await fs.writeFile(filePath, next)
  console.log(`Patched Quartz graph plugin: ${path.relative(repoRoot, filePath)}`)
}

export async function patchQuartzGraphPlugin() {
  await patchFile(sourcePath, patchGraphSource)
  for (const distPath of distPaths) {
    await patchFile(distPath, patchGraphDist)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  patchQuartzGraphPlugin().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
