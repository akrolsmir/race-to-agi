Bun.serve({
  port: 3000,
  fetch(req) {
    const html = `<!DOCTYPE html>
    <html>
      <head>
        <title>Bun Server</title>
      </head>
      <body>
        <h1>Hello from Bun!</h1>
      </body>
    </html>`;

    return new Response(html, {
      headers: {
        "Content-Type": "text/html",
      },
    });
  },
});

console.log(`Listening on http://localhost:3000`);
