import { resetDemo } from "@/lib/demo";
import { jsonError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    return jsonOk(await resetDemo());
  } catch (error) {
    console.error("Demo reset failed", error);
    return jsonError("Failed to reset demo", "DEMO_RESET_FAILED", 500);
  }
}
