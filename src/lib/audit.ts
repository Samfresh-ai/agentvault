import type { Agent, AuditOutcome, Delegation } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { t3 } from "@/lib/t3-sdk";

export function auditSignature(agent: Pick<Agent, "credential" | "t3DID">, action: string, payload: unknown) {
  return t3.signData(
    JSON.stringify({
      credentialHash: t3.signData(agent.credential),
      did: agent.t3DID,
      action,
      payload,
    }),
  );
}

export async function writeAuditLog(params: {
  agent: Agent;
  delegation?: Delegation | null;
  action: string;
  payload: unknown;
  outcome: AuditOutcome;
  reason?: string;
}) {
  return prisma.auditLog.create({
    data: {
      agentId: params.agent.id,
      delegationId: params.delegation?.id,
      action: params.action,
      payload: JSON.stringify(params.payload),
      outcome: params.outcome,
      reason: params.reason,
      signature: auditSignature(params.agent, params.action, params.payload),
    },
  });
}
