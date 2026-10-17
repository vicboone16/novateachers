# Architecture rules

- Cloud security migrations live in the migration tool's generated journal; apply all schema changes through that tool to keep deployed schema and history consistent.
- Privileged Cloud invite and inventory routines are service-role-only; frontend invite management uses the separate Core client, so granting browser execution would expose an unused privileged path.
- Public-schema views use security-invoker semantics so queries respect the caller's underlying table permissions.
- Help interaction history is server-only until verified staff identity is available in Cloud; never use anonymous access to substitute for Core authentication.