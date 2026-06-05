import { ScopeViolationError, validateTaskValueForAction } from "@/lib/scope-check";

export interface TaskExecutionRequest {
  agentId: string;
  action: string;
  payload: Record<string, unknown>;
}

export class TaskInputError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(message: string, code = "INVALID_TASK_INPUT", status = 400) {
    super(message);
    this.name = "TaskInputError";
    this.code = code;
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function parseTaskExecutionRequest(value: unknown): TaskExecutionRequest {
  if (!isRecord(value)) {
    throw new TaskInputError("Request body must be a JSON object");
  }

  if (!nonEmptyString(value.agentId) || !nonEmptyString(value.action) || !isRecord(value.payload)) {
    throw new TaskInputError("agentId, action, and payload object are required");
  }

  return {
    agentId: value.agentId,
    action: value.action,
    payload: value.payload,
  };
}

export function taskValueFromPayload(action: string, payload: Record<string, unknown>): number | undefined {
  try {
    return validateTaskValueForAction(action, payload);
  } catch (error) {
    if (error instanceof ScopeViolationError && error.violationType === "INVALID_TASK_VALUE") {
      throw new TaskInputError(error.detail, "INVALID_TASK_VALUE");
    }

    throw error;
  }
}
