import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../../app/store";
import { AssistantAnswer } from "../../components/chat/AssistantAnswer";
import { Composer } from "../../components/chat/Composer";
import { Markdown } from "../../components/common/Markdown";
import { TreeDrawer } from "../../components/tree/TreeDrawer";
import { buildSystemPrompt } from "../../features/generation/systemPrompt";
import { fallbackAnswer, parseStructuredAnswer } from "../../features/structured-answer/parser";
import { useAppData } from "../../hooks/useAppData";
import { buildContext } from "../../lib/context/buildContext";
import { buildPath } from "../../lib/context/buildPath";
import { conversationRepo, nodeRepo, preferencesRepo } from "../../lib/db/repositories";
import { getProviderAdapter } from "../../lib/provider-adapters";
import { AppError, mapFetchError } from "../../lib/provider-adapters/errors";
import { createId, truncateTitle } from "../../lib/utils/id";
import type { Conversation, ConversationNode } from "../../types/domain";

export function ChatPage() {
  const navigate = useNavigate();
  const { providers, preferences } = useAppData();
  const activeConversationId = useAppStore((state) => state.activeConversationId);
  const setActiveConversationId = useAppStore((state) => state.setActiveConversationId);
  const selectedAnchor = useAppStore((state) => state.selectedAnchor);
  const setSelectedAnchor = useAppStore((state) => state.setSelectedAnchor);
  const treeOpen = useAppStore((state) => state.treeOpen);
  const setTreeOpen = useAppStore((state) => state.setTreeOpen);
  const setSidebarOpen = useAppStore((state) => state.setSidebarOpen);
  const refreshData = useAppStore((state) => state.refreshData);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [nodes, setNodes] = useState<ConversationNode[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeProvider =
    providers.find((item) => item.id === preferences.activeProviderId) ?? providers[0];
  const path = useMemo(
    () => buildPath(conversation?.currentNodeId ?? null, nodes),
    [conversation?.currentNodeId, nodes],
  );
  const generating = nodes.some((node) => node.status === "pending" || node.status === "streaming");

  useEffect(() => {
    let current = true;
    setLoading(true);
    if (!activeConversationId) {
      setConversation(null);
      setNodes([]);
      setLoading(false);
      return;
    }
    Promise.all([
      conversationRepo.get(activeConversationId),
      nodeRepo.list(activeConversationId),
    ]).then(([nextConversation, nextNodes]) => {
      if (!current) return;
      if (!nextConversation) {
        setActiveConversationId(null);
        setConversation(null);
        setNodes([]);
      } else {
        setConversation(nextConversation);
        setNodes(nextNodes);
      }
      setLoading(false);
    });
    return () => {
      current = false;
    };
  }, [activeConversationId, setActiveConversationId]);

  useEffect(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  }, [path.length, nodes]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const replaceNode = useCallback((next: ConversationNode) => {
    setNodes((current) => current.map((item) => (item.id === next.id ? next : item)));
  }, []);

  const generate = useCallback(
    async (initialNode: ConversationNode) => {
      if (!activeProvider) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      let node: ConversationNode = {
        ...initialNode,
        assistant: { rawText: "", sections: [] },
        status: "streaming",
        error: undefined,
      };
      replaceNode(node);
      await nodeRepo.put(node);

      try {
        const allNodes = await nodeRepo.list(node.conversationId);
        const currentPath = buildPath(node.id, allNodes.map((item) => (item.id === node.id ? node : item)));
        const adapter = getProviderAdapter(activeProvider.protocol);
        let rawText = "";
        for await (const event of adapter.stream(activeProvider, {
          systemPrompt: buildSystemPrompt(preferences),
          messages: buildContext(currentPath),
          model: activeProvider.model,
          signal: controller.signal,
        })) {
          if (event.type !== "text-delta") continue;
          rawText += event.text;
          node = { ...node, assistant: { rawText, sections: [] } };
          replaceNode(node);
        }
        const parsed = parseStructuredAnswer(rawText);
        node = {
          ...node,
          assistant: parsed ?? fallbackAnswer(rawText),
          status: "done",
          error: parsed ? undefined : "Response format could not be parsed; showing the original response.",
        };
        replaceNode(node);
        await nodeRepo.put(node);
      } catch (error) {
        const mapped = mapFetchError(error);
        const aborted = mapped instanceof AppError && mapped.code === "ABORTED";
        node = {
          ...node,
          status: aborted ? "aborted" : "error",
          error: mapped.message,
        };
        replaceNode(node);
        await nodeRepo.put(node);
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        refreshData();
      }
    },
    [activeProvider, preferences, refreshData, replaceNode],
  );

  const send = async () => {
    const message = draft.trim();
    if (!message || generating) return;
    if (!activeProvider) {
      if (window.confirm("Configure a provider before sending a message. Open Settings?")) navigate("/settings");
      return;
    }

    const now = Date.now();
    const conversationId = conversation?.id ?? createId("conversation");
    const nodeId = createId("node");
    const parentNodeId = selectedAnchor?.sourceNodeId ?? conversation?.currentNodeId ?? null;
    const node: ConversationNode = {
      id: nodeId,
      conversationId,
      parentNodeId,
      anchorSectionId: selectedAnchor?.sectionId ?? null,
      userMessage: message,
      assistant: null,
      providerSnapshot: { providerId: activeProvider.id, model: activeProvider.model },
      status: "pending",
      createdAt: now,
    };
    const nextConversation: Conversation = conversation
      ? { ...conversation, currentNodeId: nodeId, updatedAt: now }
      : {
          id: conversationId,
          title: truncateTitle(message),
          rootNodeId: nodeId,
          currentNodeId: nodeId,
          createdAt: now,
          updatedAt: now,
        };
    await nodeRepo.put(node);
    await conversationRepo.put(nextConversation);
    setConversation(nextConversation);
    setNodes((current) => [...current, node]);
    setActiveConversationId(conversationId);
    setDraft("");
    setSelectedAnchor(null);
    refreshData();
    await generate(node);
  };

  const selectTreeNode = async (id: string) => {
    if (!conversation) return;
    const next = { ...conversation, currentNodeId: id, updatedAt: Date.now() };
    await conversationRepo.put(next);
    setConversation(next);
    setSelectedAnchor(null);
    setTreeOpen(false);
    refreshData();
  };

  const retry = async (node: ConversationNode) => {
    if (!activeProvider || generating) return;
    const next = {
      ...node,
      providerSnapshot: { providerId: activeProvider.id, model: activeProvider.model },
      assistant: null,
      status: "pending" as const,
      error: undefined,
    };
    replaceNode(next);
    await nodeRepo.put(next);
    await generate(next);
  };

  const toggleTheme = async () => {
    const currentDark = document.documentElement.dataset.theme === "dark";
    await preferencesRepo.put({ ...preferences, theme: currentDark ? "light" : "dark" });
    refreshData();
  };

  const anchorTitle = (node: ConversationNode) => {
    if (!node.anchorSectionId || !node.parentNodeId) return null;
    const parent = nodes.find((item) => item.id === node.parentNodeId);
    return parent?.assistant?.sections.find((item) => item.id === node.anchorSectionId)?.title ?? null;
  };

  return (
    <section className="chat-page">
      <header className="chat-header">
        <button className="icon-button mobile-menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation">☰</button>
        <div className="chat-heading">
          <div className="eyebrow">Current conversation</div>
          <div className="chat-title">{conversation?.title ?? "New chat"}</div>
        </div>
        <div className="header-actions">
          <button className="text-button" onClick={() => setTreeOpen(true)} disabled={!nodes.length}>Tree</button>
          <button className="icon-button" onClick={() => void toggleTheme()} title="Toggle theme" aria-label="Toggle theme">◐</button>
        </div>
      </header>

      <div className="chat-scroll" ref={scrollRef}>
        <div className="messages">
          {!loading && path.length === 0 && (
            <div className="empty-chat">
              <p>Ask anything</p>
              <span>{activeProvider ? `${activeProvider.name} · ${activeProvider.model}` : "Configure a provider in Settings"}</span>
            </div>
          )}
          {path.length >= 3 && (
            <nav className="breadcrumb" aria-label="Conversation path">
              {path.map((node) => <span key={node.id}>{truncateTitle(node.userMessage, 22)}</span>)}
            </nav>
          )}
          {path.map((node) => {
            const from = anchorTitle(node);
            return (
              <div key={node.id}>
                <article className={`message user-message ${from ? "branch-message" : ""}`}>
                  <div className="message-role">You{from ? ` · from ${from}` : ""}</div>
                  <div className="message-body"><Markdown>{node.userMessage}</Markdown></div>
                </article>
                <AssistantAnswer
                  node={node}
                  selectedAnchor={selectedAnchor}
                  onSelectAnchor={setSelectedAnchor}
                  onRetry={() => void retry(node)}
                />
              </div>
            );
          })}
        </div>
      </div>

      <Composer
        value={draft}
        onChange={setDraft}
        onSend={() => void send()}
        onStop={() => abortRef.current?.abort()}
        selectedAnchor={selectedAnchor}
        onClearAnchor={() => setSelectedAnchor(null)}
        provider={activeProvider}
        generating={generating}
        disabled={loading}
      />
      <TreeDrawer
        open={treeOpen}
        nodes={nodes}
        currentNodeId={conversation?.currentNodeId ?? null}
        pathIds={new Set(path.map((node) => node.id))}
        onClose={() => setTreeOpen(false)}
        onSelect={(id) => void selectTreeNode(id)}
      />
    </section>
  );
}
