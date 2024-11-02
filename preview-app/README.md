# preview-app

A simple web server for previewing card designs. Reads card data from CSV files and renders them using HTML templates.

## Features

- Loads card data from CSV files
- Renders cards using customizable HTML/CSS templates
- Shows all cards in a responsive grid layout
- Live preview with auto-reload

## Installation

To install dependencies:

```bash
bun install
```

To run:

```bash
bun dev
```

### Dev notes

- The Game Crafter has an API! https://www.thegamecrafter.com/developer/Intro.html
- Could let people generate their own images (and vote on those images)
  - More broadly: bring your own layouts; bring your own card designs
  - What is a crowdsourced board game?

TODO:

- [x] split out descriptions
- [ ] Fix hot reloading
- [ ] Prettier
- [ ] Parse the Figma designs
- [ ] Import from spreadsheet
