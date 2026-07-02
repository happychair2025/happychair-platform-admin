import { existsSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const forceSupabase = process.argv.includes('--supabase')

const contractPath = path.join(root, 'src/lib/supabase/readContracts.ts')
const docsPaths = [
  path.join(root, 'docs/SUPABASE_READ_ONLY_SETUP.md'),
  path.join(root, 'docs/DATABASE_CHANGE_PLAN.md'),
]
const sqlDirs = [
  path.join(root, 'supabase/migrations'),
  path.join(root, 'supabase/rollback'),
]

const env = await loadEnv()
const views = await readViewContracts()
const sqlText = await readCombinedText(sqlDirs, '.sql')
const docsText = await readCombinedText(docsPaths)

const staticResults = views.map(view => ({
  key: view.key,
  view: view.viewName,
  migration: sqlText.includes(view.viewName),
  rollback: sqlText.includes(`drop view if exists public.${view.viewName}`),
  docs: docsText.includes(view.viewName),
}))

const hasSupabaseConfig = Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY)
const shouldProbeSupabase = forceSupabase || env.VITE_PLATFORM_DATA_SOURCE === 'supabase'
const liveResults = shouldProbeSupabase && hasSupabaseConfig
  ? await probeSupabaseViews(views, env)
  : []

const failures = [
  ...staticResults.flatMap(result => {
    const missing = []
    if (!result.migration) missing.push('migration')
    if (!result.rollback) missing.push('rollback')
    if (!result.docs) missing.push('docs')
    return missing.map(area => `${result.view} missing from ${area}`)
  }),
  ...liveResults.filter(result => !result.ok).map(result => `${result.view} REST probe failed (${result.status}) ${result.error ?? ''}`.trim()),
]

printStaticResults(staticResults)

if (shouldProbeSupabase && !hasSupabaseConfig) {
  console.log('\nSupabase REST probe skipped: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not both set.')
} else if (liveResults.length) {
  printLiveResults(liveResults)
} else {
  console.log('\nSupabase REST probe skipped. Set VITE_PLATFORM_DATA_SOURCE=supabase or pass --supabase to probe live views.')
}

if (failures.length) {
  console.error('\nRead contract verification failed:')
  failures.forEach(failure => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('\nRead contract verification passed.')

async function readViewContracts() {
  const contents = await readFile(contractPath, 'utf8')
  const block = contents.match(/readOnlyViewNames\s*=\s*{([\s\S]*?)}\s*as const/)
  if (!block) throw new Error('Could not find readOnlyViewNames in readContracts.ts')

  return [...block[1].matchAll(/(\w+):\s*'([^']+)'/g)].map(match => ({
    key: match[1],
    viewName: match[2],
  }))
}

async function readCombinedText(pathsOrDirs, extension) {
  const paths = Array.isArray(pathsOrDirs) ? pathsOrDirs : [pathsOrDirs]
  const files = []

  for (const item of paths) {
    if (!existsSync(item)) continue
    if (extension) {
      const entries = await readdir(item, { withFileTypes: true })
      files.push(...entries
        .filter(entry => entry.isFile() && entry.name.endsWith(extension))
        .map(entry => path.join(item, entry.name)))
    } else {
      files.push(item)
    }
  }

  const chunks = await Promise.all(files.map(file => readFile(file, 'utf8')))
  return chunks.join('\n')
}

async function loadEnv() {
  const next = { ...process.env }
  for (const file of ['.env', '.env.local']) {
    const envPath = path.join(root, file)
    if (!existsSync(envPath)) continue
    const contents = await readFile(envPath, 'utf8')
    contents.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return
      const separator = trimmed.indexOf('=')
      if (separator === -1) return
      const key = trimmed.slice(0, separator).trim()
      const rawValue = trimmed.slice(separator + 1).trim()
      next[key] = rawValue.replace(/^['"]|['"]$/g, '')
    })
  }
  return next
}

async function probeSupabaseViews(views, env) {
  const baseUrl = env.VITE_SUPABASE_URL.replace(/\/$/, '')

  return Promise.all(views.map(async view => {
    try {
      const response = await fetch(`${baseUrl}/rest/v1/${view.viewName}?select=*&limit=1`, {
        headers: {
          apikey: env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`,
          Prefer: 'count=estimated',
        },
      })
      if (!response.ok) {
        const message = await response.text()
        return { ...view, ok: false, status: response.status, error: summarize(message) }
      }
      return { ...view, ok: true, status: response.status }
    } catch (error) {
      return { ...view, ok: false, status: 'network', error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }))
}

function printStaticResults(results) {
  console.log('\nPlatform Admin read contracts')
  console.log('View'.padEnd(48), 'Migration'.padEnd(10), 'Rollback'.padEnd(10), 'Docs')
  results.forEach(result => {
    console.log(
      result.view.padEnd(48),
      mark(result.migration).padEnd(10),
      mark(result.rollback).padEnd(10),
      mark(result.docs),
    )
  })
}

function printLiveResults(results) {
  console.log('\nSupabase REST probe')
  console.log('View'.padEnd(48), 'Status'.padEnd(8), 'Result')
  results.forEach(result => {
    console.log(
      result.view.padEnd(48),
      String(result.status).padEnd(8),
      result.ok ? 'ok' : result.error ?? 'failed',
    )
  })
}

function mark(value) {
  return value ? 'ok' : 'missing'
}

function summarize(value) {
  return value.replace(/\s+/g, ' ').slice(0, 180)
}
