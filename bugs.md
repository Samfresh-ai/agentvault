# Terminal 3 SDK / Onboarding Friction Log

Bug #1 — 2026-06-04 16:45 Africa/Lagos
Category: Documentation Gap
Where encountered: Public claim page / GitHub link
What I expected: The bounty brief pointed to `https://github.com/terminal3io`, so I expected that org to contain the SDK and examples.
What actually happened: The claim page links to `https://github.com/Terminal-3`; the `terminal3io` org path is not the visible SDK source path.
How I worked around it: Followed the official claim-page GitHub link and used npm metadata for `@terminal3/t3n-sdk`.
Severity: Minor

Bug #2 — 2026-06-04 16:52 Africa/Lagos
Category: Documentation Gap
Where encountered: `https://docs.terminal3.io/t3n/developer-guide/developer-overview`
What I expected: Agent Auth SDK docs with examples for agent identity, scoped delegation, revocation, and verification.
What actually happened: The developer overview says SDK access exists but also says to contact `enterprise@terminal3.io` for T3N SDK access. It does not show the Agent Auth delegation API.
How I worked around it: Used the claim-page code snippet plus npm package metadata, then wrapped missing high-level methods in a clearly marked mock adapter.
Severity: Major

Bug #3 — 2026-06-04 16:56 Africa/Lagos
Category: SDK Behavior
Where encountered: `@terminal3/t3n-sdk@3.4.3` package exports
What I expected: A high-level `t3.agent.create` method matching the Agent Auth challenge brief.
What actually happened: Runtime export inspection showed no `agent` namespace and no `agent.create` method. The SDK exports `T3nClient`, WASM/session helpers, auth helpers, tenant clients, and delegation primitives instead.
How I worked around it: Implemented `MockT3SDK.createAgent` in `src/lib/t3-sdk.ts` so AgentVault has one replaceable adapter boundary.
Severity: Major

Bug #4 — 2026-06-04 16:58 Africa/Lagos
Category: SDK Behavior
Where encountered: `@terminal3/t3n-sdk@3.4.3` package exports
What I expected: A high-level `t3.credential.issue` method for issuing scoped sub-agent credentials.
What actually happened: Runtime export inspection showed no `credential` namespace and no `credential.issue` method. The closest available primitive is `buildDelegationCredential`, which is payroll/function oriented and not documented for agent procurement scope.
How I worked around it: Implemented `MockT3SDK.issueCredential` with explicit `allowedActions`, `maxValue`, `resources`, `expiresAt`, and a signed credential payload.
Severity: Major

Bug #5 — 2026-06-04 17:00 Africa/Lagos
Category: SDK Behavior
Where encountered: `@terminal3/t3n-sdk@3.4.3` package exports
What I expected: A high-level `t3.credential.revoke` method that returns a revocation proof for delegated agent credentials.
What actually happened: The package exports `revokeDelegation`, but the challenge/docs do not show how it maps to agent credentials, credential IDs, revocation reason text, or audit proofs.
How I worked around it: Implemented `MockT3SDK.revokeCredential` and persisted `revokedAt`, `revokedReason`, and a hash signature in the demo database.
Severity: Major

Bug #6 — 2026-06-04 17:02 Africa/Lagos
Category: SDK Behavior
Where encountered: `@terminal3/t3n-sdk@3.4.3` package exports
What I expected: A high-level `t3.credential.verify` or similar method for checking action scope before execution.
What actually happened: Runtime export inspection showed no obvious agent credential verification method. The available validation helper, `validateCredentialBody`, validates credential shape, not "can this agent perform this action under this value cap?"
How I worked around it: Added an application-level scope verifier in `src/lib/scope-check.ts` and recorded every rejection in the signed audit log.
Severity: Major

Bug #7 — 2026-06-04 17:03 Africa/Lagos
Category: Onboarding Confusion
Where encountered: Claim page first load
What I expected: A visible token-claim form or sign-in button immediately on the page.
What actually happened: The form area initially rendered as a loading image until the cookie consent was accepted; the claim controls were not visible in the accessibility tree before that.
How I worked around it: Accepted the site consent prompt, then the Google OAuth and claim form rendered.
Severity: Minor

Bug #8 — 2026-06-04 17:09 Africa/Lagos
Category: Onboarding Confusion
Where encountered: Claim page success screen
What I expected: The API key to be easy to copy into a local env without exposing it.
What actually happened: The key is shown once, masked by default, and must be manually revealed or copied. That is secure, but it makes headless/dev automation awkward because a normal page snapshot can leak it.
How I worked around it: Used Chrome DevTools Protocol to capture the key into local `.env.local` without printing it in chat or logs.
Severity: Minor

Bug #9 — 2026-06-04 17:16 Africa/Lagos
Category: Documentation Gap
Where encountered: Terminal 3 API docs for DID registration
What I expected: Agent DID registration examples for the T3N SDK identity flow.
What actually happened: The REST docs show `POST /v1/did/register`, require a `did` and `wallet_address`, and note that only `did:key` is supported for now. That does not map cleanly to the claim-page `did:t3n` messaging or the bounty's agent identity wording.
How I worked around it: Stored mock `did:t3n:*` identities in the demo while keeping the adapter replaceable.
Severity: Major

Bug #10 — 2026-06-04 17:24 Africa/Lagos
Category: Documentation Gap
Where encountered: Public docs index and GitHub org scan
What I expected: A reference procurement, payment, or delegated-agent example using the same SDK methods as the challenge.
What actually happened: The claim page mentions reference agents and procurement use cases, but the public docs did not expose a copy-pasteable Agent Auth app that matches the challenge flow.
How I worked around it: Built the procurement scenario directly and documented every assumed SDK boundary in the adapter and README.
Severity: Major

Bug #11 — 2026-06-04 17:32 Africa/Lagos
Category: API Error
Where encountered: SDK contract invocation error path while reviewing `T3nClient` docs/types
What I expected: Agent-auth examples to show the exact contract names, function names, and payload shape for credential issuance or verification.
What actually happened: The SDK exposes generic contract execution surfaces where the caller must supply script/function names. Without an agent-auth example, an incorrect call can fail at runtime with transport/contract errors instead of a clear "wrong credential API" message.
How I worked around it: Avoided guessing undocumented contract names and kept the demo's T3 boundary isolated in `src/lib/t3-sdk.ts`.
Severity: Major

Bug #12 — 2026-06-04 17:36 Africa/Lagos
Category: Documentation Gap
Where encountered: Local environment setup for Terminal 3 claim token
What I expected: A single documented environment variable name for the hackathon API key.
What actually happened: The claim flow provides a key, but the public examples do not make a clear distinction between `T3N_API_KEY`, network names, and any app-specific public network variable.
How I worked around it: Used `T3N_API_KEY`, `T3_NETWORK`, and `NEXT_PUBLIC_T3_NETWORK` in `.env.local`, and documented those names in the README.
Severity: Minor

Bug #13 — 2026-06-04 17:39 Africa/Lagos
Category: Documentation Gap
Where encountered: Type definitions in `node_modules/@terminal3/t3n-sdk/dist/index.d.ts`
What I expected: Dedicated TypeScript interfaces for agent identity credentials, agent delegation credentials, revocation proof payloads, and scope verification results.
What actually happened: The SDK types include session, auth, tenant, org-data, payroll, and delegation primitives, but no product-level Agent Auth interfaces matching the bounty flow.
How I worked around it: Added local interfaces `T3AgentIdentity`, `T3DelegationCredential`, and `T3RevocationProof` in `src/lib/t3-sdk.ts`.
Severity: Major

Bug #14 — 2026-06-05 01:18 Africa/Lagos
Category: Bundling Issue
Where encountered: Next.js production build after installing `@terminal3/t3n-sdk@3.4.3`
What I expected: A server-side SDK import to stay outside the browser/client bundle and build cleanly.
What actually happened: Next.js attempted to bundle the SDK dependency graph during production compilation, which broke on SDK worker/WASM-related code paths.
How I worked around it: Added `experimental: { serverComponentsExternalPackages: ["@terminal3/t3n-sdk"] }` to `next.config.mjs` so this Next 14.2.35 app treats the package as a server external.
Severity: Critical

Bug #15 — 2026-06-05 01:21 Africa/Lagos
Category: SDK Behavior
Where encountered: `@terminal3/t3n-sdk@3.4.3` README/package surface
What I expected: The README and package exports to agree on a simple Agent Auth quickstart for `agent.create`, `credential.issue`, `credential.verify`, and `credential.revoke`.
What actually happened: The package is real and exposes many lower-level primitives, but the challenge-level Agent Auth API is not documented as a stable high-level surface.
How I worked around it: Kept the installed package for proof, documented the gap here, and made AgentVault's mock adapter intentionally small so it can be replaced by the real high-level API when published.
Severity: Major
