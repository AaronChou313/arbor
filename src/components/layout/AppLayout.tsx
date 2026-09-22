import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { useAppData } from "../../hooks/useAppData";
import { useAppStore } from "../../app/store";
import { I18nProvider, resolveLanguage, useI18n } from "../../i18n";

export function AppLayout() {
  const { preferences } = useAppData();
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);
  const setSidebarOpen = useAppStore((state) => state.setSidebarOpen);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = preferences.theme === "dark" || (preferences.theme === "system" && media.matches);
      root.dataset.theme = dark ? "dark" : "light";
      root.style.colorScheme = dark ? "dark" : "light";
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [preferences.theme]);

  useEffect(() => {
    document.documentElement.lang = resolveLanguage(preferences.language);
  }, [preferences.language]);

  return (
    <I18nProvider language={preferences.language}>
      <div className="app-shell">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="main-content"><Outlet /></main>
        <NavigationBackdrop open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      </div>
    </I18nProvider>
  );
}

function NavigationBackdrop({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  return <button type="button" aria-label={t("closeNavigation")} className={`page-backdrop ${open ? "open" : ""}`} onClick={onClose} />;
}
