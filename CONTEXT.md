# Sight Reading Practice App — Project Context

## What This Is
A piano sight reading practice web app built as a single self-contained HTML file (`sight_reading.html`). It helps pianists practice sight reading by serving up pieces or generated exercises in a focused, low-friction UI designed to encourage moving on quickly rather than over-practicing the same piece.

The core philosophy of sight reading practice: you should only attempt a piece 1-2 times before moving on. The app is designed around this principle.

---

## Current State
The app is a single HTML file with all CSS and JavaScript embedded. It uses:
- **OpenSheetMusicDisplay (OSMD)** via unpkg CDN for rendering MusicXML scores inline
- **Anthropic API** (claude-sonnet-4-20250514) for generating MusicXML exercises in Generated Mode
- **localStorage** for persisting session history, stats, API key, and preferences
- **IMSLP MediaWiki API** for looking up canonical piece URLs on click
- **Web Audio API** for the metronome click sound
- Google Fonts (Playfair Display, DM Sans) for typography

---

## Two Modes

### 1. IMSLP Library Mode
Serves random public domain piano pieces from a curated database. Each piece links out to IMSLP where the user opens the actual sheet music PDF.

**Features:**
- Curated database of ~75+ pieces with metadata
- Filters: Difficulty, Era, Key Signature
- Per-piece display: composer, title, subtitle/opus, key, era, difficulty, style tags, suggested BPM
- "Open on IMSLP" button — queries the IMSLP MediaWiki API on click to find the canonical URL, falls back to hardcoded URL if API fails
- Metronome: defaults OFF, BPM auto-populates from piece metadata when piece loads, user starts manually
- Too Easy / Too Hard feedback buttons — shift the difficulty filter up or down one level and load a new piece
- Next Piece / Skip buttons
- Reset Queue — clears seen set so all pieces become eligible again, keeps stats
- Reset Session — full wipe of seen set, stats, history, streak
- Session stats: Played, Skipped, Streak
- Scrollable session history with timestamps
- Pool size warning when fewer than 3 pieces match current filters

**Difficulty Scale (5 levels):**
- **Beginner** — five-finger position, simple rhythms, minimal hand shifts (Gurlitt, Burgmüller early studies, Czerny Op.599, Beyer, Anna Magdalena Notebook, Bartók For Children)
- **Early Intermediate** — both hands, moderate coordination, limited position shifts (Clementi/Kuhlau sonatinas, Bach inventions, Mozart Sonata facile, Für Elise)
- **Late Intermediate** — more complex rhythms, wider range, moderate technical demands (Moonlight Sonata, Chopin preludes, Schubert)
- **Advanced** — significant technical challenge (Brahms intermezzi, Debussy Clair de lune, Chopin études)
- **Virtuoso** — concert level (Chopin Ballade No.1, Rachmaninoff Op.3 No.2)

**Important notes on difficulty:**
- The scale was deliberately recalibrated — what most apps call "Beginner" is actually "Early Intermediate." The user confirmed this feels right.
- Claude's knowledge of repertoire is reliable for well-known pieces but less so for obscure ones — the database is intentionally conservative.
- IMSLP does NOT have standardized difficulty ratings in their API. The ratings are Claude's estimates based on pedagogical knowledge.

### 2. Generated Music Mode
Uses the Anthropic API to generate original MusicXML piano exercises on demand, rendered inline via OSMD.

**Generation Parameters:**
- Difficulty: 1–10 scale (Claude is constructing to spec, not estimating — so granular scale is appropriate here)
- Key Signature: all 24 major/minor keys, or random
- Time Signature: 4/4, 3/4, 6/8, 2/4, or random
- Length: 4, 8, 16, or 32 bars
- Style: Baroque, Classical, Romantic, Impressionist, Modern, or random
- Hand Target: Both Hands, Right Hand Only, Left Hand Only
- Challenge Targets (multi-select): Accidentals, Syncopated Rhythms, Wide Intervals, Hand Independence (only available when Both Hands selected), Dense Chords, Rapid Passages, Counterpoint, Irregular Rhythms

**Features:**
- Inline score rendering via OSMD after generation
- Claude suggests BPM as part of generation (parsed from MusicXML metronome marking)
- Metronome defaults OFF, BPM auto-populates from suggested tempo, user starts manually
- Regenerate Easier / Regenerate / Regenerate Harder buttons (adjust difficulty by ±2)
- Next / Skip buttons
- Session stats and history showing generation parameters used
- API key input — stored in localStorage under key `anthropic_api_key`

---

## Metronome (Shared)
Both modes have identical metronome functionality:
- Defaults to OFF on load
- BPM display + slider (range 20–240)
- +/- buttons (adjust by 5)
- Tap Tempo button
- Subdivision toggle: Quarter note or Eighth note
- Visual beat indicator (dot that flashes)
- Audio click via Web Audio API (accent on beat 1)
- On/Off toggle button
- When a new piece loads: BPM updates to suggested tempo but metronome state is preserved (if it was on, it restarts at new tempo; if off, stays off)

---

## Technical Architecture

### File Structure
Single file: `sight_reading.html`
- All CSS embedded in `<style>` tags
- All JavaScript embedded in `<script>` tags
- No build process, no dependencies to install
- Can be opened directly in any browser

### Key JavaScript Functions
- `init()` — runs on DOMContentLoaded, loads localStorage, applies filters, loads first piece
- `applyLibraryFilters(reload)` — filters PIECES array, optionally loads new piece
- `pickLibraryPiece()` — picks random piece excluding current and already-seen, resets seen set when exhausted
- `loadLibraryPiece()` — renders piece to DOM, updates metronome BPM
- `openOnIMSLP()` — queries IMSLP MediaWiki API, opens best matching URL, falls back to hardcoded URL
- `generateExercise(diffOffset)` — calls Anthropic API, generates MusicXML, renders via OSMD
- `renderScore(xml)` — initializes/reuses OSMD instance, loads and renders MusicXML
- `startMetronome(id)` / `stopMetronome(id)` — metronome control for 'lib' or 'gen'
- `setMetronomeBpm(id, bpm)` — updates BPM display and restarts if running
- `tapTempo(id)` — calculates BPM from tap timing, uses 3-second window
- `resetQueue()` — clears seen set, loads new piece
- `resetSession()` — full reset of stats, history, seen set

### localStorage Keys
- `sightReading_v2` — JSON object containing lib and gen session data (played, skipped, streak, history arrays)
- `anthropic_api_key` — Anthropic API key for Generated Mode

### IMSLP API Usage
On "Open on IMSLP" click:
```
https://imslp.org/api.php?action=query&list=search&srwhat=title&srsearch=[title+composerLastName]&srlimit=5&format=json&origin=*
```
Takes best result that includes composer last name, constructs URL as `https://imslp.org/wiki/[encoded_title]`.

### Anthropic API Usage
Model: `claude-sonnet-4-20250514`
Max tokens: 4000
Prompt instructs Claude to return ONLY valid MusicXML with no markdown, no preamble.
BPM extracted from `<per-minute>` tag in returned XML.

---

## Design System
Dark theme throughout:
- Background: `#0e0e0e`
- Surface: `#161616`, `#1e1e1e`, `#272727`
- Accent: `#c8a96e` (gold)
- Text: `#f0ede6` (warm white), `#a09890` (secondary), `#5c5550` (tertiary)
- Green: `#6a9e6a` (easy/success), Red: `#9e6a6a` (hard/error), Blue: `#6a8a9e` (regen)
- Fonts: Playfair Display (serif, for titles/numbers), DM Sans (sans-serif, for UI)
- Border radius: 8px (standard), 14px (cards)

---

## Known Issues / Limitations
1. **IMSLP URL reliability** — hardcoded fallback URLs for some pieces (especially pedagogical collections like Beyer, Czerny) link to the collection page, not individual pieces. The live API lookup mitigates this for well-known pieces.
2. **MusicXML generation quality** — varies. Simpler exercises render more reliably. Complex ones may have layout quirks in OSMD.
3. **CORS on IMSLP API** — the `origin=*` parameter is required for browser-side requests. If IMSLP changes their CORS policy this could break.
4. **API key in frontend** — the Anthropic API key is stored in localStorage and used directly from the browser. Fine for personal use, not suitable for public deployment without a backend proxy.

---

## Decisions Made and Why
- **Single HTML file** — keeps deployment simple, no build process needed for a personal tool
- **5-level difficulty for Library, 1-10 for Generated** — Library uses estimates (less granular is more honest), Generated constructs to spec (granular is appropriate)
- **No attempt tracking** — removed because the user flow (going to IMSLP in a separate tab) means tracking attempts has no practical value
- **Metronome defaults off** — auto-starting was intrusive, user wants control
- **localStorage over backend** — personal tool used on one device, no need for server-side persistence
- **Curated database over pure API** — IMSLP API only returns title/composer/URL, no difficulty/key/tempo metadata. Curated approach allows richer filtering.
- **Generated Mode uses Claude API** — IMSLP's MusicXML library is too sparse and inconsistently formatted for reliable use

---

## What's Been Built vs What's Planned

### Built ✓
- Full IMSLP Library Mode with filters, metronome, stats, history, reset
- Full Generated Music Mode with OSMD rendering, all generation parameters
- IMSLP MediaWiki API URL lookup
- localStorage persistence
- Responsive dark UI

### Still To Build / Improve
- Expand the piece database (currently ~75 pieces, could be much larger)
- Verify and fix remaining broken IMSLP URLs in the database
- Better error handling for OSMD rendering failures
- Potentially move to GitHub and host on Vercel for stable URL and persistent localStorage
- Consider backend proxy for API key security if ever made public
- GitHub setup and version control workflow (user is learning this)

---

## User Context
The user (Makay) is learning development concepts alongside building this app. They are not an experienced developer. Key things they've learned during this project:
- localStorage vs sessionStorage vs cookies
- Frontend vs backend, local vs hosted
- GitHub as version control (not a code editor)
- VS Code as the code editor
- Vercel/Netlify for free hosting
- nvm + Node.js installation on Mac
- Claude Code CLI setup

They are now running Claude Code locally in their project folder on iCloud Drive. This is their first real development project.
