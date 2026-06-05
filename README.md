# AgentVault

AgentVault is a Terminal 3 ADK hackathon demo for hierarchical agent authorization. It gives an orchestrator agent a T3 identity, delegates scoped credentials to sub-agents, checks every action against those credentials, and writes signed audit proof for success, over-cap rejection, and revocation.

The core problem is least-privilege agent access. Enterprises should not hand one broad credential to an AI agent system and hope every sub-agent behaves. AgentVault shows a CFO splitting procurement authority across BudgetAgent and VendorAgent with different scopes, caps, expiry, and revocation.

## Terminal 3 usage

The app uses the public Terminal 3 claim flow to obtain a T3N testnet API key and stores it as `T3N_API_KEY`. The current public SDK/docs expose low-level `T3nClient` handshake/authentication usage, while the bounty scenario needs higher-level `agent.create`, `credential.issue`, and `credential.revoke` primitives. Those missing methods are represented in `src/lib/t3-sdk.ts` as `MockT3SDK`, with `// MOCK - replace...` comments at each method.

The mock is not pretending to be production Terminal 3. It mirrors the expected interface, emits W3C-style credentials, creates scoped delegation credentials, and signs audit records with SHA-256 so the demo can prove the authorization model while the SDK gaps are documented in `bugs.md`.

## Local setup

```bash
npm install
npm run prisma:generate
npm run prisma:push
npm run dev
```

Open `http://localhost:3000`.

Required env:

```bash
DATABASE_URL="file:./dev.db"
T3N_API_KEY="..."
T3_NETWORK="testnet"
NEXT_PUBLIC_APP_NAME="AgentVault"
NEXT_PUBLIC_T3_NETWORK="Terminal 3 Testnet"
# Use one live model provider. Anthropic is preferred when both are set.
ANTHROPIC_API_KEY=""
ANTHROPIC_MODEL="claude-sonnet-4-5"
GEMINI_API_KEY=""
# GOOGLE_API_KEY also works for Gemini if GEMINI_API_KEY is not set.
GEMINI_MODEL="gemini-2.5-flash"
```

`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, or `GOOGLE_API_KEY` is required for the demo. AgentVault intentionally fails the reasoning step when no live model key is configured; it does not fall back to canned agent prose.

Google OAuth was used for the external Terminal 3 claim flow. AgentVault itself does not add an in-app login layer because the bounty MVP explicitly keeps user authentication out of scope.

## Demo walkthrough

1. Open `/demo`.
2. Run Step 1: OrchestratorAgent analyzes `Procure 50 laptops, max $50,000`.
3. Run Step 2: Orchestrator issues signed scoped credentials to BudgetAgent and VendorAgent.
4. Run Step 3: BudgetAgent verifies budget availability inside scope.
5. Run Step 4: VendorAgent attempts a `$60,000` PO and is rejected with `VALUE_EXCEEDS_SCOPE`.
6. Run Step 5: CFO revokes VendorAgent credential.
7. Run Step 6: VendorAgent attempts another action and is rejected with `CREDENTIAL_REVOKED`.
8. Open `/audit` to inspect signed events and filters.

## Architecture

```text
CFO
 |
 v
OrchestratorAgent -- T3 identity / root credential
 | \
 |  \-- delegation: GENERATE_PO, CONTACT_APPROVED_VENDORS, max $50,000
 |      v
 |   VendorAgent -> scope check -> mock PO or signed rejection
 |
 \-- delegation: CHECK_BUDGET, VERIFY_FUNDS, read-only
     v
  BudgetAgent -> scope check -> budget decision

Every action -> verifyScope -> auditSignature -> AuditLog
```

## Known limitations

- The public SDK/docs did not expose the exact high-level Agent Auth methods assumed by the bounty brief, so delegated credential issuance/revocation is mocked behind a replaceable adapter.
- Live model reasoning requires `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, or `GOOGLE_API_KEY`. Missing or invalid model credentials block Step 1 instead of silently producing deterministic output.
- Demo reset clears audit records through `/api/demo/reset` for repeatable hackathon demos. No `/api/audit` update or delete route exists.
- SQLite is local-only and intended for the submission demo, not shared enterprise deployment.
