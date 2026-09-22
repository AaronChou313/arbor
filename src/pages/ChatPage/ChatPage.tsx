import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../../app/store";
import { AssistantAnswer } from "../../components/chat/AssistantAnswer";
import { Composer } from "../../components/chat/Composer";
import { Markdown } from "../../components/common/Markdown";
import { TreeDrawer } from "../../components/tree/TreeDrawer";
import { CONTINUATION_INSTRUCTION, recoverInterruptedGeneration, runGenerationLoop } from "../../features/generation/continuation";
import { buildSystemPrompt } from "../../features/generation/systemPrompt";
import { looksLikeLegacyProtocol, parseMarkdownAnswer } from "../../features/structured-answer/parser";
import { canAutomaticallyTitle, requestGeneratedTitle } from "../../features/titles/titleGeneration";
import { useAppData } from "../../hooks/useAppData";
import { buildContext } from "../../lib/context/buildContext";
import { buildPath } from "../../lib/context/buildPath";
import { conversationRepo, nodeRepo, preferencesRepo } from "../../lib/db/repositories";
import { getProviderAdapter } from "../../lib/provider-adapters";
import { AppError, mapFetchError } from "../../lib/provider-adapters/errors";
import { createId, truncateTitle } from "../../lib/utils/id";
import type { Conversation, ConversationNode } from "../../types/domain";
import { useI18n } from "../../i18n";

export function ChatPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
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
  const [continuingNodeId, setContinuingNodeId] = useState<string | null>(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoFollowRef = useRef(true);
  const continuingTimerRef = useRef<number | undefined>(undefined);

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
    ]).then(async ([nextConversation, nextNodes]) => {
      if (!current) return;
      if (!nextConversation) {
        setActiveConversationId(null);
        setConversation(null);
        setNodes([]);
      } else {
        const recoveredNodes = abortRef.current
          ? nextNodes
          : nextNodes.map(recoverInterruptedGeneration);
        const interrupted = recoveredNodes.filter((node, index) => node !== nextNodes[index]);
        if (interrupted.length) await Promise.all(interrupted.map((node) => nodeRepo.put(node)));
        if (!current) return;
        setConversation(nextConversation);
        setNodes(recoveredNodes);
      }
      setLoading(false);
    });
    return () => {
      current = false;
    };
  }, [activeConversationId, setActiveConversationId]);

  const scrollToLatest = useCallback((behavior: ScrollBehavior = "smooth") => {
    autoFollowRef.current = true;
    setShowJumpToLatest(false);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior });
    });
  }, []);

  useEffect(() => {
    if (autoFollowRef.current) scrollToLatest("auto");
  }, [nodes, path.length, scrollToLatest]);

  useEffect(() => {
    autoFollowRef.current = true;
    setShowJumpToLatest(false);
  }, [activeConversationId]);

  useEffect(() => () => {
    abortRef.current?.abort();
    if (continuingTimerRef.current !== undefined) window.clearTimeout(continuingTimerRef.current);
  }, []);

  const replaceNode = useCallback((next: ConversationNode) => {
    setNodes((current) => current.map((item) => (item.id === next.id ? next : item)));
  }, []);

  const generateTitleInBackground = useCallback((
    completedNode: ConversationNode,
    anchorSectionTitle?: string,
  ) => {
    if (!activeProvider || !completedNode.assistant) return;
    const provider = activeProvider;
    const answer = completedNode.assistant;
    void (async () => {
      const storedNode = await nodeRepo.get(completedNode.id);
      const storedConversation = completedNode.parentNodeId === null
        ? await conversationRepo.get(completedNode.conversationId)
        : undefined;
      const shouldNameNode = canAutomaticallyTitle(storedNode?.titleSource);
      const shouldNameConversation = canAutomaticallyTitle(storedConversation?.titleSource);
      if (!shouldNameNode && !shouldNameConversation) return;

      const title = await requestGeneratedTitle(provider, {
        anchorSectionTitle,
        userMessage: completedNode.userMessage,
        answer,
      });
      if (!title) return;

      const latestNode = await nodeRepo.get(completedNode.id);
      if (latestNode && canAutomaticallyTitle(latestNode.titleSource)) {
        const titledNode = { ...latestNode, title, titleSource: "ai" as const };
        await nodeRepo.put(titledNode);
        replaceNode(titledNode);
      }

      if (completedNode.parentNodeId === null) {
        const latestConversation = await conversationRepo.get(completedNode.conversationId);
        if (latestConversation && canAutomaticallyTitle(latestConversation.titleSource)) {
          const titledConversation = {
            ...latestConversation,
            title,
            titleSource: "ai" as const,
            updatedAt: Date.now(),
          };
          await conversationRepo.put(titledConversation);
          setConversation((current) => current?.id === titledConversation.id ? titledConversation : current);
        }
      }
      refreshData();
    })().catch(() => {
      // Naming is intentionally best-effort and must never affect the completed answer.
    });
  }, [activeProvider, refreshData, replaceNode]);

  const generate = useCallback(
    async (initialNode: ConversationNode, append = false) => {
      if (!activeProvider) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const existingRawText = append ? initialNode.assistant?.rawText ?? "" : "";
      let node: ConversationNode = {
        ...initialNode,
        assistant: {
          rawText: existingRawText,
          sections: [],
          fallbackReason: looksLikeLegacyProtocol(existingRawText) ? "protocol" : undefined,
        },
        status: "streaming",
        error: undefined,
        finishReason: undefined,
        providerFinishReason: undefined,
        usage: append ? initialNode.usage : undefined,
      };
      replaceNode(node);
      await nodeRepo.put(node);

      try {
        const allNodes = await nodeRepo.list(node.conversationId);
        const adapter = getProviderAdapter(activeProvider.protocol);
        const clearContinuingState = () => {
          if (continuingTimerRef.current !== undefined) {
            window.clearTimeout(continuingTimerRef.current);
            continuingTimerRef.current = undefined;
          }
          setContinuingNodeId(null);
        };
        const result = await runGenerationLoop({
          initialText: existingRawText,
          initialUsage: append ? initialNode.usage : undefined,
          continueFirstSegment: append,
          signal: controller.signal,
          streamSegment: ({ text, isContinuation, signal }) => {
            const contextNode: ConversationNode = {
              ...node,
              assistant: { rawText: text, sections: [] },
              status: "streaming",
            };
            const currentPath = buildPath(
              node.id,
              allNodes.map((item) => (item.id === node.id ? contextNode : item)),
            );
            const messages = buildContext(currentPath);
            if (isContinuation) messages.push({ role: "user", content: CONTINUATION_INSTRUCTION });
            return adapter.stream(activeProvider, {
              systemPrompt: buildSystemPrompt(preferences),
              messages,
              model: activeProvider.model,
              signal,
            });
          },
          onSegmentStart: ({ isContinuation }) => {
            clearContinuingState();
            if (isContinuation) {
              continuingTimerRef.current = window.setTimeout(() => {
                if (!controller.signal.aborted) setContinuingNodeId(node.id);
              }, 250);
            }
          },
          onFirstToken: clearContinuingState,
          onText: (rawText) => {
            node = {
              ...node,
              assistant: {
                rawText,
                sections: [],
                fallbackReason: looksLikeLegacyProtocol(rawText) ? "protocol" : undefined,
              },
              status: "streaming",
            };
            replaceNode(node);
          },
          onUsage: (usage) => {
            node = { ...node, usage };
            replaceNode(node);
          },
          onSegmentEnd: async ({ text, usage }) => {
            clearContinuingState();
            node = {
              ...node,
              assistant: {
                rawText: text,
                sections: [],
                fallbackReason: looksLikeLegacyProtocol(text) ? "protocol" : undefined,
              },
              usage,
              status: "streaming",
            };
            replaceNode(node);
            await nodeRepo.put(node);
          },
        });
        clearContinuingState();
        const normallyCompleted = result.finishReason === "stop";
        node = {
          ...node,
          assistant: normallyCompleted
            ? parseMarkdownAnswer(result.text)
            : {
                rawText: result.text,
                sections: [],
                fallbackReason: looksLikeLegacyProtocol(result.text) ? "protocol" : undefined,
              },
          status: result.finishReason === "length" ? "truncated" : result.finishReason === "error" ? "error" : "done",
          error: result.finishReason === "error" ? "BAD_RESPONSE" : undefined,
          finishReason: result.finishReason,
          providerFinishReason: result.providerReason,
          usage: result.usage,
        };
        replaceNode(node);
        await nodeRepo.put(node);
        if (normallyCompleted) {
          const parent = allNodes.find((item) => item.id === node.parentNodeId);
          const anchorSectionTitle = node.anchorSectionId
            ? parent?.assistant?.sections.find((section) => section.id === node.anchorSectionId)?.title
            : undefined;
          generateTitleInBackground(node, anchorSectionTitle);
        }
      } catch (error) {
        if (continuingTimerRef.current !== undefined) {
          window.clearTimeout(continuingTimerRef.current);
          continuingTimerRef.current = undefined;
        }
        setContinuingNodeId(null);
        const mapped = mapFetchError(error);
        const aborted = mapped instanceof AppError && mapped.code === "ABORTED";
        node = {
          ...node,
          status: aborted ? "aborted" : "error",
          error: mapped.code,
        };
        replaceNode(node);
        await nodeRepo.put(node);
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        refreshData();
      }
    },
    [activeProvider, generateTitleInBackground, preferences, refreshData, replaceNode],
  );

  const send = async () => {
    const message = draft.trim();
    if (!message || generating) return;
    if (!activeProvider) {
      if (window.confirm(t("configureProviderConfirm"))) navigate("/settings");
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
      anchorQuote: selectedAnchor?.quote ?? null,
      anchorBlockId: selectedAnchor?.blockId ?? null,
      userMessage: message,
      title: truncateTitle(message),
      titleSource: "fallback",
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
          titleSource: "fallback",
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
    autoFollowRef.current = true;
    setShowJumpToLatest(false);
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
    autoFollowRef.current = true;
    setShowJumpToLatest(false);
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
      finishReason: undefined,
      providerFinishReason: undefined,
      usage: undefined,
    };
    replaceNode(next);
    await nodeRepo.put(next);
    autoFollowRef.current = true;
    setShowJumpToLatest(false);
    await generate(next);
  };

  const continueGeneration = async (node: ConversationNode) => {
    if (!activeProvider || generating || node.status !== "truncated") return;
    autoFollowRef.current = true;
    setShowJumpToLatest(false);
    await generate(node, true);
  };

  const renameTreeNode = async (id: string, title: string) => {
    const stored = await nodeRepo.get(id);
    if (!stored) return;
    const next = { ...stored, title, titleSource: "manual" as const };
    await nodeRepo.put(next);
    replaceNode(next);
    refreshData();
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
        <button className="icon-button mobile-menu-button" onClick={() => setSidebarOpen(true)} aria-label={t("openNavigation")}>☰</button>
        <div className="chat-heading">
          <div className="eyebrow">{t("currentConversation")}</div>
          <div className="chat-title">{conversation?.title ?? t("newChat")}</div>
        </div>
        <div className="header-actions">
          <button className="text-button" onClick={() => setTreeOpen(true)} disabled={!nodes.length}>{t("tree")}</button>
          <button className="icon-button" onClick={() => void toggleTheme()} title={t("toggleTheme")} aria-label={t("toggleTheme")}>◐</button>
        </div>
      </header>

      <div
        className="chat-scroll"
        ref={scrollRef}
        onScroll={(event) => {
          const element = event.currentTarget;
          const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 120;
          autoFollowRef.current = nearBottom;
          setShowJumpToLatest(!nearBottom);
        }}
      >
        <div className="messages">
          {!loading && path.length === 0 && (
            <div className="empty-chat">
              <p>{t("askAnything")}</p>
              <span>{activeProvider ? `${activeProvider.name} · ${activeProvider.model}` : t("configureProviderShort")}</span>
            </div>
          )}
          {path.length >= 3 && (
            <nav className="breadcrumb" aria-label={t("conversationPath")}>
              {path.map((node) => <span key={node.id}>{truncateTitle(node.userMessage, 22)}</span>)}
            </nav>
          )}
          {path.map((node) => {
            const from = anchorTitle(node);
            return (
              <div key={node.id}>
                <article className={`message user-message ${from ? "branch-message" : ""}`}>
                  {from && <div className="user-anchor-label">{t("from", { title: from })}</div>}
                  <div className="message-body"><Markdown>{node.userMessage}</Markdown></div>
                </article>
                <AssistantAnswer
                  node={node}
                  selectedAnchor={selectedAnchor}
                  onSelectAnchor={setSelectedAnchor}
                  onRetry={() => void retry(node)}
                  onContinue={() => void continueGeneration(node)}
                  continuing={continuingNodeId === node.id}
                />
              </div>
            );
          })}
        </div>
      </div>

      {showJumpToLatest && (
        <button className="jump-to-latest" onClick={() => scrollToLatest()} aria-label={t("jumpToLatest")}>
          ↓ <span>{t("jumpToLatest")}</span>
        </button>
      )}

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
        onRename={(id, title) => void renameTreeNode(id, title)}
      />
    </section>
  );
}
