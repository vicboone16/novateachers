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

**Pending deploy (outside the currently selected database-only findings).**
Earlier edge-function security changes are saved but deployment has not been
verified: `core-bridge`,
`resolve-display-names`, `guest-collect-data`, `pingram-webhook`,
`send-parent-snapshot`, `generate-student-narrative`, `sync-student-names`,
`generate-parent-insight`, `classroom-ai-insights`.
