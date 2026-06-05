import { AIInferenceError } from "@/lib/agent-runner";
import { runDemoStep } from "@/lib/demo";
import { jsonError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { step?: number };
    if (!body.step || body.step < 1 || body.step > 6) {
      return jsonError("Demo step must be between 1 and 6", "INVALID_DEMO_STEP", 400);
    }

    return jsonOk(await runDemoStep(body.step));
  } catch (error) {
    console.error("Demo step failed", error);

    if (error instanceof AIInferenceError) {
      return jsonError(`AI inference failed: ${error.message}`, "AI_INFERENCE_FAILED", 500);
    }

    return jsonError("Demo step failed", "DEMO_STEP_FAILED", 500);
  }
}
