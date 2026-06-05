import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

export type AgentRunnerRole = "ORCHESTRATOR" | "BUDGET_AGENT" | "VENDOR_AGENT";

export const AGENT_PROMPTS: Record<AgentRunnerRole, string> = {
  BUDGET_AGENT: `You are BudgetAgent, a financial verification agent operating within a secure enterprise system.
Your credential scope is CHECK_BUDGET and VERIFY_FUNDS. You cannot initiate payments or approve purchases.
Return concise JSON with budget availability, simulated utilization, risk flags, and an APPROVED or INSUFFICIENT_FUNDS decision.`,

  VENDOR_AGENT: `You are VendorAgent, a procurement execution agent operating within a secure enterprise system.
Your scope is GENERATE_PO and CONTACT_APPROVED_VENDORS. Dell Technologies, Lenovo, HP, and Apple are pre-approved vendors.
Return concise JSON with vendor verification, total value, formal PO data, and APPROVED or REJECTED decision.`,

  ORCHESTRATOR: `You are OrchestratorAgent, the master coordination agent for enterprise procurement.
You hold full T3 verifiable identity and can issue scoped delegation credentials to sub-agents.
Return concise JSON with a delegation plan, risk notes, and the next action.`,
};

export interface AgentReasoning {
  reasoning: string;
  decision: "APPROVED" | "REJECTED" | "COMPLETED" | "INSUFFICIENT_FUNDS";
  data: Record<string, unknown>;
  model: string;
}

const MODEL_RETRY_DELAYS_MS = [750, 1_500];
const DEFAULT_NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const DEFAULT_NVIDIA_TIMEOUT_MS = 120_000;

export class AIInferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIInferenceError";
  }
}

export async function runAgentWithGemini(
  agentRole: AgentRunnerRole,
  action: string,
  payload: Record<string, unknown>,
): Promise<AgentReasoning> {
  return runAgentWithModel(agentRole, action, payload);
}

export async function runAgentWithModel(
  agentRole: AgentRunnerRole,
  action: string,
  payload: Record<string, unknown>,
): Promise<AgentReasoning> {
  if (process.env.ANTHROPIC_API_KEY) {
    return runWithAnthropic(agentRole, action, payload);
  }

  if (process.env.NVIDIA_API_KEY || process.env.NVCF_RUN_KEY) {
    return runWithNvidia(agentRole, action, payload);
  }

  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
    return runWithGemini(agentRole, action, payload);
  }

  throw new AIInferenceError(
    "No live model key configured. Set ANTHROPIC_API_KEY, NVIDIA_API_KEY, GEMINI_API_KEY, or GOOGLE_API_KEY.",
  );
}

async function runWithAnthropic(
  agentRole: AgentRunnerRole,
  action: string,
  payload: Record<string, unknown>,
): Promise<AgentReasoning> {
  try {
    const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model,
      max_tokens: 900,
      temperature: 0.35,
      system: AGENT_PROMPTS[agentRole],
      messages: [{ role: "user", content: reasoningPrompt(action, payload) }],
    });

    const text = response.content
      .filter((block): block is Anthropic.Messages.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    return parseReasoning(text, `anthropic:${model}`);
  } catch (error) {
    throw new AIInferenceError(error instanceof Error ? error.message : "Anthropic inference failed");
  }
}

async function runWithGemini(
  agentRole: AgentRunnerRole,
  action: string,
  payload: Record<string, unknown>,
): Promise<AgentReasoning> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new AIInferenceError("Gemini API key is not configured");
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const ai = new GoogleGenAI({ apiKey });
  const contents = `${AGENT_PROMPTS[agentRole]}

${reasoningPrompt(action, payload)}`;

  for (let attempt = 0; attempt <= MODEL_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
      });

      return parseReasoning(response.text ?? "", `google:${model}`);
    } catch (error) {
      if (error instanceof AIInferenceError) {
        throw error;
      }

      const canRetry = attempt < MODEL_RETRY_DELAYS_MS.length && isTransientModelError(error);
      if (canRetry) {
        await sleep(MODEL_RETRY_DELAYS_MS[attempt]);
        continue;
      }

      throw new AIInferenceError(errorMessage(error, "Gemini inference failed"));
    }
  }

  throw new AIInferenceError("Gemini inference failed");
}

async function runWithNvidia(
  agentRole: AgentRunnerRole,
  action: string,
  payload: Record<string, unknown>,
): Promise<AgentReasoning> {
  const apiKey = process.env.NVIDIA_API_KEY || process.env.NVCF_RUN_KEY;
  if (!apiKey) {
    throw new AIInferenceError("NVIDIA API key is not configured");
  }

  const baseUrl = (process.env.NVIDIA_BASE_URL || DEFAULT_NVIDIA_BASE_URL).replace(/\/+$/, "");
  const model = process.env.NVIDIA_MODEL || "z-ai/glm-5.1";
  const maxTokens = Number(process.env.NVIDIA_MAX_TOKENS || "512");
  const timeoutMs = Number(process.env.NVIDIA_TIMEOUT_MS || DEFAULT_NVIDIA_TIMEOUT_MS);

  for (let attempt = 0; attempt <= MODEL_RETRY_DELAYS_MS.length; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: nvidiaReasoningPrompt(agentRole, action, payload) }],
          temperature: 1,
          top_p: 1,
          max_tokens: maxTokens,
          stream: true,
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        const detail = body ? `: ${body.slice(0, 500)}` : "";
        throw new Error(`NVIDIA inference failed (${response.status})${detail}`);
      }

      const text = await readNvidiaStream(response);
      return parseReasoning(text, `nvidia:${model}`);
    } catch (error) {
      if (error instanceof AIInferenceError) {
        throw error;
      }

      const canRetry = attempt < MODEL_RETRY_DELAYS_MS.length && isTransientModelError(error);
      if (canRetry) {
        await sleep(MODEL_RETRY_DELAYS_MS[attempt]);
        continue;
      }

      throw new AIInferenceError(errorMessage(error, "NVIDIA inference failed"));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new AIInferenceError("NVIDIA inference failed");
}

async function readNvidiaStream(response: Response) {
  if (!response.body) {
    throw new AIInferenceError("NVIDIA inference response did not include a stream body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let content = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    pending += decoder.decode(value, { stream: true });
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) {
        continue;
      }

      const data = trimmed.slice("data:".length).trim();
      if (!data || data === "[DONE]") {
        continue;
      }

      const parsed = JSON.parse(data) as {
        choices?: Array<{ delta?: { content?: string | null }; message?: { content?: string | null } }>;
      };
      content += parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.message?.content ?? "";
    }
  }

  return content.trim();
}

function nvidiaReasoningPrompt(agentRole: AgentRunnerRole, action: string, payload: Record<string, unknown>) {
  const role = {
    BUDGET_AGENT:
      "You are BudgetAgent. You can only check budgets and verify funds. Decide if the requested spend is within scope.",
    VENDOR_AGENT:
      "You are VendorAgent. You can generate purchase orders and contact approved vendors only when delegated scope allows it.",
    ORCHESTRATOR:
      "You are OrchestratorAgent. Create a scoped delegation plan for BudgetAgent and VendorAgent.",
  }[agentRole];

  return `${role}
Action: ${action}
Payload: ${JSON.stringify(payload)}

Return only compact JSON:
{"reasoning":"one concise sentence","decision":"APPROVED|REJECTED|COMPLETED|INSUFFICIENT_FUNDS","data":{}}`;
}

function reasoningPrompt(action: string, payload: Record<string, unknown>) {
  return `Action: ${action}
Payload: ${JSON.stringify(payload, null, 2)}

Respond only with valid JSON:
{ "reasoning": "...", "decision": "APPROVED|REJECTED|COMPLETED|INSUFFICIENT_FUNDS", "data": {...} }`;
}

function parseReasoning(text: string, model: string): AgentReasoning {
  const clean = text.replace(/```json|```/g, "").trim();

  try {
    const parsed = JSON.parse(clean) as Partial<AgentReasoning>;
    return {
      reasoning: String(parsed.reasoning ?? clean),
      decision: (parsed.decision ?? "COMPLETED") as AgentReasoning["decision"],
      data: typeof parsed.data === "object" && parsed.data ? parsed.data : {},
      model,
    };
  } catch {
    if (!clean) {
      throw new AIInferenceError("Live model returned an empty response");
    }

    return {
      reasoning: clean,
      decision: "COMPLETED",
      data: {},
      model,
    };
  }
}

function isTransientModelError(error: unknown) {
  const message = errorMessage(error, "");
  return (
    message.includes('"code":429') ||
    message.includes('"code":503') ||
    message.includes('"status":"RESOURCE_EXHAUSTED"') ||
    message.includes('"status":"UNAVAILABLE"') ||
    message.includes("429") ||
    message.includes("503")
  );
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
