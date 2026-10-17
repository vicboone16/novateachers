# Architecture rules

- Cloud security migrations live in the migration tool's generated journal; apply all schema changes through that tool to keep deployed schema and history consistent.
- Privileged Cloud invite and inventory routines are service-role-only; frontend invite management uses the separate Core client, so granting browser execution would expose an unused privileged path.
- Public-schema views use security-invoker semantics so queries respect the caller's underlying table permissions.
- Help interaction history is server-only until verified staff identity is available in Cloud; never use anonymous access to substitute for Core authentication.
- Parent link credentials are server-only: portal-access resolves a supplied capability and returns allowlisted student/agency-scoped data; portal-links verifies Core Auth and Core RLS-visible student membership before staff management.
- Portal guest calls omit Authorization; requests with a bearer must verify it and persist its subject as ownership, never treating invalid bearers as guests.
- Keep separate stateless auth and service clients; never sign a user into a service client or grant public access as a fallback for failed identity verification.