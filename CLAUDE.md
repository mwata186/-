# CLAUDE.md — 営業日トラッカー (Business Day Tracker)

## Project Overview

A zero-dependency, client-side web application that visualizes monthly business day progress for Japanese business users. It tracks which business day of the month the current (or selected) date falls on, excluding weekends and Japanese public holidays.

**Language note:** The application UI and internal comments are in Japanese. Source code identifiers use English and camelCase.

---

## Repository Structure

```
/
├── index.html    # Single-page HTML shell; all DOM structure is here
├── style.css     # All styling; uses CSS Variables, Flexbox, Grid
├── app.js        # All application logic; no modules or bundler
└── DESIGN.md     # Original design specification (Japanese)
```

There are **no build tools, no package manager, no test framework, and no external dependencies**. The app runs by opening `index.html` directly in a browser or serving the directory with any static file server.

---

## Running the App

```bash
# Option 1: open directly
open index.html

# Option 2: serve statically (any HTTP server works)
python3 -m http.server 8080
npx serve .
```

No install step is needed.

---

## Architecture

The app is entirely client-side with no backend:

```
index.html  (DOM structure & element IDs)
    ↓ loads
style.css   (visual presentation)
app.js      (all logic: state, rendering, event handling)
```

### `app.js` internal layout (in order)

| Section | Lines | Description |
|---|---|---|
| `HOLIDAYS` constant | 1–87 | Hardcoded Japanese holiday map, `"YYYY-MM-DD"` → holiday name, covering 2024–2027 |
| Utility functions | 92–127 | Pure date helpers: `toKey`, `isHoliday`, `holidayName`, `isWeekend`, `isBusinessDay`, `daysInMonth`, `countTotalBizDays`, `currentBizDayNumber` |
| App state | 145–160 | Module-level mutable globals: `viewYear`, `viewMonth`, `selYear`, `selMonth`, `selDay` |
| Rendering | 165–280 | `render()` orchestrates all DOM updates; `renderCalendar()` builds the calendar grid |
| Event listeners | 285–307 | Prev/next month buttons, "Today" button, initial `render()` call |

---

## Key Concepts

### State model

There are two independent state variables:

- **View state** (`viewYear`, `viewMonth`): which month the calendar is displaying.
- **Selection state** (`selYear`, `selMonth`, `selDay`): which date the progress stats are calculated for.

When the selected date is not in the currently viewed month, progress stats show `"-"` and the bar shows 0%.

### Business day logic

```
isBusinessDay(y, m, d):
  NOT isWeekend(y, m, d) AND NOT isHoliday(y, m, d)

countTotalBizDays(y, m):
  count of all isBusinessDay days in the month

currentBizDayNumber(y, m, selDay):
  count of isBusinessDay days from day 1 up to selDay (inclusive)

progressRate = currentBizDayNumber / countTotalBizDays
```

### Holiday data

The `HOLIDAYS` object is a plain JavaScript object keyed by `"YYYY-MM-DD"` strings. It includes standard Japanese national holidays and substitute holidays (振替休日) for 2024–2027, sourced from the Cabinet Office (内閣府). **To extend coverage beyond 2027, add entries directly to this object.**

### Calendar rendering

The calendar starts weeks on **Monday** (Japanese convention). The first day's column offset is computed as `(firstDow + 6) % 7`. Each cell is a `<div class="cal-cell ...">` built dynamically via `renderCalendar`. CSS class priority (first match wins in the CSS, applied via JavaScript class logic):

1. `today` — the actual current date
2. `selected` — user-clicked date (when not today)
3. `saturday` — Saturday (not holiday/today/selected)
4. `holiday` — Sunday or public holiday
5. `bizday` — normal business day
6. `past-bizday` — modifier added to business days before today (reduces opacity)

---

## Naming Conventions

| Context | Convention | Example |
|---|---|---|
| JS variables & functions | camelCase | `viewYear`, `isBusinessDay()`, `countTotalBizDays()` |
| CSS classes | kebab-case | `cal-cell`, `stat-card`, `progress-bar-fill` |
| HTML element IDs | camelCase | `calendarGrid`, `progressBar`, `todayBtn` |
| Holiday keys | `"YYYY-MM-DD"` strings | `"2026-03-20"` |
| User-facing text | Japanese | `"営業日目"`, `"今日に戻る"` |

---

## DOM Element IDs (index.html ↔ app.js contract)

| ID | Purpose |
|---|---|
| `monthTitle` | Displays `"YYYY年M月"` |
| `prevBtn` / `nextBtn` | Month navigation buttons |
| `todayBtn` | Resets view and selection to today; hidden when already on today |
| `currentBizDayLabel` | Dynamic label above current biz day number |
| `currentBizDay` | Numeric business day of selected date |
| `currentBizDayUnit` | Unit label (`"営業日目"` or fallback text) |
| `totalBizDays` | Total business days in viewed month |
| `progressPercent` | Percentage string |
| `progressBar` | `<div>` whose `width` style is set to `pct%` |
| `progressDetail` | `"current / total 営業日"` detail text |
| `calendarGrid` | Container rebuilt on every `render()` call |

**Do not rename these IDs** without updating both files.

---

## CSS Color System

Defined via CSS custom properties in `style.css`:

| Variable / Class | Color | Meaning |
|---|---|---|
| `.today` | `#1a73e8` (blue) | Today's date |
| `.selected` | `#0d47a1` (dark blue) | User-selected date |
| `.saturday` | `#4a90d9` (light blue) | Saturday |
| `.holiday` (Sun/holiday) | `#e53935` (red) | Sunday or public holiday |
| `.bizday` | `#333333` | Normal business day |
| `.past-bizday` modifier | reduced opacity | Past business days this month |
| Progress bar fill | `#1a73e8` | Matches today color |

---

## Development Workflow

### Making changes

1. Edit `index.html`, `style.css`, or `app.js` directly — no compilation step.
2. Refresh the browser to see changes.

### Adding holidays

To add or correct holiday data, edit the `HOLIDAYS` object in `app.js`:

```javascript
// Format: "YYYY-MM-DD": "Holiday name in Japanese"
"2028-01-01": "元日",
"2028-01-10": "成人の日",
```

### Extending functionality

- **New UI elements:** Add DOM in `index.html`, style in `style.css`, wire up in `app.js` inside `render()` or `renderCalendar()`.
- **New calculations:** Add pure utility functions in the utility section of `app.js`, then call from `render()`.
- **No module system** is used — all code shares the global scope. Keep new globals minimal; prefer function-scoped variables.

### Commit and push

The project uses git with SSH commit signing (configured via local git config). Work on the designated feature branch:

```bash
git add <files>
git commit -m "descriptive message"
git push -u origin <branch-name>
```

---

## Constraints and Conventions to Preserve

1. **Zero dependencies** — do not introduce `npm`, bundlers, frameworks, or CDN libraries without explicit requirement.
2. **Single-file modules** — keep logic in `app.js`, styles in `style.css`, structure in `index.html`.
3. **`'use strict';`** at the top of `app.js` — required, do not remove.
4. **No server-side code** — the app must remain deployable as a static site.
5. **Japanese UI text** — all user-visible strings should remain in Japanese unless asked to add i18n.
6. **Monday-start calendar** — the `(firstDow + 6) % 7` offset formula must be preserved.
7. **`render()` is the single source of truth** — all state changes must be followed by a `render()` call; never update the DOM directly outside `render()` or `renderCalendar()`.

---

## Known Limitations

- Holiday data is static and must be manually updated for years beyond 2027.
- No automated tests exist; verify changes by manual browser testing.
- No error handling for edge cases (e.g., year 0, far-future dates beyond HOLIDAYS coverage — will silently treat unknown dates as non-holidays).
- The app does not persist the selected date across page reloads (always resets to today).
