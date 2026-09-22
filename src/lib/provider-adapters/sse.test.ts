import { describe, expect, it } from "vitest";
import { readSse } from "./sse";

describe("readSse", () => {
  it("flushes a final event when EOF has no blank-line delimiter", async () => {
    const response = new Response("event: message_delta\ndata: {\"type\":\"message_delta\"}");
    const events = [];
    for await (const event of readSse(response)) events.push(event);
    expect(events).toEqual([{ event: "message_delta", data: '{"type":"message_delta"}' }]);
  });

  it("joins multi-line data fields", async () => {
    const response = new Response("data: first\r\ndata: second\r\n\r\n");
    const events = [];
    for await (const event of readSse(response)) events.push(event);
    expect(events).toEqual([{ event: undefined, data: "first\nsecond" }]);
  });
});
