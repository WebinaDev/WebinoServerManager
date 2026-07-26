#!/usr/bin/env node
/**
 * Verify en.json and fa.json have identical key paths.
 * Usage: node scripts/check-i18n-parity.mjs
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const messagesDir = path.join(__dirname, "..", "messages")

function flatten(obj, prefix = "") {
  const keys = []
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...flatten(v, key))
    } else {
      keys.push(key)
    }
  }
  return keys
}

const enPath = path.join(messagesDir, "en.json")
const faPath = path.join(messagesDir, "fa.json")
const en = JSON.parse(fs.readFileSync(enPath, "utf8"))
const fa = JSON.parse(fs.readFileSync(faPath, "utf8"))

const enKeys = new Set(flatten(en))
const faKeys = new Set(flatten(fa))

const onlyEn = [...enKeys].filter((k) => !faKeys.has(k)).sort()
const onlyFa = [...faKeys].filter((k) => !enKeys.has(k)).sort()

if (onlyEn.length === 0 && onlyFa.length === 0) {
  console.log(`OK: ${enKeys.size} keys match in en.json and fa.json`)
  process.exit(0)
}

console.log(`Key parity mismatch (en: ${enKeys.size}, fa: ${faKeys.size})`)
if (onlyEn.length) {
  console.log(`\nMissing in fa.json (${onlyEn.length}):`)
  for (const k of onlyEn) console.log(`  + ${k}`)
}
if (onlyFa.length) {
  console.log(`\nMissing in en.json (${onlyFa.length}):`)
  for (const k of onlyFa) console.log(`  - ${k}`)
}
process.exit(1)
