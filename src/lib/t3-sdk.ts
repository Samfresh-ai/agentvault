import crypto from "node:crypto";

export interface T3AgentIdentity {
  did: string;
  credential: Record<string, unknown>;
}

export interface T3DelegationCredential {
  credentialId: string;
  from: string;
  to: string;
  scope: {
    allowedActions: string[];
    maxValue: number;
    resources: string[];
    expiresAt: string;
  };
  signature: string;
  issuedAt: string;
}

export interface T3RevocationProof {
  revoked: boolean;
  revokedAt: string;
  signature: string;
}

function sha256(value: string) {
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
}

export class MockT3SDK {
  // MOCK - replace when Terminal 3 exposes documented agent.create in the SDK.
  async createAgent(params: { name: string; role: string }): Promise<T3AgentIdentity> {
    const did = `did:t3n:${params.role.toLowerCase()}:${Date.now()}:${crypto.randomBytes(6).toString("hex")}`;

    return {
      did,
      credential: {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        type: ["VerifiableCredential", "AgentIdentityCredential"],
        issuer: "did:t3n:terminal3-network",
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          id: did,
          name: params.name,
          role: params.role,
          network: process.env.T3_NETWORK ?? "testnet",
        },
      },
    };
  }

  // MOCK - replace when Terminal 3 exposes documented credential.issue in the SDK.
  async issueCredential(params: {
    fromDID: string;
    toDID: string;
    scope: {
      allowedActions: string[];
      maxValue: number;
      resources: string[];
      expiresAt: string;
    };
  }): Promise<T3DelegationCredential> {
    const credentialId = `cred:t3n:${Date.now()}:${crypto.randomBytes(5).toString("hex")}`;
    const signature = sha256(JSON.stringify(params));

    return {
      credentialId,
      from: params.fromDID,
      to: params.toDID,
      scope: params.scope,
      signature,
      issuedAt: new Date().toISOString(),
    };
  }

  // MOCK - replace when Terminal 3 exposes documented credential.revoke in the SDK.
  async revokeCredential(params: { credentialId: string; reason: string }): Promise<T3RevocationProof> {
    const revokedAt = new Date().toISOString();

    return {
      revoked: true,
      revokedAt,
      signature: sha256(`${params.credentialId}:${params.reason}:${revokedAt}`),
    };
  }

  // MOCK - replace when Terminal 3 exposes documented credential verification for delegated agent credentials.
  async verifyCredential(credentialId: string): Promise<{ valid: boolean; reason?: string }> {
    void credentialId;
    return { valid: true };
  }

  signData(data: string) {
    return sha256(data);
  }
}

export async function probeTerminal3Usage() {
  if (!process.env.T3N_API_KEY) {
    return { mode: "mock", reason: "T3N_API_KEY is not configured" };
  }

  return {
    mode: "mock",
    reason:
      "The published @terminal3/t3n-sdk package is installed, but importing it into a Next.js build currently pulls a Node worker module that breaks production bundling. See bugs.md.",
  };
}

export const t3 = new MockT3SDK();
