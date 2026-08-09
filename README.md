# foodie — voice-ordering food delivery demo

A Zomato/Swiggy-style food ordering app you talk to. Say what you want, across a real
multi-restaurant menu, and it lands in your cart correctly — including asking you to pick a
restaurant when a dish (like Kadhai Paneer) exists on more than one menu.

**Live demo:** _add your deployed link here once Render finishes building_
**Stack:** vanilla JS frontend, Node/Express backend, Postgres via Supabase, LLM-based voice
parsing (Ollama locally / Groq when deployed), Web Speech API for speech-to-text.

---

## The problem

Voice ordering sounds simple until you actually try to build it: speech-to-text is unreliable
(homophones, mid-sentence corrections, accents), the same dish name can exist on multiple
restaurants' menus with different prices, and a naive "does this string contain that string"
matcher breaks in genuinely funny ways — "non veg burger" happily matches "veg burger" because
the substring is right there. This project is my attempt to build that pipeline properly: from
raw microphone audio to a correctly-populated cart, handling the ambiguity honestly instead of
guessing silently.

## Architecture

```
┌─────────────┐     Web Speech API      ┌──────────────────┐
│   Browser   │ ──── (speech→text) ───▶ │  Raw transcript   │
│  (frontend) │                          └────────┬─────────┘
└──────┬──────┘                                   │
       │ POST /api/parse-voice                    ▼
       │ { transcript, catalog, activeRestaurantId }
       ▼
┌─────────────────┐        ┌─────────────────────────────┐
│  Node/Express    │───────▶│  LLM provider (pluggable)   │
│  backend         │        │  • Ollama (local, free)     │
│  (server.js)     │◀───────│  • Groq (hosted, free tier) │
└──────┬───────────┘        └─────────────────────────────┘
       │ structured JSON: { actions: [{type, quantity, size, candidates}] }
       ▼
┌──────────────────────────────────────────────┐
│  Frontend cart logic                          │
│  • 1 candidate → add directly                 │
│  • 2+ candidates → disambiguation modal        │
│  • different restaurant already in cart       │
│    → "clear cart?" confirm                    │
└──────┬─────────────────────────────────────────┘
       │
       ▼
┌─────────────────┐
│  Supabase        │  restaurants, menu_items, orders, order_items
│  (Postgres)      │  + Supabase Auth (magic link) for order history
└──────────────────┘
```

If the LLM backend is ever unreachable (server not running, Ollama down, network issue), the
frontend automatically falls back to a local regex/substring parser instead of breaking —
noticeably worse at messy speech, but the app stays usable.

## Key features

- **Voice-to-cart pipeline** using the Web Speech API + an LLM to turn natural, messy speech
  ("umm add like two burgers, no actually make it three, and a coke") into structured cart
  actions — quantity, size, and item all correctly resolved, including self-corrections.
- **Cross-restaurant disambiguation** — when a spoken dish exists on multiple menus, the app
  asks which restaurant instead of guessing, via a proper UI, not a coin flip.
- **Real database, not mock data** — restaurants, menu items, orders, and order line items live
  in Postgres via Supabase, with row-level security.
- **Order history behind real auth** — Supabase magic-link auth ties each order to a user, with
  RLS ensuring people can only ever read their own orders.
- **Graceful degradation at every layer** — no LLM backend → falls back to local parsing; no
  Supabase connection → falls back to bundled demo menu data. The app never hard-fails.
- **Zero-cost by default** — local LLM inference via Ollama, free-tier Postgres via Supabase,
  free-tier hosted inference via Groq for the deployed version. No required paid dependency
  anywhere in the stack.

## Engineering decisions & tradeoffs

**Why an LLM instead of pure NLP/regex for parsing?**
I started with substring matching + Levenshtein distance for near-misses. It worked for clean,
single-item commands but fell over on anything conversational — self-corrections, multiple items
in one breath without clear separators, and (memorably) a same-substring collision bug where
"non veg burger" matched the veg item because "veg burger" is literally contained inside it.
Swapping to an LLM with the full menu as context handles all of this by understanding intent
rather than pattern-matching text. The regex parser is still in the codebase as a fallback —
worse, but free and instant, and it means the app degrades rather than breaks if the LLM path is
unavailable.

**Why local Ollama instead of a paid API?**
Cost. This project needed to run at $0, so the primary path is Ollama running a small local
model (`llama3.2`, 3B params) — free, no signup, works offline. The tradeoff is real: a 3B local
model is less capable at ambiguous speech than a large hosted model. For deployment (where
Ollama can't run — most hosting platforms don't give you a GPU or persistent local process for
free), the backend swaps to Groq's free tier instead via a single environment variable, with no
frontend changes needed, since both providers are normalized to the same JSON contract by the
backend.

**Why does the LLM only return *candidates*, not resolve the restaurant itself?**
Early on I had the LLM try to guess the "right" restaurant using cart context I passed it. This
duplicated logic the frontend already needed to do correctly (prefer the restaurant currently
open, prefer the restaurant already in the cart, otherwise ask) and occasionally the LLM's guess
disagreed with the frontend's — two sources of truth for the same decision. Now the LLM's only
job is "which items could this plausibly refer to," and a single piece of frontend logic
(`resolveMentionSync`) is the one place that decides how to resolve ambiguity. One responsibility
per layer, easier to reason about and to debug.

**Why magic-link auth instead of passwords?**
No password storage/hashing to get wrong, no "forgot password" flow to build, and it matches the
low-friction feel a food-ordering app should have. Supabase handles the email delivery and token
verification.

## Bugs I hit and fixed (a real debugging log, not a highlight reel)

- **Substring collision bug** — "non veg burger" matched the "veg burger" item because the
  shorter alias is literally a substring of the longer phrase. Fixed with more specific aliases
  *and* a general guard that rejects a veg-only item match if it's immediately preceded by "non".
  This is exactly the class of bug the LLM-based rewrite eliminates by design.
- **Mic stopped working after first use** — `recognition.onend` cleared the CSS classes but never
  reset the actual `listening` state variable, so every subsequent tap called `.stop()` on an
  already-stopped recognizer instead of `.start()`. Classic "state and UI drifted apart" bug.
- **Quantity homophones** — Chrome's speech recognition frequently transcribes "two" as "to",
  especially with non-US accents. Fixed by tightening quantity detection to only check the word
  immediately before the item name (reducing false positives) and adding known homophones to the
  recognized set.
- **`file://` vs `http://localhost`** — mic permissions and Supabase both behave inconsistently
  when a file is opened directly from disk instead of served. Consolidated the whole app behind
  one Express server so this class of issue can't recur.

## What I'd improve with more time

- **Evaluation harness** — a set of 30-40 test transcripts (including deliberately messy ones)
  run against both the LLM parser and the regex fallback, scored for accuracy, so "the parser
  works well" is a measured claim, not a vibe.
- **Streaming/multi-turn voice** — right now each mic tap is a single, independent utterance.
  A real assistant would hold conversational state ("add paneer tikka" → "make that two").
- **Restructure into components** — this is currently one large HTML file for iteration speed;
  a React/TypeScript rewrite with proper component boundaries would be the natural next step for
  a production version.
- **Tests** — unit tests around the parsing/matching logic and the cart state machine.
- **Real-time order status** — a mock "Preparing → Out for delivery → Delivered" tracker.

---

## Setup (local development)

**1. Install Ollama** (free, local LLM):
```bash
brew install ollama
ollama pull llama3.2
```

**2. Install server dependencies:**
```bash
cd server
npm install
cp .env.example .env   # defaults to LLM_PROVIDER=ollama, no changes needed for local dev
```

**3. Set up the database** — create a free project at [supabase.com](https://supabase.com), then
in the SQL Editor run, in order:
```
supabase_schema.sql
supabase_seed.sql
supabase_auth_upgrade.sql
```

**4. Add your Supabase credentials** — open `public/voice-order.html`, find `SUPABASE_URL` and
`SUPABASE_ANON_KEY` near the top of the `<script>` block, and paste in your project's values
(Supabase dashboard → Settings → API).

**5. Run it:**
```bash
npm start
```
Open `http://localhost:3000/voice-order.html`.

## Deployment

Ollama can't run on most free hosting platforms (no persistent local process/GPU), so the
deployed version uses **Groq** instead — also free, no code changes needed beyond environment
variables, since the backend normalizes both providers to the same interface.

**1. Get a free Groq API key** at [console.groq.com/keys](https://console.groq.com/keys) — no
credit card required.

**2. Deploy to [Render](https://render.com)** (free tier):
- New → Web Service → connect this repo
- Render will pick up `render.yaml` automatically, or set manually:
  - Build command: `npm install`
  - Start command: `npm start`
  - Environment variables: `LLM_PROVIDER=groq`, `GROQ_API_KEY=<your key>`

**3. Supabase needs no changes** — it's already cloud-hosted, so the deployed app talks to the
same database as your local dev environment (or point it at a separate production project if you
want to keep demo data isolated).

Note: Render's free tier sleeps after inactivity and takes ~30-60s to wake on the first request —
expected for a free-tier demo, not a bug.
