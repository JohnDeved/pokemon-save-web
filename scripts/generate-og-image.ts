import sharp from 'sharp'
import { readFileSync } from 'fs'
import { join } from 'path'

const publicDir = join(process.cwd(), 'public')
const svgBuffer = readFileSync(join(publicDir, 'og-image.svg'))

async function generateOGImage() {
  await sharp(svgBuffer).resize(1200, 630).png().toFile(join(publicDir, 'og-image.png'))

  console.log('Generated og-image.png (1200x630)')
}

generateOGImage()
  .then(() => console.log('OG image generated successfully!'))
  .catch(console.error)
