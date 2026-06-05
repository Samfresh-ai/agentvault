import type { Agent } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { t3 } from "@/lib/t3-sdk";

const DEMO_AGENTS = [
  { name: "OrchestratorAgent", role: "ORCHESTRATOR" as const },
  { name: "BudgetAgent", role: "SUB_AGENT" as const },
  { name: "VendorAgent", role: "SUB_AGENT" as const },
];

export async function ensureDemoSeed() {
  const agents: Record<string, Agent> = {};

  for (const demoAgent of DEMO_AGENTS) {
    const existing = await prisma.agent.findUnique({ where: { name: demoAgent.name } });
    if (existing) {
      agents[demoAgent.name] = existing;
      continue;
    }

    const identity = await t3.createAgent(demoAgent);
    agents[demoAgent.name] = await prisma.agent.create({
      data: {
        name: demoAgent.name,
        role: demoAgent.role,
        t3DID: identity.did,
        credential: JSON.stringify(identity.credential),
      },
    });
  }

  const orchestrator = agents.OrchestratorAgent;
  const budget = agents.BudgetAgent;
  const vendor = agents.VendorAgent;

  await ensureDelegation(orchestrator, budget, ["CHECK_BUDGET", "VERIFY_FUNDS"], 999999999, ["finance-system"]);
  await ensureDelegation(
    orchestrator,
    vendor,
    ["GENERATE_PO", "CONTACT_APPROVED_VENDORS"],
    50000,
    ["approved-vendor-network"],
  );

  return {
    orchestrator,
    budget,
    vendor,
  };
}

async function ensureDelegation(
  orchestrator: Agent,
  subAgent: Agent,
  allowedActions: string[],
  maxValue: number,
  resources: string[],
) {
  const existing = await prisma.delegation.findFirst({
    where: {
      delegatorId: orchestrator.id,
      delegateId: subAgent.id,
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    return existing;
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const credential = await t3.issueCredential({
    fromDID: orchestrator.t3DID,
    toDID: subAgent.t3DID,
    scope: {
      allowedActions,
      maxValue,
      resources,
      expiresAt: expiresAt.toISOString(),
    },
  });

  return prisma.delegation.create({
    data: {
      delegatorId: orchestrator.id,
      delegateId: subAgent.id,
      allowedActions: JSON.stringify(allowedActions),
      maxValue,
      resources: JSON.stringify(resources),
      expiresAt,
      credential: JSON.stringify(credential),
    },
  });
}

export async function restoreDemoDelegations() {
  const { orchestrator, budget, vendor } = await ensureDemoSeed();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.delegation.updateMany({
    where: {
      delegatorId: orchestrator.id,
      delegateId: { in: [budget.id, vendor.id] },
    },
    data: {
      status: "ACTIVE",
      revokedAt: null,
      revokedReason: null,
      expiresAt,
    },
  });
}
