# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start Vite dev server (localhost:5173)
npm run build     # production build
npm run preview   # preview production build locally
```

No test suite or linter is configured.

## Environment

Copy `.env` and populate before running:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_KEY=...
```

The Anthropic API is called **directly from the browser** in `analyzeImage` and `analyzeMatch`. Requires `VITE_ANTHROPIC_KEY` in `.env` — set it to a valid Anthropic API key.

## Architecture

**Single-page React app** (Vite, no TypeScript, no router library, no component library).

All application code lives in two files:
- `src/App.jsx` (~2600 lines) — every screen, component, and business logic
- `src/LandingPage.jsx` — unauthenticated landing page

### Navigation model

There is no URL router. A `tab` state string drives which "page" renders. `MobileLayout` and `DesktopLayout` are the two root containers (switched via `useIsMobile()`). The top-level `SpartsHub` default export orchestrates auth state and passes everything down as props.

Auth flow: `LandingPage` → `AuthScreen` → `MobileLayout` | `DesktopLayout`

### Supabase (`src/supabase.js`)

`sb` is the singleton Supabase client. The app uses:
- `sb.auth` — email/password auth
- `sb.from(table)` — direct table queries (no ORM)
- `sb.channel(...)` — real-time subscriptions for chat and unread badge

Tables used: `listings`, `requests`, `messages`, `profiles`, `matches`

### AI match engine

When a listing or request is created, `runMatchEngine` fires in the background:
1. Fetches up to 50 rows from the opposing table
2. Calls `analyzeMatch` (Claude API) for each candidate pair
3. On score ≥ 70, calls `notifyMatch` which inserts a row into `matches` and sends an auto-message via `sb.from("messages").insert(...)`

`analyzeImage` (Claude vision) is used in the "Identificar con IA" publish flow to auto-fill form fields from a photo.

### Design system (`src/theme.js`)

Two exports:
- `T` — color token object (`RED`, `BG`, `CARD`, `TEXT`, etc.). Always destructured at the top of `App.jsx`.
- `CSS_BASE` — global CSS string injected via `<style>{CSS_BASE}</style>` in each layout root. Contains utility classes: `.bebas`, `.btn-red`, `.btn-ol`, `.btn-ghost`, `.inp`, `.card`, `.tag`, `.t-red / .t-green / .t-dim`, `.sheet`, `.spinner`, `.sidebar-btn`, etc.

All component styles are **inline JS style objects** using `T` token values. Never use raw hex colors — always reference tokens from `T`.

### Key domain constants (in `App.jsx`)

- `CATS` — industry categories (id + label + emoji): `min`, `for`, `const`, `ene`, `trans`, `fae`, `rut`, `san`, `serv`
- `CONDITIONS` — `["Nuevo","Usado – Bueno","Usado – Regular","Reacondicionado"]`
- `CURRENCIES` — `["USD","CLP","EUR","COP","PEN","MXN"]`

### Inline SVG icon system

`<Ic n="iconName" s={size} c={color} sw={strokeWidth}/>` — renders from an inline dictionary of SVG path literals. Adding a new icon means adding an entry to the `p` object inside `Ic`.

## Important patterns

- **No CSS files** — all styling is inline objects + `CSS_BASE` utility classes.
- **No state management library** — everything is `useState`/`useEffect` with prop drilling.
- **Modal/sheet pattern** — overlays are rendered as `position:fixed` siblings inside the layout component, controlled by local boolean state (`showPublish`, `showSolicitud`, `showSupport`).
- **Real-time** — Supabase channels are subscribed in `useEffect` and cleaned up on return (pattern used in `ChatView` and both layout components for unread counts).
