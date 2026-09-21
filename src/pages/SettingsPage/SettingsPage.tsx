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

function newProvider(): ProviderConfig {
  const now = Date.now();
  return {
    id: createId("provider"),
    name: "New provider",
    protocol: "openai-responses",
    baseUrl: defaults["openai-responses"],
    apiKey: "",
    rememberApiKey: false,
    model: "",
    createdAt: now,
    updatedAt: now,
  };
}

export function SettingsPage() {
  const navigate = useNavigate();
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
  const [notice, setNotice] = useState("");
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
      setNotice("Name, Base URL, and Model are required.");
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
    setNotice("Provider saved.");
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
    setNotice("Active provider updated.");
    refresh();
  };

  const duplicateProvider = () => {
    if (!draft) return;
    const now = Date.now();
    const copy = { ...draft, id: createId("provider"), name: `${draft.name} copy`, createdAt: now, updatedAt: now };
    setSelectedId(copy.id);
    setDraft(copy);
    setTestResult(null);
  };

  const deleteProvider = async () => {
    if (!draft || !providers.some((item) => item.id === draft.id)) return;
    if (!window.confirm(`Delete provider “${draft.name}”?`)) return;
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
        setNotice("Conversation imported.");
      } else {
        if (!window.confirm("Restore this backup and replace all current Arbor data?")) return;
        await restoreBackup(data);
        setActiveConversationId(null);
        setNotice("Backup restored.");
      }
      refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Import failed.");
    }
  };

  return (
    <section className="settings-page">
      <header className="settings-header">
        <button className="icon-button mobile-menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation">☰</button>
        <div><div className="eyebrow">Arbor</div><h1>Settings</h1></div>
        <button className="text-button" onClick={() => navigate("/")}>Back to chat</button>
      </header>

      <div className="settings-content">
        {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss">×</button></div>}

        <section className="settings-section">
          <div className="settings-section-title">
            <div><h2>Providers</h2><p>Connections are called directly from this browser.</p></div>
            <button className="secondary-button" onClick={() => { const next = newProvider(); setSelectedId(next.id); setDraft(next); setTestResult(null); }}>＋ Add provider</button>
          </div>

          <div className="provider-list">
            {providers.map((provider) => (
              <button className={`provider-row ${selectedId === provider.id ? "selected" : ""}`} key={provider.id} onClick={() => selectProvider(provider)}>
                <span><strong>{provider.name}</strong><small>{protocolLabels[provider.protocol]} · {provider.model}</small></span>
                {preferences.activeProviderId === provider.id && <span className="active-status">Active</span>}
              </button>
            ))}
            {!providers.length && !draft && <p className="muted-copy">No providers yet. Add one to start chatting.</p>}
          </div>

          {draft && (
            <div className="provider-editor">
              <label>Name<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
              <label>Protocol
                <select value={draft.protocol} onChange={(event) => updateProtocol(event.target.value as ProviderProtocol)}>
                  {Object.entries(protocolLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                </select>
              </label>
              <label className="field-wide">Base URL<input value={draft.baseUrl} placeholder={defaults[draft.protocol]} onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })} /></label>
              <label>API Key<input type="password" autoComplete="off" value={draft.apiKey ?? ""} onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })} /></label>
              <label>Model<input value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })} /></label>
              <label className="checkbox-label field-wide">
                <input type="checkbox" checked={draft.rememberApiKey} onChange={(event) => setDraft({ ...draft, rememberApiKey: event.target.checked })} />
                Remember API key on this device
              </label>
              <p className="security-note field-wide">Your key is sent directly to the configured model service. Browser storage is not a secure vault, and some endpoints may block browser requests with CORS.</p>
              {testResult && <div className={`test-result field-wide ${testResult.ok ? "success" : "error"}`}>{testResult.ok ? "✓" : "!"} {testResult.message}</div>}
              <div className="form-actions field-wide">
                {providers.some((item) => item.id === draft.id) && preferences.activeProviderId !== draft.id && <button className="secondary-button" onClick={() => void makeActive(draft.id)}>Set active</button>}
                {providers.some((item) => item.id === draft.id) && <button className="secondary-button" onClick={duplicateProvider}>Duplicate</button>}
                {providers.some((item) => item.id === draft.id) && <button className="text-button danger-text" onClick={() => void deleteProvider()}>Delete</button>}
                <span className="form-spacer" />
                <button className="secondary-button" disabled={testing} onClick={() => void testProvider()}>{testing ? "Testing…" : "Test connection"}</button>
                <button className="primary-button" onClick={() => void saveProvider()}>Save</button>
              </div>
            </div>
          )}
        </section>

        <section className="settings-section split">
          <div><h2>Response</h2><p>Control how Arbor structures learning answers.</p></div>
          <div className="compact-form">
            <label>Detail<select value={prefsDraft.detail} onChange={(event) => void updatePreferences("detail", event.target.value as Preferences["detail"])}><option value="concise">Concise</option><option value="balanced">Balanced</option><option value="detailed">Detailed</option></select></label>
            <label>Section density<select value={prefsDraft.sectionDensity} onChange={(event) => void updatePreferences("sectionDensity", event.target.value as Preferences["sectionDensity"])}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
            <label>Math<select value={prefsDraft.math} onChange={(event) => void updatePreferences("math", event.target.value as Preferences["math"])}><option value="auto">Auto</option><option value="latex">Prefer LaTeX</option></select></label>
          </div>
        </section>

        <section className="settings-section split">
          <div><h2>System prompt</h2><p>Optional personal learning context.</p></div>
          <textarea rows={6} value={prefsDraft.userSystemPrompt} placeholder="Describe your background or preferred explanation style…" onChange={(event) => setPrefsDraft({ ...prefsDraft, userSystemPrompt: event.target.value })} onBlur={() => void updatePreferences("userSystemPrompt", prefsDraft.userSystemPrompt)} />
        </section>

        <section className="settings-section split">
          <div><h2>Appearance</h2><p>Choose a quiet, readable theme.</p></div>
          <div className="segmented" role="group" aria-label="Theme">
            {(["system", "light", "dark"] as const).map((theme) => <button key={theme} className={prefsDraft.theme === theme ? "active" : ""} onClick={() => void updatePreferences("theme", theme)}>{theme[0].toUpperCase() + theme.slice(1)}</button>)}
          </div>
        </section>

        <section className="settings-section split">
          <div><h2>Data</h2><p>Export a conversation or back up all local Arbor data.</p></div>
          <div className="data-actions">
            <div className="data-row"><div><strong>Current conversation</strong><span>JSON with the conversation and every branch.</span></div><button className="secondary-button" disabled={!activeConversationId} onClick={() => activeConversationId && void exportConversation(activeConversationId)}>Export</button></div>
            <div className="data-row"><div><strong>Import conversation</strong><span>Imported IDs are regenerated to avoid conflicts.</span></div><button className="secondary-button" onClick={() => conversationInput.current?.click()}>Import</button></div>
            <div className="data-row"><div><strong>Full backup</strong><span>Conversations, providers, and preferences.</span></div><button className="secondary-button" onClick={() => void exportBackup(includeKeys)}>Export</button></div>
            <label className="checkbox-label"><input type="checkbox" checked={includeKeys} onChange={(event) => setIncludeKeys(event.target.checked)} />Include remembered API keys in backup</label>
            <div className="data-row danger-zone"><div><strong>Restore backup</strong><span>Replaces all current local Arbor data.</span></div><button className="secondary-button" onClick={() => backupInput.current?.click()}>Restore</button></div>
            <input ref={conversationInput} hidden type="file" accept="application/json,.json" onChange={(event) => { void handleImport(event.target.files?.[0], "conversation"); event.target.value = ""; }} />
            <input ref={backupInput} hidden type="file" accept="application/json,.json" onChange={(event) => { void handleImport(event.target.files?.[0], "backup"); event.target.value = ""; }} />
          </div>
        </section>
      </div>
    </section>
  );
}
