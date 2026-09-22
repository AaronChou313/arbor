import type { CanonicalMessage, ConversationNode, StructuredAnswer } from "../../types/domain";

const selectedSectionInstructions = `Arbor selected-section context:
- The user explicitly selected this Section as the target of the next question.
- Interpret the next question as referring to this Section by default.
- Resolve local references such as “here”, “this”, “above”, “the third step”, and “this formula” inside this Section first.
- If more than one object inside the Section could match a reference, do not guess. Ask the user a brief clarifying question.`;

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
        const futureAnchor = [
          nextNode.anchorBlockId ? `Selected block ID: ${nextNode.anchorBlockId}` : undefined,
          nextNode.anchorQuote ? `Selected quote: ${nextNode.anchorQuote}` : undefined,
        ].filter(Boolean);
        messages.push({
          role: "assistant",
          content: [
            selectedSectionInstructions,
            ...futureAnchor,
            `Selected Section title: ${section.title}`,
            node.assistant.intro,
            `## ${section.title}\n\n${section.content}`,
          ]
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
