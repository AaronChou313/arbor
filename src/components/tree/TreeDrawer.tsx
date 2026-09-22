import type { ConversationNode } from "../../types/domain";
import { useI18n } from "../../i18n";

type Props = {
  open: boolean;
  nodes: ConversationNode[];
  currentNodeId: string | null;
  pathIds: Set<string>;
  onClose: () => void;
  onSelect: (id: string) => void;
};

export function TreeDrawer({ open, nodes, currentNodeId, pathIds, onClose, onSelect }: Props) {
  const { t } = useI18n();
  const children = new Map<string | null, ConversationNode[]>();
  [...nodes].sort((a, b) => a.createdAt - b.createdAt).forEach((node) => {
    const list = children.get(node.parentNodeId) ?? [];
    list.push(node);
    children.set(node.parentNodeId, list);
  });

  const renderBranch = (parentId: string | null, depth = 0): React.ReactNode =>
    (children.get(parentId) ?? []).map((node) => (
      <div className="tree-branch" key={node.id}>
        <button
          className={`tree-node ${node.id === currentNodeId ? "current" : ""} ${pathIds.has(node.id) && node.id !== currentNodeId ? "ancestor" : ""}`}
          style={{ paddingLeft: `${12 + depth * 18}px` }}
          onClick={() => onSelect(node.id)}
        >
          <span className="node-dot" /><span>{node.userMessage}</span>
        </button>
        {renderBranch(node.id, depth + 1)}
      </div>
    ));

  return (
    <>
      <aside className={`tree-drawer ${open ? "open" : ""}`} aria-hidden={!open}>
        <div className="tree-header">
          <div><div className="eyebrow">{t("conversation")}</div><strong>{t("knowledgeTree")}</strong></div>
          <button className="icon-button" onClick={onClose} aria-label={t("closeTree")}>×</button>
        </div>
        <div className="tree-content">
          {nodes.length ? renderBranch(null) : <p className="tree-empty">{t("treeEmpty")}</p>}
        </div>
      </aside>
      <button className={`tree-backdrop ${open ? "open" : ""}`} onClick={onClose} aria-label={t("closeTree")} />
    </>
  );
}
