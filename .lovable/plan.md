
# NovaTrack Teacher App

## Overview
A clean, minimal teacher-facing app that connects to your existing NovaTrack Supabase backend. Two workspace modes: solo independent teacher or connected agency member.

---

## 1. Supabase Connection & Backend Guard
- Connect to your existing NovaTrack Supabase project using your URL + anon key
- On app load, query `public.app_handshake(id=1)` and verify `app_slug = 'novatrack'`
- If the check fails, block the UI with a clear error screen ("Unauthorized application")

## 2. Authentication & Workspace Selector
- Login screen using Supabase Auth (email/password)
- After login, determine workspace mode:
  - **No agency memberships?** → Auto-create a solo agency workspace (`agency_type='solo_teacher'`) — output SQL if schema changes needed
  - **Has agency memberships?** → Show workspace switcher listing "My Classroom" (solo) + any connected agencies
- Persist selected workspace in session; allow switching anytime via a dropdown in the header

## 3. Assigned Students/Clients List + Drilldown
- **Solo mode**: Full CRUD on student/client profiles within the teacher's solo agency (query `public.clients` view, scoped by `agency_id`)
- **Connected mode**: Read-only list of assigned clients via `public.user_client_access` view, filtered by permission flags
- **Drilldown view** for each client: profile details, recent ABC logs, IEP drafts, and relevant notes/documents (gated by `can_view_notes` permission)

## 4. Trigger Tracker (ABC Logging)
- **Fast-log interface**: Tap-based UI to quickly record Antecedent → Behavior → Consequence with auto-timestamp
- **Configurable behaviors**: Teachers can define custom behavior categories and triggers per student before logging sessions
- **Charts & summaries**: Frequency charts, trend graphs over time, and per-session summaries using Recharts
- Gated by `can_collect_data` permission flag in connected mode; always available in solo mode

## 5. IEP Writer
- **Template library**: Pre-built IEP section templates (Present Levels, Goals, Accommodations, etc.)
- **Rich text editor**: Draft and save IEP sections per student with auto-save
- **AI-assisted generation**: Use Lovable AI to suggest IEP goal language based on collected ABC data and student profile
- **PDF export**: Generate and download completed IEPs as formatted PDFs
- Gated by `can_generate_reports` permission flag in connected mode; always available in solo mode

## 6. Navigation & Layout
- Clean, minimal design with plenty of whitespace
- Top navigation bar with: workspace switcher, student search, and user menu
- Sidebar or tab-based navigation: Students, Trigger Tracker, IEP Writer
- Fully responsive for tablet use in classrooms
- Toast notifications for save confirmations and errors

## Schema Notes
- No database schema will be created or modified in this project
- If any schema additions are needed (e.g., solo agency auto-creation logic, ABC log tables, IEP draft tables), SQL will be output for you to run in the NovaTrack core project
