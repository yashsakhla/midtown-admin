# The Midtown Hotel — Manager App (React)

The mobile manager app for The Midtown Hotel, rebuilt as a proper React
project with Vite. Same design, same data and same screens as the HTML app —
now as components you can extend and connect to a backend.

Built by MACROPAGE — MR Tech Solutions Pvt. Ltd.

## Running it

You need Node.js 18 or newer.

```bash
npm install     # once
npm run dev     # http://localhost:5173
```

## Building for the web or a hosting panel

```bash
npm run build   # output goes to dist/
npm run preview # check the built files locally
```

`dist/` is a plain static folder — upload it to any hosting (cPanel, Hostinger,
Netlify, Vercel, S3). Paths are relative, so it also works inside a subfolder
such as `example.com/manager/`.

## Wrapping it as an Android / iOS app

The build is a standard web app, so Capacitor can package it:

```bash
npm install @capacitor/core @capacitor/cli
npx cap init "Midtown Manager" com.midtown.manager --web-dir=dist
npx cap add android
npm run build && npx cap sync && npx cap open android
```

## Fonts

Fonts are self-hosted through `@fontsource` — no Google Fonts call, so the app
loads the same on a slow connection or with no internet.

- **Fraunces** — headings and the hotel name
- **Plus Jakarta Sans** — body text, numbers and tabular figures

## Project layout

```
src/
  main.jsx            React root, wraps the app in HotelProvider
  App.jsx             Phone shell: top bar, screen, FAB, sheets, tab bar
  index.css           The whole design system (tokens, cards, room tiles, print)
  store/
    HotelContext.jsx  All state and every action in one place
  data/seed.js        Starting data — swap for an API call
  lib/
    format.js         Dates, money, ids
    selectors.js      Occupancy, receipts, closing balance, low stock
    reports.js        The eight report definitions
    print.js          Slips, GST invoices, PDF printing, Excel download
  components/         Card, Kpi, Field, Pill, Stepper, RoomCard, Sheet, …
  screens/            Home, Rooms, Day book, Food, More
  sheets/             Every bottom sheet, plus the SheetHost switch
  assets/             Hotel, room and food photographs
```

## How the data layer works

`HotelContext` holds the whole hotel in one state object. Every change goes
through `update(mutator)`, which copies the state and applies the change, so
React re-renders correctly and nothing is mutated in place.

To connect a backend, replace `createInitialState()` in `src/data/seed.js`
with your API call and post each action's result to your server — the action
names in `HotelContext.jsx` map one-to-one to the endpoints you will need.

## The no-double-entry rule

This is enforced in `HotelContext.jsx` and should stay that way:

- `addEntry` checks for an identical line (same room, type, amount, guest).
  If one exists it **opens that entry for correction** instead of posting a
  second line.
- `updateEntry` edits the entry in place and rewrites its linked day-book
  cash line — it never posts a reversal.
- `deleteEntry` removes the entry and its cash line together.
- An advance, part payment or refund entered in **Edit stay** posts exactly
  one line, carrying its own `txnId`.

## Printing

Slips, GST invoices and reports render into a hidden print block and open the
browser's print dialog — choose "Save as PDF" for a PDF copy. Excel export
downloads an `.xls` file that opens in Excel and Google Sheets.
