import { serve } from 'bun'
import { watch } from 'fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

// import cardsFile from '../decks/race-to-agi/cards.csv' with { type: 'text' }
import cardsFile from '../decks/race-to-agi/rftg-cards.csv' with { type: 'text' }
import templateFile from '../decks/race-to-agi/front-simple.html' with { type: 'text' }
import cssFile from '../decks/race-to-agi/front-simple.css' with { type: 'text' }

const headers = cardsFile
  .split('\n')[0]
  ?.match(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g)
  ?.map((val) => val.replace(/^,?"?|"?$/g, '').replace(/""/g, '"'))

function parseCard(line: string) {
  const values = line
    ?.match(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g)
    ?.map((val) => val.replace(/^,?"?|"?$/g, '').replace(/""/g, '"'))

  const card = Object.fromEntries(
    headers?.map((header, i) => [header, values?.[i]]) ?? []
  )

  // In addition, parse Description to Description1, Description2, etc.
  // For example, "1: +2C; 4: 3=>B" -> Description1 = "+2C", Description2 = "3=>B"
  // Note that this does break cider compat...
  const split = card.Description?.split('; ') ?? []
  const descMap = {} as Record<string, string>
  for (const s of split) {
    const [i, desc] = s.split(': ')
    descMap[i] = desc
  }
  for (const i of [1, 2, 3, 4, 5]) {
    card[`Description${i}`] = descMap[i] ?? ''
  }

  // In addition, add p5-icon, eg f3.svg or g4.svg
  if (card.Production) {
    // if Production is "Production", use f, else g
    const letter = card.Production === 'Production' ? 'f' : 'g'

    const number = {
      Novelty: 2,
      Rare: 3,
      Genes: 4,
      Alien: 5,
    }[card.Good as string]
    card['p5-icon'] = `/assets/icons/${letter}${number}.svg`
  } else {
    // Placeholder for no production -- needed for image export >.>
    // With a proper rendering system we'd just exclude this node
    card['p5-icon'] = '/assets/icons/empty.svg'
  }

  return card
}

const cards = cardsFile
  .split('\n')
  .slice(1) // Skip header row
  .filter((line) => line.trim()) // Remove empty lines
  .map(parseCard)

function renderCard(card, index) {
  const cardId = `card-${index}`
  let html = templateFile
  let css = cssFile

  // Replace card variables
  Object.keys(card).forEach((key) => {
    const value = card[key]
    // Because the Cider's template attributes assumes kebab case
    const kebabKey = key.toLowerCase().replace(/ /g, '-')
    const pattern = new RegExp(`{{card\\.${kebabKey}}}`, 'g')

    html = html.replace(pattern, value)
    css = css.replace(pattern, value)

    // Special handling for rendering images
    if (kebabKey === 'image') {
      css = css.replace(/{{index assets card.image}}/g, `/assets/${value}`)
    }

    // Conditional rendering: replace {{renderif card.X}} in css with "display: none;" if X is empty
    const renderif = new RegExp(`{{renderif card\\.${kebabKey}}}`, 'g')
    if (!value || value === '') {
      css = css.replace(renderif, 'display: none;')
    } else {
      css = css.replace(renderif, '')
    }

    // Special icon: Replace "1 good" with <img src="/assets/icons/fX.svg" />
    html = html.replace(
      new RegExp(`1 good`, 'g'),
      `<img src="/assets/icons/fX.svg" style="width: 70px; height: 70px;" />`
    )
  })

  // Scope CSS to this card instance
  css = css.replace(/\.card/g, `.${cardId}`)
  html = html.replace('class="card"', `class="card ${cardId}"`)

  // Create a wrapper that handles the display scaling, keeping the inner card at full size
  return `<div class="card-container" data-card-name="${card.Name}">
    <div class="card-scaler">
      <div class="card-inner">
        <style>${css}</style>
        ${html}
      </div>
    </div>
  </div>`
}

// Track connected WebSocket clients
const clients = new Set<WebSocket>()

const server = serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url)

    // Add new endpoint to receive and save images
    if (url.pathname === '/save-cards' && req.method === 'POST') {
      const body = await req.json()
      const outputDir = join(process.cwd(), 'output')
      await mkdir(outputDir, { recursive: true })


      for (const { name, dataUrl } of body.cards) {
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '')
        const filename = name.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.png'
        await writeFile(join(outputDir, filename), base64Data, 'base64')
      }

      return new Response('Cards saved successfully')
    }

    // Handle WebSocket upgrades
    if (url.pathname === '/ws') {
      const upgraded = server.upgrade(req)
      if (!upgraded) {
        return new Response('WebSocket upgrade failed', { status: 400 })
      }
      return
    }

    // Handle asset requests
    if (url.pathname.startsWith('/assets/')) {
      const assetName = url.pathname.replace('/assets/', '')

      // Try bare, and also with image extensions
      for (const ext of ['', '.jpg', '.png', '.svg']) {
        const file = Bun.file(`../assets/${assetName}${ext}`)
        if (await file.exists()) {
          return new Response(file)
        }
      }

      return new Response('Image not found', { status: 404 })
    }

    function toShow(card) {
      return [
        'New Galactic Order',
        'Epsilon Eridani',
        'Spice World',
        'Deserted Alien Outpost',
      ].includes(card.Name)
    }

    const cardHtml = cards
      .filter(toShow)
      .map((card, index) => renderCard(card, index))
      .join('\n')

    const scale = 0.3

    const html = `<!DOCTYPE html>
    <html>
      <head>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.11/html-to-image.min.js"></script>
        <script>
          async function exportCards() {
            const cards = document.querySelectorAll('.card-inner');
            const cardData = [];
            
            for (const card of cards) {
              console.log('card', card)
              try {
                const dataUrl = await htmlToImage.toPng(card, {
                  quality: 1.0,
                  backgroundColor: null,
                  width: 825,
                  height: 1125
                });
                
                cardData.push({
                  name: card.closest('.card-container').dataset.cardName,
                  dataUrl
                });
              } catch (error) {
                console.error('Error capturing card:', card.closest('.card-container').dataset.cardName, error);
              }
            }

            // Send to server
            const response = await fetch('/save-cards', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ cards: cardData })
            });

            if (response.ok) {
              alert('Cards exported successfully!');
            }
          }
        </script>
        <style>
          body {
            margin: 0;
            padding: 20px;
            background: #333;
          }
          .card-container {
            width: ${825 * scale}px;
            height: ${1125 * scale}px;
            overflow: hidden;
          }
          .card-scaler {
            transform: scale(${scale});
            transform-origin: top left;
          }
          .card-inner {
            width: 825px;
            height: 1125px;
            position: relative;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(${
              825 * scale
            }px, 1fr));
            grid-gap: 20px;
            padding: 20px;
          }
          #export-btn {
            top: 20px;
            right: 20px;
            padding: 10px 20px;
            background: #333;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <button id="export-btn" onclick="exportCards()">Export Cards</button>
        <div class="grid">
          ${cardHtml}
        </div>
      </body>
    </html>`

    return new Response(html, {
      headers: { 'Content-Type': 'text/html' },
    })
  },
  websocket: {
    open(ws) {
      clients.add(ws)
    },
    close(ws) {
      clients.delete(ws)
    },
    message(ws, message) {},
  },
})

// In the file watcher, notify all clients to reload
watch('../', { recursive: true }, async (event, filename) => {
  console.log(`Detected ${event} in ${filename}`)

  // Notify all clients to reload
  for (const client of clients) {
    client.send('reload')
  }
})

console.log(`Listening on http://localhost:${server.port}`)
