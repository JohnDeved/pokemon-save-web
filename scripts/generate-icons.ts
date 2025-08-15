import sharp from 'sharp'
import { readFileSync } from 'fs'
import { join } from 'path'

const publicDir = join(process.cwd(), 'public')
const svgBuffer = readFileSync(join(publicDir, 'pwa-icon.svg'))

// Generate PNG icons
const sizes = [
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'pwa-512x512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'favicon-16x16.png', size: 16 },
]

async function generateIcons() {
  for (const { name, size } of sizes) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(join(publicDir, name))

    console.log(`Generated ${name} (${size}x${size})`)
  }
}

// Generate favicon.png using the 32x32 PNG
async function generateFavicon() {
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(join(publicDir, 'favicon.png'))

  console.log('Generated favicon.png')
}

generateIcons()
  .then(() => generateFavicon())
  .then(() => console.log('All icons generated successfully!'))
  .catch(console.error)
