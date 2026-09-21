import type { CanonicalMessage, ConversationNode, StructuredAnswer } from "../../types/domain";

function fullAnswer(answer: StructuredAnswer): string {
  if (!answer.sections.length && answer.rawText) return answer.rawText;
  return [
    answer.intro,
    ...answer.sections.map((section) => `## ${section.title}\n\n${section.content}`),
    answer.outro,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildContext(path: ConversationNode[]): CanonicalMessage[] {
  const messages: CanonicalMessage[] = [];

  path.forEach((node, index) => {
    messages.push({ role: "user", content: node.userMessage });
    if (!node.assistant) return;

    const nextNode = path[index + 1];
    if (nextNode?.anchorSectionId) {
      const section = node.assistant.sections.find(
        (candidate) => candidate.id === nextNode.anchorSectionId,
      );
      if (section) {
        messages.push({
          role: "assistant",
          content: [node.assistant.intro, `## ${section.title}\n\n${section.content}`]
            .filter(Boolean)
            .join("\n\n"),
        });
        return;
      }
    }

    const content = fullAnswer(node.assistant);
    if (content.trim()) messages.push({ role: "assistant", content });
  });

  return messages;
}
