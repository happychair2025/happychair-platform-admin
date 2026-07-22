# Trusted Server Action Adapter

Happy Chair Platform Admin can prepare and review admin action requests in the browser, but production mutations must be executed only by a trusted server runtime.

## Boundary

- Browser code may create review records, dry-run previews, idempotency keys, and payload summaries.
- Browser code must not hold service-role secrets, bypass RLS, or write production customer state directly.
- Server code must verify the internal admin session, permission, tenant scope, approval state, idempotency key, rollback metadata, and audit chain before any mutation.
- Server code must write immutable audit records before and after meaningful state changes.
- Server code must return visible activity evidence that Platform Admin can later read through read-only views.

## Environment

Use these browser-safe values only:

```bash
VITE_PLATFORM_ACTIONS_SERVER_ENDPOINT=
VITE_PLATFORM_LEDGER_SERVER_ENDPOINT=
```

`VITE_PLATFORM_ACTIONS_SERVER_ENDPOINT` is the future trusted executor endpoint for reviewed admin action requests.

`VITE_PLATFORM_LEDGER_SERVER_ENDPOINT` is the future trusted persistence endpoint for browser-created ledgers. If unset, ledgers remain local review records.

Neither value may expose a Supabase service-role key or provider secret to the browser.

## Contract Source

The frontend contract lives in:

- `src/lib/admin-actions/trustedServerAdapter.ts`
- `src/lib/admin-actions/serverAdapterReadiness.ts`
- `src/lib/admin-actions/actionExecutionContract.ts`

The Server Adapter Readiness screen shows each registered handler's request envelope, required headers, preflight gates, response states, rejection codes, audit keys, and rollback strategy.

## Implementation Order

1. Keep the browser in review-only mode until the server endpoint exists.
2. Implement a trusted server endpoint or Supabase Edge Function with server-side secrets only.
3. Accept the typed action request envelope, `Authorization`, `Idempotency-Key`, and `X-HC-Correlation-Id`.
4. Run all preflight gates before mutation.
5. Write a started audit event.
6. Execute only the allowlisted handler for the request's `handlerKey`.
7. Write completion or blocked audit evidence.
8. Persist visible activity records and expose them through read-only Platform Admin views.
9. Return a response state from the contract: accepted, dry-run passed, dry-run blocked, completed, blocked, or rejected.

## Do Not Do

- Do not weaken customer-facing RLS to make Platform Admin easier to build.
- Do not call the Venue Admin app from Platform Admin.
- Do not execute billing, module, support, permission, impersonation, or agent mutations directly from the browser.
- Do not silently execute agent-recommended actions without human approval unless an explicit allowlist exists.
