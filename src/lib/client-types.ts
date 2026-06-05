export interface AgentView {
  id: string;
  name: string;
  role: "ORCHESTRATOR" | "SUB_AGENT";
  t3DID: string;
  credential: string;
  status: "ACTIVE" | "REVOKED";
  createdAt: string;
}

export interface DelegationView {
  id: string;
  delegatorId: string;
  delegateId: string;
  delegateName?: string;
  delegatorName?: string;
  allowedActions: string[];
  maxValue: number;
  resources: string[];
  expiresAt: string;
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
  revokedAt?: string | null;
  revokedReason?: string | null;
  credential: Record<string, unknown>;
}

export interface AuditLogView {
  id: string;
  agentId: string;
  agentName: string;
  action: string;
  outcome: "SUCCESS" | "REJECTED" | "REVOKED";
  reason?: string | null;
  signature: string;
  createdAt: string;
  payload: string;
  delegationId?: string | null;
}

export interface DemoState {
  agents: AgentView[];
  delegations: DelegationView[];
  stats: {
    activeAgents: number;
    activeDelegations: number;
    totalAuditEvents: number;
  };
  recentLogs: AuditLogView[];
}

export interface DemoStepResult {
  step: number;
  title: string;
  outcome: "SUCCESS" | "REJECTED" | "REVOKED";
  reason?: string;
  detail?: string;
  delegationId?: string;
  reasoning?: {
    reasoning: string;
    decision: string;
    data: Record<string, unknown>;
    model: string;
  };
  delegations?: DelegationView[];
  revocation?: Record<string, unknown>;
  attemptedValue?: number | null;
  scope?: {
    credentialId: string;
    allowedActions: string[];
    maxValue: number;
    expiresAt: string;
    status: "ACTIVE" | "REVOKED" | "EXPIRED";
    revokedAt?: string | null;
    revokedReason?: string | null;
  } | null;
}
