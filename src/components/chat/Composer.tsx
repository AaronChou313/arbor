import { useEffect, useRef } from "react";
import type { SelectedAnchor } from "../../app/store";
import type { ProviderConfig } from "../../types/domain";
import { useI18n } from "../../i18n";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  selectedAnchor: SelectedAnchor | null;
  onClearAnchor: () => void;
  provider: ProviderConfig | undefined;
  generating: boolean;
  disabled?: boolean;
};

export function Composer(props: Props) {
  const { t } = useI18n();
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const textarea = ref.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [props.value]);

  return (
    <div className="composer-wrap">
      <div className="composer">
        {props.selectedAnchor && (
          <div className="anchor-chip">
            <span>{t("basedOn")} <strong>{props.selectedAnchor.title}</strong></span>
            <button aria-label={t("clearAnchor")} onClick={props.onClearAnchor}>×</button>
          </div>
        )}
        <textarea
          id="composer-input"
          ref={ref}
          rows={1}
          value={props.value}
          disabled={props.disabled}
          placeholder={`${t("askAnything")}…`}
          aria-label={t("message")}
          onChange={(event) => props.onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              props.onSend();
            }
            if (event.key === "Escape") {
              if (props.generating) props.onStop();
              else props.onClearAnchor();
            }
          }}
        />
        <div className="composer-footer">
          <span className="model-label" title={props.provider ? `${props.provider.name} · ${props.provider.model}` : t("configureProviderShort")}>
            {props.provider ? `${props.provider.name} · ${props.provider.model}` : t("noProvider")}
          </span>
          <button
            className={`send-button ${props.generating ? "stop" : ""}`}
            aria-label={props.generating ? t("stopGeneration") : t("sendMessage")}
            onClick={props.generating ? props.onStop : props.onSend}
            disabled={!props.generating && (!props.value.trim() || props.disabled)}
          >
            {props.generating ? <span className="stop-square" /> : "↑"}
          </button>
        </div>
      </div>
      <div className="composer-note">{t("composerNote")}</div>
    </div>
  );
}
