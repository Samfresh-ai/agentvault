import { Prisma } from "@prisma/client";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { t3 } from "@/lib/t3-sdk";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: string; role?: "ORCHESTRATOR" | "SUB_AGENT" };
    if (!body.name || !body.role || !["ORCHESTRATOR", "SUB_AGENT"].includes(body.role)) {
      return jsonError("Agent name and valid role are required", "INVALID_AGENT_INPUT", 400);
    }

    const identity = await t3.createAgent({ name: body.name, role: body.role });
    const agent = await prisma.agent.create({
      data: {
        name: body.name,
        role: body.role,
        t3DID: identity.did,
        credential: JSON.stringify(identity.credential),
      },
    });

    return jsonOk(agent);
  } catch (error) {
    console.error("Agent registration failed", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError("Agent name already exists", "AGENT_DUPLICATE", 409);
    }

    return jsonError("T3 identity issuance failed", "T3_SDK_ERROR", 502);
  }
}
