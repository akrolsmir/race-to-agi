// Read input CSV
const input = await Bun.file('scripts/rftg-cards-raw.csv').text()
const headers = input.split('\n')[0].split(',')

type RawRecord = {
  Name: string
  Set: string
  Qty: string
  // x: string
  Type: string
  Keywords: string
  'Start World': string
  'Start Hand': string
  'Production Type': string
  Good: string
  'Cost/Defense': string
  VPs: string
  // Prestige: string
  'Explore (I)': string
  'Develop (II)': string
  'Settle (III)': string
  'Consume Trade ($)': string
  'Consume (IV)': string
  'Produce (V)': string
  'Game End Bonus / Other Notes': string
}

// For each record, convert to an object
let records = input
  .split('\n')
  .slice(1)
  .map((line) => line.split(','))
  .map((record) => {
    const obj: Record<string, string> = {}
    record.forEach((value, index) => {
      // Strip outer quotes
      obj[headers[index]] = value.replace(/^"|"$/g, '')
    })
    return obj
  }) as RawRecord[]

// Only use the Base set
records = records.filter((card) => card.Set === 'Base')

// Phase names mapping
const phases = {
  'Explore (I)': '1',
  'Develop (II)': '2',
  'Settle (III)': '3',
  'Consume Trade ($)': '4',
  'Consume (IV)': '4',
  'Produce (V)': '5',
}

function formatDescription(card: any): string {
  const actions = []

  // Check each phase for actions
  for (const [phase, num] of Object.entries(phases)) {
    if (card[phase] && card[phase].trim()) {
      actions.push(`${num}: ${card[phase]}`)
    }
  }

  return actions.join('; ') || ''
}

// Turn eg "NEW GALACTIC ORDER" into "New Galactic Order"
function decapitalize(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

const hueMap = {
  Development: 190,
  'Non-Military World': 240,
  'Military World': 240,
} as Record<string, number>

// Transform records
const output = records.map((card, index) => ({
  Name: decapitalize(card.Name),
  Count: card.Qty,
  'Front Template': 'Front Simple',
  'Back Template': 'Front Simple',
  Description: formatDescription(card),
  Hue: hueMap[card.Type] || 0,
  'Card ID': index + 1, // Default ID
  Type: card.Type.toLowerCase().includes('development') ? 'dev' : 'world',
  Production: card['Production Type'],
  Good: card.Good,
  VP: card.VPs,
  Cost: card['Cost/Defense'],
  Image: ['fusion', 'seal', 'face', 'fire-apple'][index % 4],
  Notes: card['Game End Bonus / Other Notes'],
}))

const outputHeaders = [
  'Name',
  'Count',
  'Front Template',
  'Back Template',
  'Description',
  'Hue',
  'Card ID',
  'Type',
  'Production',
  'Good',
  'VP',
  'Cost',
  'Image',
  'Notes',
]

// Write output CSV
const outputRows = output
  .map((card) => outputHeaders.map((header) => `"${card[header]}"`).join(','))
  .join('\n')
Bun.write(
  '../decks/race-to-agi/rftg-cards.csv',
  `${outputHeaders.join(',')}\n${outputRows}`
)

console.log(`Converted ${output.length} cards`)
