# Terminal 3 SDK / Onboarding Friction Log

Submission: Prize 2 — Most Detailed Developer Bug Report

Project: AgentVault | Repo: github.com/Samfresh-ai/agentvault

Bug report file: https://github.com/Samfresh-ai/agentvault/blob/main/bugs.md

## Executive Summary

15 friction points documented across SDK behaviour, documentation gaps, onboarding confusion, API surface issues, and a critical production bundling failure.

| Severity | Count |
|---|---:|
| Critical | 2 |
| Major | 9 |
| Minor | 4 |

Core finding: `@terminal3/t3n-sdk` exists on npm and contains real, well-structured lower-level primitives. AgentVault originally built against `3.4.3`; it was rechecked and upgraded to `3.5.0` on 2026-06-05 after Terminal 3 refreshed the docs/package. The refreshed docs now document dashboard-level AI agent delegation with Agent DID, authorized TEE contract, allowed functions, allowed hosts, and removal. However, the high-level programmatic Agent Auth interface described in the bounty brief — `agent.create`, `credential.issue`, `credential.revoke`, `credential.verify` — is still not publicly documented or exported as a direct app API. A developer following the bounty brief cannot complete the primary deliverable without mocking these four methods.

What we built in response: A typed adapter in `src/lib/t3-sdk.ts` that defines the exact interface these methods should implement, with W3C Verifiable Credential output and SHA-256 signed audit records. Every mock method is marked `// MOCK — replace when Terminal 3 ships this method` with the expected signature preserved. It is a drop-in replacement target requiring changes to one file when the real API ships.

## Bug #1 — 2026-06-04 16:45 Africa/Lagos

Category: Documentation Gap

Where encountered: Public claim page / GitHub link in the bounty brief

What I expected: The bounty brief pointed to `https://github.com/terminal3io` as the SDK source. I expected the SDK, examples, and documentation to live under that org.

What actually happened: The claim page links to `https://github.com/Terminal-3`, not `terminal3io`. The correct org path is not surfaced in the bounty brief and the `terminal3io` path leads nowhere relevant.

How I worked around it: Followed the official claim-page GitHub link directly and used npm package metadata to find `@terminal3/t3n-sdk`.

Severity: Minor

## Bug #2 — 2026-06-04 16:52 Africa/Lagos

Category: Documentation Gap — Critical Onboarding Blocker

Where encountered: `https://docs.terminal3.io/t3n/developer-guide/developer-overview`

What I expected: The developer overview to show Agent Auth delegation examples covering agent identity creation, scoped credential issuance, revocation, and scope verification — the four operations the bounty challenge explicitly requires.

What actually happened: The developer overview page states that SDK access is available but instructs developers to contact `enterprise@terminal3.io` to obtain it. For a public bounty challenge with a 3-day build window, routing SDK access through an enterprise sales contact is a critical blocker. The refreshed Data Owner guide now shows how a user can delegate to an AI agent through the dashboard by entering an Agent DID, selecting an authorized TEE contract, optional functions, and allowed hosts, then later removing access. That is useful product documentation, but it is not a programmatic SDK path for `agent.create`, `credential.issue`, `credential.verify`, or `credential.revoke`.

How I worked around it: Proceeded via the npm package (`@terminal3/t3n-sdk`, upgraded to `3.5.0`) and claim-page flow rather than waiting for enterprise contact. The agent identity and delegation methods were not available via this path either, but the package was installable. Wrapped the missing surface in a documented mock adapter.

Severity: Critical — a developer following only the official documentation cannot complete the primary bounty deliverable without hitting this gate.

## Bug #3 — 2026-06-04 16:56 Africa/Lagos

Category: SDK Behaviour

Where encountered: `@terminal3/t3n-sdk` package exports, rechecked on `3.5.0`

What I expected: After installing the SDK, I inspected the exported surface looking for the `agent` namespace described in the bounty brief (`t3.agent.create`).

What actually happened: The package exports `T3nClient`, WASM and session helpers, auth helpers, tenant clients, contract invocation helpers, and delegation primitives. Version `3.5.0` adds/keeps useful primitives including `DelegationCustodialClient`, `TenantClient`, `buildDelegationCredential`, `buildPayrollInvocation`, `revokeDelegation`, `signAgentInvocation`, and `validateCredentialBody`. There is still no `agent` namespace and no `agent.create` method. The top-level structure does not match the high-level interface the bounty brief implies exists.

How I worked around it: Implemented `MockT3SDK.createAgent` in `src/lib/t3-sdk.ts` as a typed, replaceable adapter boundary with W3C Verifiable Credential output and a `did:t3n` DID format.

Severity: Major

## Bug #4 — 2026-06-04 16:58 Africa/Lagos

Category: SDK Behaviour

Where encountered: `@terminal3/t3n-sdk` — searching for credential issuance, rechecked on `3.5.0`

What I expected: The SDK to expose a `credential.issue` method (or equivalent) that accepts a delegator DID, a delegate DID, and a scope object, and returns a signed delegation credential.

What actually happened: The closest exported primitive is `buildDelegationCredential`, which appears oriented toward payroll and function-scoped delegation. Its parameter shape does not map to the multi-field scope the bounty scenario requires (`allowedActions`, `maxValue`, `resources`, `expiresAt`), and it has no documentation showing how to adapt it to agent procurement or enterprise workflow delegation.

How I worked around it: Implemented `MockT3SDK.issueCredential` with explicit scope fields and a signed payload. Kept the `buildDelegationCredential` export available in the installed package as a reference for when the mapping is documented.

Severity: Major

## Bug #5 — 2026-06-04 17:00 Africa/Lagos

Category: SDK Behaviour

Where encountered: `@terminal3/t3n-sdk` — attempting credential revocation, rechecked on `3.5.0`

What I expected: A `credential.revoke` method that accepts a credential ID and revocation reason, and returns a signed revocation proof usable in audit logs.

What actually happened: The package does export `revokeDelegation`, which is the closest match. However, there is no documentation showing how to map it to agent credential IDs generated during the Agent Auth flow, how to supply a plain-text reason, or what the return value looks like. Without a working example, calling it on credentials generated by the mock adapter would be guesswork against an undocumented contract.

How I worked around it: Implemented `MockT3SDK.revokeCredential` to persist `revokedAt`, `revokedReason`, and a hash-signed revocation record. The `revokeDelegation` export is preserved in the installed package and remains the expected replacement target.

Severity: Major

## Bug #6 — 2026-06-04 17:02 Africa/Lagos

Category: SDK Behaviour

Where encountered: `@terminal3/t3n-sdk` — pre-execution scope verification, rechecked on `3.5.0`

What I expected: A `credential.verify` method (or equivalent) that accepts a credential, a requested action string, and an optional value, then returns a boolean or structured result indicating whether the agent is authorised to proceed.

What actually happened: The package exports `validateCredentialBody`, which validates the structural shape of a credential object. It does not answer the runtime question "can agent X perform action Y for value Z under credential C?" — that semantic check has no corresponding exported method.

How I worked around it: Implemented application-level scope verification in `src/lib/scope-check.ts` with four explicit checks (status, expiry, allowed actions, value cap), throwing a typed `ScopeViolationError` on any failure. Every rejection is written to the signed audit log before the request returns.

Severity: Major

## Bug #7 — 2026-06-04 17:03 Africa/Lagos

Category: Onboarding Confusion

Where encountered: Claim page on first load

What I expected: The claim form or sign-in button to be immediately visible and accessible on the page without any prerequisite steps.

What actually happened: The claim controls did not render until the cookie consent prompt was accepted. Before that, the form area displayed a loading image and the claim form was absent from the accessibility tree entirely. There is no indication on the page that consent acceptance is required to render the form.

How I worked around it: Accepted the cookie consent prompt, after which the Google OAuth button and claim form appeared normally.

Severity: Minor

## Bug #8 — 2026-06-04 17:09 Africa/Lagos

Category: Onboarding Confusion

Where encountered: Claim page post-authentication, API key reveal step

What I expected: A clear developer-oriented copy instruction for the API key that makes safe local storage straightforward in an automated or headless environment.

What actually happened: The key is shown once, masked by default, and requires manual reveal or copy. This is correct security behaviour for end users, but there is no guidance for developers on how to capture the key safely into a `.env` file without exposing it in a terminal session, logs, or screen capture.

How I worked around it: Used Chrome DevTools Protocol to capture the key value directly into `.env.local` without printing it in any visible output stream.

Severity: Minor

## Bug #9 — 2026-06-04 17:16 Africa/Lagos

Category: Documentation Gap — Identity Model Inconsistency

Where encountered: Terminal 3 REST API docs (`POST /v1/did/register`) vs. claim page and bounty brief language

What I expected: A consistent DID method across the platform. The bounty brief, claim page, and SDK packaging all use `did:t3n` as the agent identity format.

What actually happened: The REST API documentation for DID registration specifies that only `did:key` is currently supported. This creates a direct inconsistency: the platform's developer-facing materials promise `did:t3n` identities, but the only documented registration endpoint accepts a different DID method. A developer trying to register an agent DID through the documented REST surface would produce a credential in the wrong format relative to what the rest of the platform expects.

How I worked around it: Stored mock `did:t3n:*` identities in the demo adapter while flagging the inconsistency here. The adapter is the replacement target once the platform aligns its DID method documentation.

Severity: Major

## Bug #10 — 2026-06-04 17:24 Africa/Lagos

Category: Documentation Gap

Where encountered: Public docs index and GitHub org scan

What I expected: At least one reference implementation showing the complete Agent Auth flow end-to-end: agent registration, credential delegation, scoped action execution, and revocation.

What actually happened: The claim page references procurement and agent use cases in its marketing copy, and the GitHub org contains real SDK code, but no public reference app demonstrates the four-step Agent Auth lifecycle the bounty challenge requires. A developer starting this challenge has no working code to orient against.

How I worked around it: Built the procurement scenario from scratch using the adapter boundaries as the design surface, and made the full implementation public at github.com/Samfresh-ai/agentvault so it can serve as the reference implementation this gap describes.

Severity: Major

## Bug #11 — 2026-06-04 17:32 Africa/Lagos

Category: API Error — Error Message Quality

Where encountered: SDK contract invocation error paths, reviewed while reading `T3nClient` types and source

What I expected: When a developer calls an SDK contract method with the wrong function name, credential shape, or parameter set, the error returned should clearly identify which part of the call failed and what the expected shape is.

What actually happened: The SDK exposes generic contract execution surfaces where the caller must supply script and function names without type safety at the call site. An incorrect invocation fails at the network/transport layer or contract runtime with a generic error rather than an API-layer message identifying the specific mismatch. The developer cannot distinguish "wrong function name" from "wrong payload shape" from "wrong credential format" from the error alone.

How I worked around it: Avoided calling undocumented contract surfaces and kept the T3 boundary isolated in the adapter. All scope and credential errors in AgentVault throw typed application-level errors with explicit reason codes before any SDK call is made.

Severity: Major

## Bug #12 — 2026-06-04 17:36 Africa/Lagos

Category: Documentation Gap

Where encountered: Local environment setup — mapping claim token to env variables

What I expected: The onboarding documentation to specify exactly which environment variable name the SDK expects for the API key obtained through the claim flow.

What actually happened: The claim flow provides a key, but the public documentation does not specify a canonical variable name for it. There is no clear guidance on whether to use `T3N_API_KEY`, `T3_API_KEY`, `TERMINAL3_API_KEY`, or another name, nor on how it should be distinguished from network identifiers or public app-level variables.

How I worked around it: Used `T3N_API_KEY` (matching the SDK package prefix), `T3_NETWORK`, and `NEXT_PUBLIC_T3_NETWORK` in `.env.local`, and documented all three in the README with their expected values.

Severity: Minor

## Bug #13 — 2026-06-04 17:39 Africa/Lagos

Category: Documentation Gap — TypeScript Interface Gaps

Where encountered: `node_modules/@terminal3/t3n-sdk/dist/index.d.ts`, rechecked on `3.5.0`

What I expected: Dedicated TypeScript interfaces for the four Agent Auth data types the bounty scenario requires: agent identity credential, delegation credential, revocation proof, and scope verification result.

What actually happened: The SDK type definitions cover session, auth, tenant, org-data, payroll, and lower-level delegation primitives in detail. No product-level Agent Auth interfaces exist for the types a developer needs to work with in the bounty scenario. A developer writing TypeScript against these types must either use `any` or define their own interfaces from scratch.

How I worked around it: Defined local interfaces `T3AgentIdentity`, `T3DelegationCredential`, and `T3RevocationProof` in `src/lib/t3-sdk.ts`. These are candidates for direct inclusion in the SDK type definitions when the Agent Auth surface is published.

Severity: Major

## Bug #14 — 2026-06-05 01:18 Africa/Lagos

Category: Bundling Issue — Production Build Failure

Where encountered: Next.js 14.2.35 production build after installing `@terminal3/t3n-sdk` (`3.4.3`, rechecked after upgrading to `3.5.0`)

What I expected: A server-side SDK import to compile cleanly in a standard Next.js App Router production build with no additional configuration.

What actually happened: `next build` failed. The SDK's dependency graph includes worker and WASM-related code paths that Next.js attempts to include in the client bundle during production compilation. This causes the build to break on those code paths. The error is not immediately traceable to the SDK without inspecting the webpack module graph, making it a silent and confusing failure for developers who install the package and run a production build.

How I worked around it: Added the following to `next.config.mjs`:

```js
experimental: {
  serverComponentsExternalPackages: ["@terminal3/t3n-sdk"],
}
```

This instructs Next.js 14 to treat the package as a server external, keeping it out of the client bundle. Without this configuration, any Next.js 14 project using the SDK will silently fail in production.

Severity: Critical — affects every Next.js 14 developer using this package without a documented workaround.

## Bug #15 — 2026-06-05 01:21 Africa/Lagos

Category: Product Positioning Gap

Where encountered: The gap between the bounty brief, the claim page, and the actual SDK export surface, taken as a whole

What I expected: The "Terminal 3 Agent Auth SDK" named in the bounty brief to map to a documented, stable, public API surface in `@terminal3/t3n-sdk` — one that a developer can discover, install, and use to complete the four core operations the challenge requires within a 3-day window.

What actually happened: `@terminal3/t3n-sdk` is a real, well-structured package with meaningful lower-level primitives (`T3nClient`, session management, auth helpers, `buildDelegationCredential`, `signAgentInvocation`, `revokeDelegation`, tenant/client helpers). The refreshed docs also make the product model clearer by documenting dashboard-level AI agent delegation. But the four Agent Auth methods the bounty brief implies exist (`agent.create`, `credential.issue`, `credential.revoke`, `credential.verify`) are not exported, not documented as a direct app API, and not accessible without an enterprise sales contact. The gap is not technical inability — the underlying infrastructure clearly supports these operations. The gap is that the high-level developer surface for them has not been published yet.

The bounty challenge is, in effect, asking developers to build against an interface that does not yet exist publicly. That is either intentional (to see how developers design the interface themselves) or it is an oversight.

Either way: the most useful response is a clean adapter that defines what that interface should look like. That is what `src/lib/t3-sdk.ts` in AgentVault is.

How I worked around it: Delivered a typed, replaceable adapter at one file boundary with the exact method signatures the SDK should expose. It is production-ready as a mock and swap-ready the moment Terminal 3 publishes the real surface.

Severity: Major — the primary deliverable of the bounty challenge cannot be completed using only publicly documented SDK methods.
