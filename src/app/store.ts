import { create } from "zustand";

export type SelectedAnchor = {
  sourceNodeId: string;
  sectionId: string;
  title: string;
};

type AppState = {
  activeConversationId: string | null;
  selectedAnchor: SelectedAnchor | null;
  treeOpen: boolean;
  sidebarOpen: boolean;
  dataRevision: number;
  setActiveConversationId: (id: string | null) => void;
  setSelectedAnchor: (anchor: SelectedAnchor | null) => void;
  setTreeOpen: (open: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  refreshData: () => void;
};

export const useAppStore = create<AppState>((set) => ({
  activeConversationId: sessionStorage.getItem("arbor.active-conversation"),
  selectedAnchor: null,
  treeOpen: false,
  sidebarOpen: false,
  dataRevision: 0,
  setActiveConversationId: (activeConversationId) => {
    if (activeConversationId) sessionStorage.setItem("arbor.active-conversation", activeConversationId);
    else sessionStorage.removeItem("arbor.active-conversation");
    set({ activeConversationId, selectedAnchor: null });
  },
  setSelectedAnchor: (selectedAnchor) => set({ selectedAnchor }),
  setTreeOpen: (treeOpen) => set({ treeOpen }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  refreshData: () => set((state) => ({ dataRevision: state.dataRevision + 1 })),
}));
