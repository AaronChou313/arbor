import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "../components/layout/AppLayout";

const ChatPage = lazy(() => import("../pages/ChatPage/ChatPage").then((module) => ({ default: module.ChatPage })));
const SettingsPage = lazy(() => import("../pages/SettingsPage/SettingsPage").then((module) => ({ default: module.SettingsPage })));

export function App() {
  return (
    <Suspense fallback={<div className="route-loading">Loading Arbor…</div>}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<ChatPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
