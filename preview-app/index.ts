import { serve } from "bun";

import cardsFile from "../decks/race-to-agi/cards.csv" with { type: "text" };
import templateFile from "../decks/race-to-agi/front-simple.html" with {
  type: "text",
};
import cssFile from "../decks/race-to-agi/front-simple.css" with { type: "text" };


const headers = cardsFile
  .split("\n")[0]
  ?.match(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g)
  ?.map((val) => val.replace(/^,?"?|"?$/g, "").replace(/""/g, '"'));

function parseCard(line: string) {
  const values = line
    ?.match(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g)
    ?.map((val) => val.replace(/^,?"?|"?$/g, "").replace(/""/g, '"'));

  const card = Object.fromEntries(
    headers?.map((header, i) => [header, values?.[i]]) ?? []
  );

  // In addition, parse Description to Description1, Description2, etc.
  // For example, "1: +2C; 4: 3=>B" -> Description1 = "+2C", Description2 = "3=>B"
  // Note that this does break cider compat...
  const split = card.Description?.split("; ");
  for (const i of [1, 2, 3, 4, 5]) {
    card[`Description${i}`] = split?.[i - 1]?.split(": ")[1] ?? "";
  }

  return card;
}

const cards = cardsFile
  .split("\n")
  .slice(1) // Skip header row
  .filter((line) => line.trim()) // Remove empty lines
  .map(parseCard);

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

    // Special handling for image assets
    if (kebabKey === "image") {
      css = css.replace(/{{index assets card.image}}/g, `/assets/${value}`);
    } else {
      html = html.replace(pattern, value);
      css = css.replace(pattern, value);
    }
  });

  // Scope CSS to this card instance
  css = css.replace(/\.card/g, `.${cardId}`);
  html = html.replace('class="card"', `class="card ${cardId}"`);

  return `<style>${css}</style>${html}`;
}

const server = serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);

    // Handle asset requests
    if (url.pathname.startsWith("/assets/")) {
      const assetName = url.pathname.replace("/assets/", "");

      // Try both jpg and png
      for (const ext of [".jpg", ".png"]) {
        const file = Bun.file(`../assets/${assetName}${ext}`);
        if (await file.exists()) {
          return new Response(file);
        }
      }

      return new Response("Image not found", { status: 404 });
    }

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
