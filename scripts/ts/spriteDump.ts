import * as cheerio from 'cheerio'
import * as fs from 'fs'
import * as path from 'path'
import { Readable } from 'stream'
import type { ReadableStream } from 'stream/web'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const BASE_URLS = [
  { url: 'https://play.pokemonshowdown.com/sprites/gen5ani/', folder: 'sprites' },
  {
    url: 'https://play.pokemonshowdown.com/sprites/gen5ani-shiny/',
    folder: path.join('sprites', 'shiny'),
  },
]

const CONCURRENCY = 8

function renderProgressBar(completed: number, total: number, label = '') {
  const barLength = 30
  const percent = completed / total
  const filled = Math.round(barLength * percent)
  const bar = '='.repeat(filled) + '-'.repeat(barLength - filled)
  process.stdout.write(`\r${label}[${bar}] ${completed}/${total} (${(percent * 100).toFixed(1)}%)`)
}

async function downloadSprite(url: string, destDir: string, progress: { completed: number; total: number; label: string }) {
  const filename = url.split('/').pop()
  if (!filename) return
  const dest = path.join(destDir, filename)
  const r = await fetch(url)
  if (!r.ok || !r.body) throw new Error(`Failed to download ${url}: ${r.statusText}`)
  const nodeStream = Readable.fromWeb(r.body as ReadableStream<Uint8Array>)
  await new Promise<void>((resolve, reject) => {
    nodeStream
      .pipe(fs.createWriteStream(dest))
      .on('finish', () => resolve())
      .on('error', reject)
  })
  progress.completed++
  renderProgressBar(progress.completed, progress.total, progress.label)
}

async function runParallelDownloads(urls: string[], destDir: string, label: string) {
  let i = 0
  const progress = { completed: 0, total: urls.length, label }
  renderProgressBar(0, urls.length, label)
  async function next() {
    if (i >= urls.length) return
    const url = urls[i++]!
    await downloadSprite(url, destDir, progress)
    await next()
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, next))
  process.stdout.write('\n')
}

for (const { url: baseUrl, folder } of BASE_URLS) {
  const destDir = path.join(__dirname, '..', 'public', folder)
  fs.mkdirSync(destDir, { recursive: true })
  const res = await fetch(baseUrl)
  if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`)
  const html = await res.text()
  const $ = cheerio.load(html)
  const urls: string[] = $('.dirlist a.row')
    .map((_, el) => $(el).attr('href'))
    .get()
    .filter((href): href is string => typeof href === 'string' && !href.endsWith('/'))
    .map(href => baseUrl + href)
  await runParallelDownloads(urls, destDir, folder)
}
