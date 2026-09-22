import { AppError, mapHttpError } from "./errors";

export async function* readSse(response: Response): AsyncGenerator<{ event?: string; data: string }> {
  if (!response.body) throw new AppError("BAD_RESPONSE", "The provider returned no response body.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const parseBlock = (block: string) => {
    let event: string | undefined;
    const data: string[] = [];
    for (const line of block.split(/\r\n|\n|\r/)) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
    }
    return data.length ? { event, data: data.join("\n") } : undefined;
  };

  const separator = /\r\n\r\n|\n\n|\r\r/;
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    let match = separator.exec(buffer);
    while (match?.index !== undefined) {
      const block = buffer.slice(0, match.index);
      buffer = buffer.slice(match.index + match[0].length);
      const parsed = parseBlock(block);
      if (parsed) yield parsed;
      match = separator.exec(buffer);
    }
    if (done) {
      const parsed = parseBlock(buffer);
      if (parsed) yield parsed;
      break;
    }
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
