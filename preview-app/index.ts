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

function renderCard(card) {
  let html = templateFile;
  // Replace {{card.xyz}} with actual values
  Object.keys(card).forEach((key) => {
    html = html.replace(new RegExp(`{{card.${key}}}`, "g"), card[key]);
  });
  return html;
}

const server = serve({
  port: 3000,
  fetch(req) {
    const cardHtml = cards.map(renderCard).join("\n");

    const html = `<!DOCTYPE html>
    <html>
      <head>
        <style>
          .grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(825px, 1fr));
            gap: 20px;
            padding: 20px;
          }
          ${cssFile}
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
