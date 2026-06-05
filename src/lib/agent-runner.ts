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

  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
    return runWithGemini(agentRole, action, payload);
  }

  throw new AIInferenceError("No live model key configured. Set ANTHROPIC_API_KEY, GEMINI_API_KEY, or GOOGLE_API_KEY.");
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
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new AIInferenceError("Gemini API key is not configured");
    }

    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: `${AGENT_PROMPTS[agentRole]}

${reasoningPrompt(action, payload)}`,
    });

    return parseReasoning(response.text ?? "", `google:${model}`);
  } catch (error) {
    throw new AIInferenceError(error instanceof Error ? error.message : "Gemini inference failed");
  }
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
