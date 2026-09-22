import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAppStore } from "../../app/store";
import { useAppData } from "../../hooks/useAppData";
import { conversationRepo } from "../../lib/db/repositories";
import { useI18n } from "../../i18n";
import arborLogo from "../../../assets/images/Arbor_Title.svg";

type Props = { open: boolean; onClose: () => void };

export function Sidebar({ open, onClose }: Props) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { conversations } = useAppData();
  const activeId = useAppStore((state) => state.activeConversationId);
  const setActiveId = useAppStore((state) => state.setActiveConversationId);
  const refresh = useAppStore((state) => state.refreshData);
  const [menuId, setMenuId] = useState<string | null>(null);
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const today = conversations.filter((item) => item.updatedAt >= todayStart);
  const previous = conversations.filter((item) => item.updatedAt < todayStart);

  const openConversation = (id: string) => {
    setActiveId(id);
    navigate("/");
    onClose();
  };

  const newChat = () => {
    setActiveId(null);
    navigate("/");
    onClose();
    requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>("#composer-input")?.focus());
  };

  const rename = async (id: string, title: string) => {
    const next = window.prompt(t("renameConversation"), title)?.trim();
    if (!next) return;
    const conversation = await conversationRepo.get(id);
    if (conversation) await conversationRepo.put({ ...conversation, title: next, titleSource: "manual", updatedAt: Date.now() });
    setMenuId(null);
    refresh();
  };

  const remove = async (id: string) => {
    if (!window.confirm(t("deleteConversationConfirm"))) return;
    await conversationRepo.delete(id);
    if (activeId === id) setActiveId(null);
    setMenuId(null);
    refresh();
  };

  const group = (label: string, items: typeof conversations) =>
    items.length ? (
      <div className="history-group">
        <div className="history-label">{label}</div>
        {items.map((item) => (
          <div className={`history-row ${activeId === item.id ? "active" : ""}`} key={item.id}>
            <button className="history-item" onClick={() => openConversation(item.id)} title={item.title}>
              {item.title}
            </button>
            <button
              className="history-more"
                aria-label={t("actionsFor", { title: item.title })}
              onClick={() => setMenuId(menuId === item.id ? null : item.id)}
            >
              ···
            </button>
            {menuId === item.id && (
              <div className="history-menu">
                <button onClick={() => void rename(item.id, item.title)}>{t("rename")}</button>
                <button className="danger-text" onClick={() => void remove(item.id)}>{t("delete")}</button>
              </div>
            )}
          </div>
        ))}
      </div>
    ) : null;

  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="brand-row">
        <button className="brand" onClick={newChat}>
          <span className="brand-wordmark-crop"><img className="brand-wordmark" src={arborLogo} alt="Arbor" /></span>
        </button>
        <button className="icon-button mobile-only" onClick={onClose} aria-label={t("closeNavigation")}>×</button>
      </div>
      <button className="new-chat" onClick={newChat}><span aria-hidden>＋</span> {t("newChat")}</button>
      <div className="history-list">
        {group(t("today"), today)}
        {group(t("previous"), previous)}
      </div>
      <NavLink className={({ isActive }) => `settings-entry ${isActive ? "active" : ""}`} to="/settings" onClick={onClose}>
        <span aria-hidden>⚙</span> {t("settings")}
      </NavLink>
    </aside>
  );
}
