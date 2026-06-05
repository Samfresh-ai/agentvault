import { getDemoState } from "@/lib/demo";
import { jsonError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return jsonOk(await getDemoState(10));
  } catch (error) {
    console.error("Demo state failed", error);
    return jsonError("Failed to load demo state", "DEMO_STATE_FAILED", 500);
  }
}
