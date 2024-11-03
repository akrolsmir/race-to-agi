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

Design

- different colored goods
- separate windfall vs regular worlds
- maybe line up "dev vs world" based on the colors of the phases?
- And then military worlds use +..., pip or cpu or sth instead of #

v0

- [x] split out descriptions
- [x] Fix hot reloading
- [x] Prettier
- [x] Parse the Figma designs
- [x] Import from spreadsheet
- [ ] Export cards as images
- [ ] Use real CSV parser to handle commas
- [ ] AI generated art
- [ ] Connect to TheGameCrafter API?

v1

- [ ] Host it all as a site
- [ ] Let people customize names, images
- [ ] Let people customize layouts
- [ ] Add other games??
