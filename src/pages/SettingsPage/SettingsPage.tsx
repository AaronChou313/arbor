import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../../app/store";
import { useAppData } from "../../hooks/useAppData";
import { preferencesRepo, providerRepo } from "../../lib/db/repositories";
import { exportBackup, exportConversation } from "../../lib/export/exportData";
import { importConversationData, readJsonFile, restoreBackup } from "../../lib/export/importData";
import { getProviderAdapter } from "../../lib/provider-adapters";
import { createId } from "../../lib/utils/id";
import { getProviderKey, removeSessionKey, storeSessionKey } from "../../lib/utils/secret";
import type { Preferences, ProviderConfig, ProviderProtocol, TestResult } from "../../types/domain";
import { testStageKey, useI18n, type TranslationKey } from "../../i18n";

const defaults: Record<ProviderProtocol, string> = {
  anthropic: "https://api.anthropic.com",
  "openai-responses": "https://api.openai.com",
  "chat-completions": "https://api.openai.com",
};

const protocolLabels: Record<ProviderProtocol, string> = {
  anthropic: "Anthropic",
  "openai-responses": "OpenAI Responses",
  "chat-completions": "Chat Completions",
};

function newProvider(name: string): ProviderConfig {
  const now = Date.now();
  return {
    id: createId("provider"),
    name,
    protocol: "openai-responses",
    baseUrl: defaults["openai-responses"],
    apiKey: "",
    rememberApiKey: false,
    model: "",
    maxOutputTokens: undefined,
    createdAt: now,
    updatedAt: now,
  };
}

export function SettingsPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { providers, preferences } = useAppData();
  const refresh = useAppStore((state) => state.refreshData);
  const activeConversationId = useAppStore((state) => state.activeConversationId);
  const setActiveConversationId = useAppStore((state) => state.setActiveConversationId);
  const setSidebarOpen = useAppStore((state) => state.setSidebarOpen);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProviderConfig | null>(null);
  const [prefsDraft, setPrefsDraft] = useState<Preferences>(preferences);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [notice, setNotice] = useState<TranslationKey | null>(null);
  const [includeKeys, setIncludeKeys] = useState(false);
  const conversationInput = useRef<HTMLInputElement>(null);
  const backupInput = useRef<HTMLInputElement>(null);

  useEffect(() => setPrefsDraft(preferences), [preferences]);

  useEffect(() => {
    if (selectedId && providers.some((item) => item.id === selectedId)) return;
    const first = providers.find((item) => item.id === preferences.activeProviderId) ?? providers[0];
    if (first) {
      setSelectedId(first.id);
      setDraft({ ...first, apiKey: getProviderKey(first) });
    }
  }, [providers, preferences.activeProviderId, selectedId]);

  const selectProvider = (provider: ProviderConfig) => {
    setSelectedId(provider.id);
    setDraft({ ...provider, apiKey: getProviderKey(provider) });
    setTestResult(null);
  };

  const updateProtocol = (protocol: ProviderProtocol) => {
    if (!draft) return;
    const wasDefault = Object.values(defaults).includes(draft.baseUrl);
    setDraft({ ...draft, protocol, baseUrl: wasDefault ? defaults[protocol] : draft.baseUrl });
  };

  const saveProvider = async () => {
    if (!draft?.name.trim() || !draft.baseUrl.trim() || !draft.model.trim()) {
      setNotice("requiredProviderFields");
      return;
    }
    if (draft.maxOutputTokens !== undefined &&
      (!Number.isInteger(draft.maxOutputTokens) || draft.maxOutputTokens <= 0)) {
      setNotice("invalidMaxOutputTokens");
      return;
    }
    const key = draft.apiKey ?? "";
    const stored: ProviderConfig = {
      ...draft,
      name: draft.name.trim(),
      baseUrl: draft.baseUrl.trim(),
      model: draft.model.trim(),
      apiKey: draft.rememberApiKey ? key : undefined,
      updatedAt: Date.now(),
    };
    if (stored.rememberApiKey) removeSessionKey(stored.id);
    else storeSessionKey(stored.id, key);
    await providerRepo.put(stored);
    if (!preferences.activeProviderId) {
      await preferencesRepo.put({ ...preferences, activeProviderId: stored.id });
    }
    setSelectedId(stored.id);
    setNotice("providerSaved");
    refresh();
  };

  const testProvider = async () => {
    if (!draft) return;
    setTesting(true);
    setTestResult(null);
    const result = await getProviderAdapter(draft.protocol).test(draft);
    setTestResult(result);
    setTesting(false);
  };

  const makeActive = async (id: string) => {
    await preferencesRepo.put({ ...preferences, activeProviderId: id });
    setNotice("activeProviderUpdated");
    refresh();
  };

  const duplicateProvider = () => {
    if (!draft) return;
    const now = Date.now();
    const copy = { ...draft, id: createId("provider"), name: t("providerCopy", { name: draft.name }), createdAt: now, updatedAt: now };
    setSelectedId(copy.id);
    setDraft(copy);
    setTestResult(null);
  };

  const deleteProvider = async () => {
    if (!draft || !providers.some((item) => item.id === draft.id)) return;
    if (!window.confirm(t("deleteProviderConfirm", { name: draft.name }))) return;
    await providerRepo.delete(draft.id);
    removeSessionKey(draft.id);
    const nextActive = preferences.activeProviderId === draft.id
      ? providers.find((item) => item.id !== draft.id)?.id ?? null
      : preferences.activeProviderId;
    if (nextActive !== preferences.activeProviderId) {
      await preferencesRepo.put({ ...preferences, activeProviderId: nextActive });
    }
    setSelectedId(null);
    setDraft(null);
    refresh();
  };

  const updatePreferences = async <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    const next = { ...prefsDraft, [key]: value };
    setPrefsDraft(next);
    await preferencesRepo.put(next);
    refresh();
  };

  const handleImport = async (file: File | undefined, kind: "conversation" | "backup") => {
    if (!file) return;
    try {
      const data = await readJsonFile(file);
      if (kind === "conversation") {
        const id = await importConversationData(data);
        setActiveConversationId(id);
        setNotice("conversationImported");
      } else {
        if (!window.confirm(t("restoreConfirm"))) return;
        await restoreBackup(data);
        setActiveConversationId(null);
        setNotice("backupRestored");
      }
      refresh();
    } catch {
      setNotice("importFailed");
    }
  };

  return (
    <section className="settings-page">
      <header className="settings-header">
        <button className="icon-button mobile-menu-button" onClick={() => setSidebarOpen(true)} aria-label={t("openNavigation")}>☰</button>
        <div><div className="eyebrow">Arbor</div><h1>{t("settings")}</h1></div>
        <button className="text-button" onClick={() => navigate("/")}>{t("backToChat")}</button>
      </header>

      <div className="settings-content">
        {notice && <div className="notice" role="status"><span>{t(notice)}</span><button onClick={() => setNotice(null)} aria-label={t("dismiss")}>×</button></div>}

        <section className="settings-section">
          <div className="settings-section-title">
            <div><h2>{t("providers")}</h2><p>{t("providersDescription")}</p></div>
            <button className="secondary-button" onClick={() => { const next = newProvider(t("addProvider")); setSelectedId(next.id); setDraft(next); setTestResult(null); }}>＋ {t("addProvider")}</button>
          </div>

          <div className="provider-list">
            {providers.map((provider) => (
              <button className={`provider-row ${selectedId === provider.id ? "selected" : ""}`} key={provider.id} onClick={() => selectProvider(provider)}>
                <span><strong>{provider.name}</strong><small>{protocolLabels[provider.protocol]} · {provider.model}</small></span>
                {preferences.activeProviderId === provider.id && <span className="active-status">{t("active")}</span>}
              </button>
            ))}
            {!providers.length && !draft && <p className="muted-copy">{t("noProviders")}</p>}
          </div>

          {draft && (
            <div className="provider-editor">
              <label>{t("name")}<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
              <label>{t("protocol")}
                <select value={draft.protocol} onChange={(event) => updateProtocol(event.target.value as ProviderProtocol)}>
                  {Object.entries(protocolLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                </select>
              </label>
              <label className="field-wide">{t("baseUrl")}<input value={draft.baseUrl} placeholder={defaults[draft.protocol]} onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })} /></label>
              <label>{t("apiKey")}<input type="password" autoComplete="off" value={draft.apiKey ?? ""} onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })} /></label>
              <label>{t("model")}<input value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })} /></label>
              <details className="advanced-settings field-wide">
                <summary>{t("advanced")}</summary>
                <label>{t("maxOutputTokens")}
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder={t("automatic")}
                    value={draft.maxOutputTokens ?? ""}
                    onChange={(event) => setDraft({
                      ...draft,
                      maxOutputTokens: event.target.value === "" ? undefined : Number(event.target.value),
                    })}
                  />
                  <small>{t("maxOutputTokensHint")}</small>
                </label>
              </details>
              <label className="checkbox-label field-wide">
                <input type="checkbox" checked={draft.rememberApiKey} onChange={(event) => setDraft({ ...draft, rememberApiKey: event.target.checked })} />
                {t("rememberApiKey")}
              </label>
              <p className="security-note field-wide">{t("securityNote")}</p>
              {testResult && <div className={`test-result field-wide ${testResult.ok ? "success" : "error"}`}>{testResult.ok ? "✓" : "!"} {t(testResult.ok ? "connectionSuccess" : testStageKey(testResult.stage))}</div>}
              <div className="form-actions field-wide">
                {providers.some((item) => item.id === draft.id) && preferences.activeProviderId !== draft.id && <button className="secondary-button" onClick={() => void makeActive(draft.id)}>{t("setActive")}</button>}
                {providers.some((item) => item.id === draft.id) && <button className="secondary-button" onClick={duplicateProvider}>{t("duplicate")}</button>}
                {providers.some((item) => item.id === draft.id) && <button className="text-button danger-text" onClick={() => void deleteProvider()}>{t("delete")}</button>}
                <span className="form-spacer" />
                <button className="secondary-button" disabled={testing} onClick={() => void testProvider()}>{testing ? t("testing") : t("testConnection")}</button>
                <button className="primary-button" onClick={() => void saveProvider()}>{t("save")}</button>
              </div>
            </div>
          )}
        </section>

        <section className="settings-section split">
          <div><h2>{t("response")}</h2><p>{t("responseDescription")}</p></div>
          <div className="compact-form">
            <label>{t("detail")}<select value={prefsDraft.detail} onChange={(event) => void updatePreferences("detail", event.target.value as Preferences["detail"])}><option value="concise">{t("concise")}</option><option value="balanced">{t("balanced")}</option><option value="detailed">{t("detailed")}</option></select></label>
            <label>{t("sectionDensity")}<select value={prefsDraft.sectionDensity} onChange={(event) => void updatePreferences("sectionDensity", event.target.value as Preferences["sectionDensity"])}><option value="low">{t("low")}</option><option value="medium">{t("medium")}</option><option value="high">{t("high")}</option></select></label>
            <label>{t("math")}<select value={prefsDraft.math} onChange={(event) => void updatePreferences("math", event.target.value as Preferences["math"])}><option value="auto">{t("automatic")}</option><option value="latex">{t("preferLatex")}</option></select></label>
          </div>
        </section>

        <section className="settings-section split">
          <div><h2>{t("systemPrompt")}</h2><p>{t("systemPromptDescription")}</p></div>
          <textarea rows={6} value={prefsDraft.userSystemPrompt} placeholder={t("systemPromptPlaceholder")} onChange={(event) => setPrefsDraft({ ...prefsDraft, userSystemPrompt: event.target.value })} onBlur={() => void updatePreferences("userSystemPrompt", prefsDraft.userSystemPrompt)} />
        </section>

        <section className="settings-section split">
          <div><h2>{t("appearance")}</h2><p>{t("appearanceDescription")}</p></div>
          <div className="appearance-controls">
            <div>
              <label className="control-label">{t("theme")}</label>
              <div className="segmented" role="group" aria-label={t("theme")}>
                {(["system", "light", "dark"] as const).map((theme) => <button key={theme} className={prefsDraft.theme === theme ? "active" : ""} onClick={() => void updatePreferences("theme", theme)}>{t(theme)}</button>)}
              </div>
            </div>
            <label className="language-control">{t("language")}
              <select value={prefsDraft.language} onChange={(event) => void updatePreferences("language", event.target.value as Preferences["language"])}>
                <option value="auto">{t("languageAuto")}</option>
                <option value="zh-CN">{t("languageChinese")}</option>
                <option value="en-US">{t("languageEnglish")}</option>
              </select>
            </label>
          </div>
        </section>

        <section className="settings-section split">
          <div><h2>{t("data")}</h2><p>{t("dataDescription")}</p></div>
          <div className="data-actions">
            <div className="data-row"><div><strong>{t("currentConversationData")}</strong><span>{t("currentConversationDescription")}</span></div><button className="secondary-button" disabled={!activeConversationId} onClick={() => activeConversationId && void exportConversation(activeConversationId)}>{t("export")}</button></div>
            <div className="data-row"><div><strong>{t("importConversation")}</strong><span>{t("importConversationDescription")}</span></div><button className="secondary-button" onClick={() => conversationInput.current?.click()}>{t("import")}</button></div>
            <div className="data-row"><div><strong>{t("fullBackup")}</strong><span>{t("fullBackupDescription")}</span></div><button className="secondary-button" onClick={() => void exportBackup(includeKeys)}>{t("export")}</button></div>
            <label className="checkbox-label"><input type="checkbox" checked={includeKeys} onChange={(event) => setIncludeKeys(event.target.checked)} />{t("includeKeys")}</label>
            <div className="data-row danger-zone"><div><strong>{t("restoreBackup")}</strong><span>{t("restoreBackupDescription")}</span></div><button className="secondary-button" onClick={() => backupInput.current?.click()}>{t("restore")}</button></div>
            <input ref={conversationInput} hidden type="file" accept="application/json,.json" onChange={(event) => { void handleImport(event.target.files?.[0], "conversation"); event.target.value = ""; }} />
            <input ref={backupInput} hidden type="file" accept="application/json,.json" onChange={(event) => { void handleImport(event.target.files?.[0], "backup"); event.target.value = ""; }} />
          </div>
        </section>
      </div>
    </section>
  );
}
