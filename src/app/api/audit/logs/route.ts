import { toAuditView } from "@/lib/demo";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { ensureDemoSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await ensureDemoSeed();
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId") || undefined;
    const outcome = searchParams.get("outcome") || undefined;
    const limit = Math.min(Number(searchParams.get("limit") ?? 50), 100);
    const offset = Number(searchParams.get("offset") ?? 0);

    const where = {
      ...(agentId ? { agentId } : {}),
      ...(outcome ? { outcome: outcome as "SUCCESS" | "REJECTED" | "REVOKED" } : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
        include: { agent: true, delegation: true },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return jsonOk({
      logs: logs.map(toAuditView),
      total,
    });
  } catch (error) {
    console.error("Audit log fetch failed", error);
    return jsonError("Failed to load audit logs", "AUDIT_FETCH_FAILED", 500);
  }
}
