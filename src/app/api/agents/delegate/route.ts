import { writeAuditLog } from "@/lib/audit";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { t3 } from "@/lib/t3-sdk";

export const dynamic = "force-dynamic";

interface DelegateRequest {
  orchestratorId?: string;
  subAgentId?: string;
  scope?: {
    allowedActions?: string[];
    maxValue?: number;
    resources?: string[];
    expiresInMinutes?: number;
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DelegateRequest;
    if (!body.orchestratorId || !body.subAgentId || !body.scope?.allowedActions?.length) {
      return jsonError("orchestratorId, subAgentId, and scope are required", "INVALID_DELEGATION_INPUT", 400);
    }

    const orchestrator = await prisma.agent.findUnique({ where: { id: body.orchestratorId } });
    if (!orchestrator || orchestrator.status !== "ACTIVE") {
      return jsonError("Orchestrator not found or inactive", "ORCHESTRATOR_NOT_ACTIVE", 404);
    }

    if (orchestrator.role !== "ORCHESTRATOR") {
      return jsonError("Only ORCHESTRATOR agents may issue delegations", "NOT_ORCHESTRATOR", 403);
    }

    const subAgent = await prisma.agent.findUnique({ where: { id: body.subAgentId } });
    if (!subAgent) {
      return jsonError("Sub-agent not found", "SUB_AGENT_NOT_FOUND", 404);
    }

    if (subAgent.status !== "ACTIVE") {
      return jsonError("Sub-agent is revoked", "SUB_AGENT_REVOKED", 400);
    }

    const expiresAt = new Date(Date.now() + (body.scope.expiresInMinutes ?? 120) * 60 * 1000);
    const credential = await t3.issueCredential({
      fromDID: orchestrator.t3DID,
      toDID: subAgent.t3DID,
      scope: {
        allowedActions: body.scope.allowedActions,
        maxValue: body.scope.maxValue ?? 0,
        resources: body.scope.resources ?? [],
        expiresAt: expiresAt.toISOString(),
      },
    });

    const delegation = await prisma.delegation.create({
      data: {
        delegatorId: orchestrator.id,
        delegateId: subAgent.id,
        allowedActions: JSON.stringify(body.scope.allowedActions),
        maxValue: body.scope.maxValue ?? 0,
        resources: JSON.stringify(body.scope.resources ?? []),
        expiresAt,
        credential: JSON.stringify(credential),
      },
    });

    await writeAuditLog({
      agent: orchestrator,
      delegation,
      action: "ISSUE_DELEGATION",
      payload: { subAgentId: subAgent.id, scope: body.scope, credential },
      outcome: "SUCCESS",
    });

    return jsonOk(delegation);
  } catch (error) {
    console.error("Delegation failed", error);
    return jsonError("T3 credential issuance failed", "T3_SDK_ERROR", 502);
  }
}
