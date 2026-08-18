# Project Rules for Eventgage

## Imperative Security & Architecture Rules

1. **Supabase RLS & Backend Proxying**:
   - Row Level Security (RLS) policies in Supabase must **NOT** be public or bypassable directly from the front-end client.
   - All database reads and writes from the client must be consumed through the backend server (Vite middleware / Node `server.js` API endpoints).
   - Direct front-end calls to Supabase database tables bypass target security validation and are strictly prohibited.

2. **No Hardcoded Secrets or Keys in Code**:
   - Secrets, API keys, and connection URLs (Supabase URL, Anon Key, Service Role Key) must **NEVER** be hardcoded as fallback strings in any source file (`.ts`, `.svelte`, `.js`).
   - All credentials must be read strictly from environment variables (`.env` via `$env/dynamic/private` or `$env/dynamic/public`).

3. **Schema & Naming Conventions**:
   - Database schema: `bem`.
   - All project table names must use the `eventgage_` prefix (e.g., `bem.eventgage_user`, `bem.eventgage_event_avatar`, `bem.eventgage_events`, etc.).

4. **Design, UI & UX Rules**:
   - Mobile-First design orientation.
   - Rich aesthetic, dark mode support, glassmorphism, dynamic micro-animations, modern typography.
   - **Loading States & Feedback**: Always include explicit loading spinners, disable buttons, and prevent double submission during asynchronous backend requests or navigation transitions.
   - **Visual Spacing & Rhythm**: Always ensure generous margins, paddings, and flex/grid gaps (`gap: 1rem+`, `margin-bottom: 1.25rem+`) to clearly separate cards, headers, form controls, and widgets. UI elements must never feel cramped or glued together.

5. **Newest Content First Rule**:
   - All lists of dynamically unlocked or generated content (newly unlocked missions, newly acquired items, new dialogues, lore journal entries, feed updates) must **ALWAYS be ordered newest-first** (unlocked/recent items at the top of the list).

6. **Documentation of Developed Mechanics & Capabilities**:
   - Always keep [`docs/system_capabilities_and_mechanics.md`](file:///Users/freetoplay/Dev/Svelte/eventgage/docs/system_capabilities_and_mechanics.md) updated.
   - If new mechanics, systems, or capabilities are **developed in code** (not when merely planned or ideated), the agent responsible MUST document their functionality, data structures, and a complete JSON/SQL configuration example in `docs/system_capabilities_and_mechanics.md` so that future agents and designers can easily configure and build games.

7. **Game Design Workflow & Non-Existent Mechanics**:
   - When designing games or events (in `docs/designs/`), the agent must validate each requested mechanic against [`docs/system_capabilities_and_mechanics.md`](file:///Users/freetoplay/Dev/Svelte/eventgage/docs/system_capabilities_and_mechanics.md).
   - If the game designer requests or specifies a mechanic that does **not** yet exist in the codebase/documentation, it must be explicitly documented within the game design file as a **Mecánica por Desarrollar / Nota de Desarrollo (Feature to Develop)**, specifying its expected behavior and requirements so that it can be implemented into the platform later.

