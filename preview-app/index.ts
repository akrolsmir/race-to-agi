import { serve } from 'bun'
import { watch } from 'fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parse } from 'csv-parse/sync'
import { Glob } from "bun";


// import cardsFile from '../decks/race-to-agi/cards.csv' with { type: 'text' }
import cardsFile from '../decks/race-to-agi/rftg-cards.csv' with { type: 'text' }
import templateFile from '../decks/race-to-agi/front-simple.html' with { type: 'text' }
import cssFile from '../decks/race-to-agi/front-simple.css' with { type: 'text' }

const GOODS_MAP = {
  Novelty: 2,
  Rare: 3,
  Genes: 4,
  Alien: 5,
}

const records = parse(cardsFile, {
  columns: true,
  skip_empty_lines: true,
})

function parseCard(record: any) {
  const card = { ...record }

  // Parse Description fields
  const split = card.Description?.split('|') ?? []
  const descMap = {} as Record<string, string>
  for (const s of split) {
    const [i, desc] = s.split(': ')
    descMap[i] = desc
  }
  for (const i of [1, 2, 3, 4, 5]) {
    card[`Description${i}`] = descMap[i] ?? ''
  }

  // Add p5-icon
  if (card.Production) {
    const letter = card.Production === 'Production' ? 'f' : 'g'
    const number = GOODS_MAP[card.Good as string]
    card['p5-icon'] = `/assets/icons/${letter}${number}.svg`
  } else {
    card['p5-icon'] = '/assets/icons/empty.svg'
  }

  // Special: Replace Alien as Lien for now
  card.Name = card.Name.replace('Alien', 'Lien')

  return card
}

const cards = records.map(parseCard)

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

    // Special: replace icons
    const iconMap = {
      '1 good': 'fX',
      // '1 Rare Windfall': 'g3',
      // '1 Rare': 'f3',
      // 'Rare here': 'f3',
      'Cost': 'cost',
      '1 VP': 'vp1',
      '2 VP': 'vp2',
      '3 VP': 'vp3',
      'Military': 'cpu',
      'Keep': 'eye',
      'keep': 'eye',
      'Draw': 'card',
      'draw': 'card',
    } as Record<string, string>
    for (const [type, num] of Object.entries(GOODS_MAP)) {
      iconMap[`1 ${type} Windfall`] = `g${num}`
      iconMap[`1 ${type}`] = `f${num}`
      iconMap[`${type} here`] = `f${num}`
      iconMap[`${type}`] = `f${num}`
    }
    // Special icon: Replace "1 good" with <img src="/assets/icons/fX.svg" />
    for (const [pattern, icon] of Object.entries(iconMap)) {
      html = html.replace(new RegExp(pattern, 'g'), `<img src="/assets/icons/${icon}.svg" style="width: 70px; height: 70px;" />`)
    }
  })

  // Scope CSS to this card instance
  css = css.replace(/\.card/g, `.${cardId}`)
  html = html.replace('class="card"', `class="card ${cardId}"`)

  // Create a wrapper that handles the display scaling, keeping the inner card at full size
  return `<div class="card-container" data-card-name="${card.Name}">
    <div class="card-scaler">
      <div class="card-inner">
        <div class="card-cut"></div>
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

    // if /icons, show a page with all icons
    if (url.pathname === '/icons') {
      // List all icons files in ../assets/icons
      const glob = new Glob("*")
      const icons = Array.from(glob.scanSync('../assets/icons')).sort()
      const iconsHtml = icons.map((icon) => `<img src="/assets/icons/${icon}" />`).join('\n')
      return new Response(`<!DOCTYPE html>
        <html>
          <head>
            <style>
              body {
                margin: 0;
                padding: 20px;
                background: #888;
              }
              img {
                width: 60px;
              }
            </style>
          </head>
          <body>
            <div class="grid">
              ${iconsHtml}
            </div>
          </body>
        </html>`, {
        headers: { 'Content-Type': 'text/html' },
      })
    }

    // Only show selected cards, unless we're on /all
    function toShow(card) {
      if (url.pathname === '/all')
        return true

      return [
        'New Galactic Order',
        'Epsilon Eridani',
        'Spice World',
        'Deserted Lien Outpost',
      ].includes(card.Name)
    }

    const cardHtml = cards
      .filter(toShow)
      .map((card, index) => renderCard(card, index))
      .join('\n')

    const scale = 0.35

    const html = `<!DOCTYPE html>
    <html>
      <head>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.11/html-to-image.min.js"></script>
        <script>
          // Listen for hot reloads over websocket
          const ws = new WebSocket('ws://' + window.location.host + '/ws');
          ws.onmessage = (event) => {
            if (event.data === 'reload') window.location.reload();
          };

          async function exportCards() {
            // Hide the cut border (card-cut)
            document.querySelectorAll('.card-cut').forEach(el => el.style.display = 'none');

            const cards = document.querySelectorAll('.card-inner');
            const cardData = [];
            // Time the export
            const start = Date.now();
            let i = 0;

            const config = {
              width: 825,
              height: 1125,
              pixelRatio: 1, // Force 1:1 pixel ratio
            };

            for (const card of cards) {
              try {
                const dataUrl = await htmlToImage.toPng(card, config);
                
                cardData.push({
                  name: card.closest('.card-container').dataset.cardName,
                  dataUrl
                });

                console.log("Exported", ++i, "cards")
              } catch (error) {
                console.error('Error capturing card:', card.closest('.card-container').dataset.cardName, error);
              }
            }

            console.log("Exported in", Date.now() - start, "ms")

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
          .card-cut {
            content: '';
            position: absolute;
            top: 1px;
            right: 1px;
            bottom: 1px;
            left: 1px;
            border: 40px solid #333;
            pointer-events: none;
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
