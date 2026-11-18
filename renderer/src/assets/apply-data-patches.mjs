// @ts-check

// Applies fork-local data fixes from `renderer/data-patches/<lang>/` on top of
// upstream's generated `public/data/<lang>/*.ndjson`. Runs before index files
// are built (dev + build), and is idempotent: a second run changes nothing.
//
//   stats.<name>.ndjson  entry replaces the upstream stat with the same `ref`
//                        (also inside a stat group), or is appended if
//                        upstream has no such stat
//   items.<name>.ndjson  entry is appended only if upstream has no item with
//                        the same `namespace` + `refName`

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PATCHES_DIR = path.join(__dirname, '../../data-patches')
const DATA_DIR = path.join(__dirname, '../../public/data')

/** @param {string} text */
function splitLines (text) {
  return text.split(/\r?\n/).filter(line => line.length)
}

/**
 * @param {'stats' | 'items'} kind
 * @param {any} entry
 */
function keyOf (kind, entry) {
  return (kind === 'stats')
    ? entry.ref // groups have no top-level `ref` and are never patched
    : `${entry.namespace}::${entry.refName}`
}

/**
 * @param {string} lang
 * @param {'stats' | 'items'} kind
 */
function applyKind (lang, kind) {
  const dir = path.join(PATCHES_DIR, lang)
  if (!fs.existsSync(dir)) return

  const patchFiles = fs.readdirSync(dir)
    .filter(file => file.startsWith(`${kind}.`) && file.endsWith('.ndjson'))
    .sort()
  if (!patchFiles.length) return

  const targetPath = path.join(DATA_DIR, lang, `${kind}.ndjson`)
  const original = fs.readFileSync(targetPath, 'utf-8')
  const eol = original.includes('\r\n') ? '\r\n' : '\n'
  const lines = splitLines(original)

  /** @type {Map<string, number>} */
  const lineByKey = new Map()
  /** @type {Map<string, { line: number, member: number }>} */
  const groupMemberByRef = new Map()
  lines.forEach((line, idx) => {
    const parsed = JSON.parse(line)
    const key = keyOf(kind, parsed)
    if (key !== undefined && !lineByKey.has(key)) lineByKey.set(key, idx)
    if (kind === 'stats' && Array.isArray(parsed.stats)) {
      parsed.stats.forEach((/** @type {any} */ stat, /** @type {number} */ member) => {
        if (!groupMemberByRef.has(stat.ref)) groupMemberByRef.set(stat.ref, { line: idx, member })
      })
    }
  })

  let replaced = 0
  let appended = 0
  for (const file of patchFiles) {
    for (const line of splitLines(fs.readFileSync(path.join(dir, file), 'utf-8'))) {
      const entry = JSON.parse(line)
      const key = keyOf(kind, entry)
      if (key === undefined) {
        throw new Error(`data-patches/${lang}/${file}: entry has no key: ${line.slice(0, 80)}`)
      }
      const normalized = JSON.stringify(entry)
      const idx = lineByKey.get(key)
      const inGroup = (idx === undefined) ? groupMemberByRef.get(key) : undefined
      if (inGroup) {
        const group = JSON.parse(lines[inGroup.line])
        if (JSON.stringify(group.stats[inGroup.member]) !== normalized) {
          group.stats[inGroup.member] = entry
          lines[inGroup.line] = JSON.stringify(group)
          replaced += 1
        }
      } else if (idx === undefined) {
        lineByKey.set(key, lines.length)
        lines.push(normalized)
        appended += 1
      } else if (kind === 'stats' && lines[idx] !== normalized) {
        lines[idx] = normalized
        replaced += 1
      }
    }
  }

  const output = lines.join(eol) + eol
  if (output !== original) {
    fs.writeFileSync(targetPath, output)
    console.log(`[data-patches] ${lang}/${kind}.ndjson: ${replaced} replaced, ${appended} appended`)
  }
}

export function applyDataPatches () {
  for (const lang of fs.readdirSync(DATA_DIR)) {
    if (!fs.statSync(path.join(DATA_DIR, lang)).isDirectory()) continue
    applyKind(lang, 'stats')
    applyKind(lang, 'items')
  }
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  applyDataPatches()
}
