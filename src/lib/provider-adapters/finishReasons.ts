import type { FinishReason } from "../../types/domain";

export function chatFinishReason(reason?: string | null): FinishReason {
  if (reason === "stop") return "stop";
  if (reason === "length") return "length";
  if (reason === "content_filter") return "content-filter";
  if (reason === "tool_calls" || reason === "function_call") return "tool-call";
  return "unknown";
}

export function anthropicFinishReason(reason?: string | null): FinishReason {
  if (reason === "end_turn" || reason === "stop_sequence") return "stop";
  if (reason === "max_tokens" || reason === "model_context_window_exceeded") return "length";
  if (reason === "tool_use") return "tool-call";
  if (reason === "refusal") return "content-filter";
  return "unknown";
}

export function responsesFinishReason(status?: string, incompleteReason?: string | null): FinishReason {
  if (incompleteReason === "max_output_tokens" || incompleteReason === "max_tokens") return "length";
  if (incompleteReason === "content_filter") return "content-filter";
  if (status === "completed") return "stop";
  if (status === "failed" || status === "cancelled") return "error";
  return "unknown";
}
