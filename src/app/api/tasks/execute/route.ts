import { writeAuditLog } from "@/lib/audit";
import { AIInferenceError, runAgentWithGemini } from "@/lib/agent-runner";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { ScopeViolationError, verifyScope } from "@/lib/scope-check";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      agentId?: string;
      action?: string;
      payload?: Record<string, unknown>;
    };

    if (!body.agentId || !body.action || !body.payload) {
      return jsonError("agentId, action, and payload are required", "INVALID_TASK_INPUT", 400);
    }

    const agent = await prisma.agent.findUnique({ where: { id: body.agentId } });
    if (!agent) {
      return jsonError("Agent not found", "AGENT_NOT_FOUND", 404);
    }

    if (agent.status === "REVOKED") {
      return jsonError("Agent credential has been revoked", "AGENT_REVOKED", 403);
    }

    if (agent.role === "ORCHESTRATOR") {
      const result = await runAgentWithGemini("ORCHESTRATOR", body.action, body.payload);
      await writeAuditLog({ agent, action: body.action, payload: body.payload, outcome: "SUCCESS" });
      return jsonOk({ outcome: "SUCCESS", result });
    }

    const delegation = await prisma.delegation.findFirst({
      where: { delegateId: agent.id },
      orderBy: { createdAt: "desc" },
    });

    if (!delegation) {
      const message = "No active delegation. Agent must be credentialed before acting.";
      await writeAuditLog({
        agent,
        action: body.action,
        payload: body.payload,
        outcome: "REJECTED",
        reason: "NO_ACTIVE_DELEGATION",
      });
      return jsonError(message, "NO_ACTIVE_DELEGATION", 403);
    }

    try {
      verifyScope(delegation, body.action, Number(body.payload.totalValue ?? 0));
    } catch (error) {
      if (!(error instanceof ScopeViolationError)) {
        throw error;
      }

      await writeAuditLog({
        agent,
        delegation,
        action: body.action,
        payload: body.payload,
        outcome: "REJECTED",
        reason: error.violationType,
      });

      return Response.json(
        {
          outcome: "REJECTED",
          reason: error.violationType,
          detail: error.detail,
          agentId: agent.id,
          delegationId: delegation.id,
          timestamp: new Date().toISOString(),
        },
        { status: 403 },
      );
    }

    const role = agent.name === "BudgetAgent" ? "BUDGET_AGENT" : "VENDOR_AGENT";
    const result = await runAgentWithGemini(role, body.action, body.payload);
    await writeAuditLog({
      agent,
      delegation,
      action: body.action,
      payload: body.payload,
      outcome: "SUCCESS",
    });

    const task = await prisma.task.create({
      data: {
        agentId: agent.id,
        description: body.action,
        status: "COMPLETED",
        result: JSON.stringify(result),
      },
    });

    return jsonOk({ outcome: "SUCCESS", task, result });
  } catch (error) {
    console.error("Task execution failed", error);

    if (error instanceof AIInferenceError) {
      return jsonError(`AI inference failed: ${error.message}`, "AI_INFERENCE_FAILED", 500);
    }

    return jsonError("Task execution failed", "TASK_EXECUTION_FAILED", 500);
  }
}
