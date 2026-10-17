# Roadmap

## Security — database access rules (blocked)

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

**Blocker 2 — identity architecture.** Staff sign in against the external Nova
Core project, so this database sees the app as the `anon` role and `auth.uid()`
is null. Agency-scoped policies keyed on `auth.uid()` would lock the whole app
out. Needs a decision: full lockdown (requires bridging Core sessions into this
database first), targeted lockdown of identity-independent tables (portal
tokens, invite codes, emergency contacts, IEP documents, audit/help logs), or
defer.

**Pending deploy (outside the currently selected database-only findings).**
Earlier edge-function security changes are saved but deployment has not been
verified: `core-bridge`,
`resolve-display-names`, `guest-collect-data`, `pingram-webhook`,
`send-parent-snapshot`, `generate-student-narrative`, `sync-student-names`,
`generate-parent-insight`, `classroom-ai-insights`.
