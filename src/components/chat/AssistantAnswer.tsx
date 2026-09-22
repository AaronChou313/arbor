import type { ConversationNode } from "../../types/domain";
import type { SelectedAnchor } from "../../app/store";
import { Markdown } from "../common/Markdown";
import { providerErrorKey, useI18n } from "../../i18n";

type Props = {
  node: ConversationNode;
  selectedAnchor: SelectedAnchor | null;
  onSelectAnchor: (anchor: SelectedAnchor) => void;
  onRetry: () => void;
};

export function AssistantAnswer({ node, selectedAnchor, onSelectAnchor, onRetry }: Props) {
  const { t } = useI18n();
  const answer = node.assistant;
  const isStreaming = node.status === "pending" || node.status === "streaming";
  const errorMessage = node.error ? t(providerErrorKey(node.error)) : undefined;

  if ((node.status === "error" || node.status === "aborted") && !answer?.rawText) {
    return (
      <article className="message assistant-message">
        <div className="message-role">Arbor</div>
        <div className="generation-error">
          <p>{errorMessage || (node.status === "aborted" ? t("generationStopped") : t("generationFailed"))}</p>
          <button className="secondary-button" onClick={onRetry}>{t("retry")}</button>
        </div>
      </article>
    );
  }

  return (
    <article className="message assistant-message" aria-live={isStreaming ? "polite" : undefined}>
      <div className="message-role">Arbor</div>
      {isStreaming || !answer?.sections.length ? (
        <>
          {answer?.fallbackReason === "protocol" ? (
            <p className="protocol-fallback">{t("responseProtocolError")}</p>
          ) : answer?.rawText ? <Markdown>{answer.rawText}</Markdown> : <div className="typing-indicator"><span /><span /><span /></div>}
          {isStreaming && answer?.rawText && <span className="stream-cursor" />}
        </>
      ) : (
        <>
          {answer.intro && <div className="assistant-intro"><Markdown>{answer.intro}</Markdown></div>}
          {answer.sections.map((section) => {
            const selected = selectedAnchor?.sourceNodeId === node.id && selectedAnchor.sectionId === section.id;
            return (
              <button
                key={section.id}
                className={`answer-section ${selected ? "selected" : ""}`}
                aria-pressed={selected}
                onClick={() => onSelectAnchor({ sourceNodeId: node.id, sectionId: section.id, title: section.title })}
              >
                <span className="section-topline"><span className="section-title">{section.title}</span><span className="section-arrow" aria-hidden>↗</span></span>
                <span className="section-content"><Markdown>{section.content}</Markdown></span>
              </button>
            );
          })}
          {answer.outro && <div className="assistant-outro"><Markdown>{answer.outro}</Markdown></div>}
        </>
      )}
      {errorMessage && (
        <div className="inline-generation-state">
          <span>{errorMessage}</span>
          {node.status !== "done" && <button className="text-button" onClick={onRetry}>{t("retry")}</button>}
        </div>
      )}
    </article>
  );
}
