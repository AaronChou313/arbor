import { AppError, mapHttpError } from "./errors";

export async function* readSse(response: Response): AsyncGenerator<{ event?: string; data: string }> {
  if (!response.body) throw new AppError("BAD_RESPONSE", "The provider returned no response body.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      let event: string | undefined;
      const data: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
      }
      if (data.length) yield { event, data: data.join("\n") };
    }
    if (done) break;
  }
}

export async function responseError(response: Response): Promise<AppError> {
  let message = response.statusText;
  try {
    const body = (await response.json()) as Record<string, unknown>;
    const nested = body.error;
    if (nested && typeof nested === "object" && "message" in nested) {
      message = String((nested as { message: unknown }).message);
    } else if (typeof body.message === "string") message = body.message;
  } catch {
    // Keep the status text when the body is not JSON.
  }
  return mapHttpError(response.status, message);
}
