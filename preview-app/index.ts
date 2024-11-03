import { serve } from 'bun'
import { watch } from 'fs'

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

    // Special handling for image assets
    if (kebabKey === 'image') {
      css = css.replace(/{{index assets card.image}}/g, `/assets/${value}`)
    } else {
      html = html.replace(pattern, value)
      css = css.replace(pattern, value)
    }
  })

  // Scope CSS to this card instance
  css = css.replace(/\.card/g, `.${cardId}`)
  html = html.replace('class="card"', `class="card ${cardId}"`)

  return `<style>${css}</style>${html}`
}

// Track connected WebSocket clients
const clients = new Set<WebSocket>()

const server = serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url)

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

      // Try both jpg and png
      for (const ext of ['.jpg', '.png']) {
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
      // .filter(toShow)
      .map((card, index) => renderCard(card, index))
      .join('\n')

    const scale = 0.3

    const html = `<!DOCTYPE html>
    <html>
      <head>
        <script>
          // Setup WebSocket connection
          const ws = new WebSocket('ws://' + window.location.host + '/ws');
          ws.onmessage = (event) => {
            if (event.data === 'reload') window.location.reload();
          };
        </script>
        <style>
          .card {
            transform: scale(${scale});
            transform-origin: top left;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(${
              825 * scale
            }px, 1fr));
            grid-auto-rows: ${1125 * scale + 20}px;
            gap: 10px;
          }
        </style>
      </head>
      <body>
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
