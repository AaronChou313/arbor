import { useEffect, useState } from "react";
import { conversationRepo, preferencesRepo, providerRepo } from "../lib/db/repositories";
import type { Conversation, Preferences, ProviderConfig } from "../types/domain";
import { DEFAULT_PREFERENCES } from "../types/domain";
import { useAppStore } from "../app/store";

export function useAppData() {
  const revision = useAppStore((state) => state.dataRevision);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let current = true;
    Promise.all([conversationRepo.list(), providerRepo.list(), preferencesRepo.get()]).then(
      ([nextConversations, nextProviders, nextPreferences]) => {
        if (!current) return;
        setConversations(nextConversations);
        setProviders(nextProviders);
        setPreferences(nextPreferences);
        setLoading(false);
      },
    );
    return () => {
      current = false;
    };
  }, [revision]);

  return { conversations, providers, preferences, loading };
}
