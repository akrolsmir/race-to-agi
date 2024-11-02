import { serve } from "bun";

const cardsFile = (await Bun.file(
  "../decks/race-to-agi/cards.csv"
).text()) as string;
const templateFile = await Bun.file(
  "../decks/race-to-agi/front-simple.html"
).text();
const cssFile = await Bun.file("../decks/race-to-agi/front-simple.css").text();

const headers = cardsFile
  .split("\n")[0]
  ?.match(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g)
  ?.map((val) => val.replace(/^,?"?|"?$/g, "").replace(/""/g, '"'));

console.log("headers", headers);

const cards = cardsFile
  .split("\n")
  .slice(1) // Skip header row
  .filter((line) => line.trim()) // Remove empty lines
  .map((line) => {
    const values = line
      ?.match(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g)
      ?.map((val) => val.replace(/^,?"?|"?$/g, "").replace(/""/g, '"'));

    return Object.fromEntries(
      headers?.map((header, i) => [header, values?.[i]]) ?? []
    );
  });

console.log("cards", cards);

function renderCard(card, index) {
  const cardId = `card-${index}`;
  let html = templateFile;
  let css = cssFile;

  // Replace card variables
  Object.keys(card).forEach((key) => {
    const value = card[key];
    // Because the Cider's template attributes assumes kebab case
    const kebabKey = key.toLowerCase().replace(/ /g, "-");
    const pattern = new RegExp(`{{card\\.${kebabKey}}}`, "g");
    html = html.replace(pattern, value);
    css = css.replace(pattern, value);
  });

  // Scope CSS to this card instance
  css = css.replace(/\.card/g, `.${cardId}`);
  html = html.replace('class="card"', `class="card ${cardId}"`);

  return `<style>${css}</style>${html}`;
}

const server = serve({
  port: 3000,
  fetch(req) {
    const cardHtml = cards
      .map((card, index) => renderCard(card, index))
      .join("\n");

    const scale = 0.3;

    const html = `<!DOCTYPE html>
    <html>
      <head>
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
            gap: 20px;
            padding: 20px;
          }
        </style>
      </head>
      <body>
        <div class="grid">
          ${cardHtml}
        </div>
      </body>
    </html>`;

    return new Response(html, {
      headers: { "Content-Type": "text/html" },
    });
  },
});

console.log(`Listening on http://localhost:${server.port}`);
