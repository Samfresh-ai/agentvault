import { writeAuditLog } from "@/lib/audit";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { t3 } from "@/lib/t3-sdk";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      orchestratorId?: string;
      delegationId?: string;
      reason?: string;
    };

    if (!body.orchestratorId || !body.delegationId) {
      return jsonError("orchestratorId and delegationId are required", "INVALID_REVOCATION_INPUT", 400);
    }

    const delegation = await prisma.delegation.findUnique({
      where: { id: body.delegationId },
      include: { delegator: true },
    });

    if (!delegation) {
      return jsonError("Delegation not found", "DELEGATION_NOT_FOUND", 404);
    }

    if (delegation.delegatorId !== body.orchestratorId) {
      return jsonError("Requester is not the delegation delegator", "DELEGATION_FORBIDDEN", 403);
    }

    if (delegation.status === "REVOKED") {
      return jsonError("Delegation already revoked", "DELEGATION_ALREADY_REVOKED", 409);
    }

    const reason = body.reason ?? "Credential revoked by orchestrator";
    const credential = JSON.parse(delegation.credential) as { credentialId?: string };
    const proof = await t3.revokeCredential({
      credentialId: credential.credentialId ?? delegation.id,
      reason,
    });

    const updated = await prisma.delegation.update({
      where: { id: delegation.id },
      data: {
        status: "REVOKED",
        revokedAt: new Date(proof.revokedAt),
        revokedReason: reason,
      },
    });

    await writeAuditLog({
      agent: delegation.delegator,
      delegation: updated,
      action: "REVOKE_CREDENTIAL",
      payload: { delegationId: delegation.id, reason, proof },
      outcome: "REVOKED",
      reason,
    });

    return jsonOk(updated);
  } catch (error) {
    console.error("Revocation failed", error);
    return jsonError("T3 credential revocation failed", "T3_SDK_ERROR", 502);
  }
}
