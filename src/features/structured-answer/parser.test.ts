import { describe, expect, it } from "vitest";
import { parseStructuredAnswer } from "./parser";

describe("parseStructuredAnswer", () => {
  it("parses fenced JSON and keeps raw text", () => {
    const raw = '```json\n{"intro":"Hi","sections":[{"id":"a","title":"A","content":"Body"}],"outro":"Bye"}\n```';
    expect(parseStructuredAnswer(raw)).toMatchObject({ intro: "Hi", outro: "Bye", sections: [{ id: "a", title: "A", content: "Body" }], rawText: raw });
  });

  it("extracts JSON surrounded by incidental text", () => {
    const answer = parseStructuredAnswer('prefix {"sections":[{"title":"A","content":"Body"}]} suffix');
    expect(answer?.sections[0].id).toBe("section-1");
  });

  it("returns null for malformed or sectionless output", () => {
    expect(parseStructuredAnswer("not json")).toBeNull();
    expect(parseStructuredAnswer('{"sections":[]}')).toBeNull();
  });
});
