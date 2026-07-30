# Project Rules for Eventgage

## Imperative Security & Architecture Rules

1. **Supabase RLS & Backend Proxying**:
   - Row Level Security (RLS) policies in Supabase must **NOT** be public or bypassable directly from the front-end client.
   - All database reads and writes from the client must be consumed through the backend server (Vite middleware / Node `server.js` API endpoints).
   - Direct front-end calls to Supabase database tables bypass target security validation and are strictly prohibited.

2. **Schema & Naming Conventions**:
   - Database schema: `bem`.
   - All project table names must use the `eventgage_` prefix (e.g., `bem.eventgage_user`, `bem.eventgage_event_avatar`, `bem.eventgage_events`, etc.).

3. **Design, UI & UX Rules**:
   - Mobile-First design orientation.
   - Rich aesthetic, dark mode support, glassmorphism, dynamic micro-animations, modern typography.
   - **Loading States & Feedback**: Always include explicit loading spinners, disable buttons, and prevent double submission during asynchronous backend requests or navigation transitions.
   - **Visual Spacing & Rhythm**: Always ensure generous margins, paddings, and flex/grid gaps (`gap: 1rem+`, `margin-bottom: 1.25rem+`) to clearly separate cards, headers, form controls, and widgets. UI elements must never feel cramped or glued together.
