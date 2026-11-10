# Roadmap

## Security — verified staff and portal access (in progress)

- [x] Add Core-verified staff path for parent-link management without changing classroom sign-in.
- [x] Validate both parent portal routes server-side; constrain every read/message to the link's student and agency.
- [x] Restrict parent_access_links credentials to service-role after replacement paths are deployed.
- [x] Test guest message end-to-end, invalid credentials, forged ownership, expired/revoked links, and cross-agency links; temporary fixtures removed.
- [ ] Authenticated path: UNVERIFIED — no Cloud auth users/session available; external Core authenticated classroom testing cannot be supplied by managed auth-session.
- [ ] Migrate remaining staff-facing data consumers before locking shared clinical/reinforcement/message/classroom tables.
- [x] Student portal reads (StudentPortal, StudentPortalEnhanced, ExternalStudentPortal, game-data) route through the portal-access student branch; browsers no longer query student_portal_tokens, student_portal_accounts, external_access_links, or student_login_codes. Invalid-token and forged-field rejection verified live; valid-token happy path UNVERIFIED (no Core session; sandbox cannot reach the Core host).
- [ ] Student link management (ExternalAccessSheet create/revoke) still writes Core token tables directly from the browser; needs a Core staff session to test a server-side replacement.
- [ ] External Core database access from the sandbox is blocked (host unreachable, http 000); Core table schemas and RLS can only be exercised through deployed backend functions or a real staff browser session.

Requested fixes for the following scanner findings, all of which need database
access-rule (RLS / function / view) changes:

`guest_data_rls_true`, `parent_token_enumerable`, `rls_core_tables`,
`student_portal_token_lookup`, `SUPA_anon_security_definer_function_executable`,
`SUPA_authenticated_security_definer_function_executable`,
`SUPA_function_search_path_mutable`, `SUPA_rls_disabled_in_public`,
`SUPA_security_definer_view`, `abc_logs_public_clinical_data`,
`admin_audit_log_open`, `classroom_groups_anon_write`, `guest_access_codes_open`,
`guest_data_rls_true_broad`, `help_interactions_rls_disabled`,
`iep_documents_public_read`, `invite_codes_anon_write`,
`mayday_contacts_public_pii`, `parent_access_links_anon_enumerable`,
`reinforcement_ai_recommendations_no_scoping`, `student_parent_links_public_pii`,
`student_reinforcement_open_anon`, `thread_messages_pii_open`

**Completed — hosted database resumed and verified reachable.** Selected
function execution privileges are restricted to service_role, all public views
use security_invoker, all public functions have a fixed search_path, and
help_interactions has RLS enabled with server-only access.

**Remaining blocker — identity architecture.** Staff sign in against the external Nova
Core project, so this database sees the app as the `anon` role and `auth.uid()`
is null. Agency-scoped policies keyed on `auth.uid()` would lock the whole app
out. Remaining staff-facing table lockdowns require a verified Core-to-Cloud
identity or server-authorized data path first. Public portal links require
server-side token validation before anonymous table access can be removed.
`rls_core_tables` requires access to the external Core project's database.

**Verification:** Live catalog confirms zero public tables without RLS, zero
mutable public function search paths, zero security-definer public views, and
no anonymous/authenticated execution privileges on the eight definer routines.
Cloud has no auth users, so authenticated staff end-to-end checks cannot be
performed with a managed Cloud session. The currently persisted scan no longer
lists the selected legacy IDs as active; no unselected scan IDs were changed.

**This pass:** 18 focused tests pass. Both parent routes reject invalid links.
A valid isolated guest link loaded its scoped data, submitted a message, and
read that message back in the UI; stored owner was NULL and agency/student IDs
matched the link. Invalid bearer message requests returned 401 and supplied
owner IDs returned 400. Expired/revoked and cross-agency links returned 403.
Direct anonymous parent-token enumeration returns 42501. Only
`parent_token_enumerable` and `parent_access_links_anon_enumerable` were submitted
to manage_security_finding; both IDs are already inactive, so no scan entries
were changed. Shared downstream tables remain open until all staff consumers
have verified replacement paths; this pass is not a full database lockdown.

**Deployed and verified live.** `core-bridge`, `resolve-display-names`,
`guest-collect-data`, `pingram-webhook`, `send-parent-snapshot`,
`generate-student-narrative`, `sync-student-names`, `generate-parent-insight`,
`classroom-ai-insights` are deployed; live tests confirm 401 with no token, 401
with a forged bearer, 403 on the webhook without its signature, and 403 on an
invalid guest code (which is also server-scoped to its classroom group).
19 tests pass.

**Session availability (checked 2026-11-10).** Cloud has no auth users to mint a
session for, and the external Nova Core host does not resolve from this sandbox
(DNS failure), so no signed-in staff session can be obtained or tested here.
Classroom table lockdowns (abc_logs, thread_messages, iep_documents,
mayday_contacts, invite_codes, guest tables, admin_audit_log, classroom_groups,
student_parent_links, reinforcement_ai_recommendations) stay open: each
classroom screen still reads those tables directly from the browser, and
rerouting them behind verified agency-scoped server checks cannot be tested
without a real staff sign-in. Per instruction, these findings remain open until
classroom access is verified end-to-end with a Core session.

## Blocker: Nova Core backend deleted (diagnosed 2026-11-10)
- `yboqqmkghwhlhhnsegje.supabase.co` returns NXDOMAIN from public DNS (Cloudflare + Google DoH, Status 3) — the external Core project no longer exists. Control: Cloud backend resolves fine. Not a sandbox restriction; no app-side fix can restore it.
- All connected apps (this project, Nova Student Connect, NovaTrack Behavior Pro) point at the same dead ref.
- To restore staff sign-in, the user must supply a valid Core backend:
  - frontend env: `VITE_CORE_SUPABASE_URL` + `VITE_CORE_SUPABASE_ANON_KEY` (.env)
  - edge function secrets: `VITE_CORE_SUPABASE_URL`, `VITE_CORE_SUPABASE_ANON_KEY`, `CORE_SERVICE_ROLE_KEY`
- If the Core project was only paused in Supabase, restoring it there revives the same ref and no config change is needed. If deleted, a new project's URL/keys must replace all five settings above, and Core-side RLS hardening findings stay open until then.
- Selected security findings depending on Core access remain OPEN/unverified.
