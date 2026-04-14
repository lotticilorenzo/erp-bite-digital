import React, { createContext, useState, useEffect, useCallback, useMemo } from "react";
import type { StudioState, StudioView, StudioTimer, SpaceSO } from "@/types/studio";
import { useClienti } from "@/hooks/useClienti";
import { useProgetti } from "@/hooks/useProgetti";
import { useActiveTimer, useStartTimer, useStopTimer, useSaveTimerToTimesheet } from "@/hooks/useTimer";
import type { Cliente, Progetto } from "@/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { StudioNode, TabItem } from "@/types/studio";
import { toast } from "sonner";

interface StudioContextType {
  nav: StudioState;
  setView: (view: StudioView) => void;
  selectFolder: (id: string | null) => void;
  selectList: (id: string | null, folderId?: string | null) => void;
  selectTask: (id: string | null) => void;
  isLoading: boolean;
  hierarchy: StudioNode[];
  tabs: TabItem[];
  activeTabId: string | null;
  selectTab: (id: string) => void;
  closeTab: (id: string) => void;
  openTab: (item: Omit<TabItem, "id"> & { id?: string }) => void;
  spaces: SpaceSO[];
  currentFolder: Cliente | null;
  currentList: Progetto | null;
  allProgetti: Progetto[];
  getFolderProjects: (folderId: string) => Progetto[];
  folderProjects: Progetto[];
  openNewTask: (folderId?: string | null, listId?: string | null) => void;
  splitTabId: string | null;
  openSplit: (tabId: string) => void;
  closeSplit: () => void;
  timer: StudioTimer & {
    start: (taskId: string) => void;
    stop: (sessionId: string, note?: string) => void;
    getElapsed: (taskId: string) => number;
  };
}

export const StudioContext = createContext<StudioContextType | undefined>(undefined);

const STUDIO_NAV_KEY = "studio_os_nav";

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { data: clienti = [], isLoading: isLoadingClienti } = useClienti();
  const { data: progetti = [], isLoading: isLoadingProgetti } = useProgetti();

  // Navigation State
  const [nav, setNav] = useState<StudioState>(() => {
    const saved = localStorage.getItem(STUDIO_NAV_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          view: parsed.view || "home",
          selectedFolderId: parsed.selectedFolderId || null,
          selectedListId: parsed.selectedListId || null,
          selectedTaskId: parsed.selectedTaskId || null,
          openTabs: parsed.openTabs || [],
          activeTabId: parsed.activeTabId || null,
          splitTabId: null,
        };
      } catch (e) {
        return { view: "home", selectedFolderId: null, selectedListId: null, selectedTaskId: null, openTabs: [], activeTabId: null, splitTabId: null };
      }
    }
    return { view: "home", selectedFolderId: null, selectedListId: null, selectedTaskId: null, openTabs: [], activeTabId: null, splitTabId: null };
  });

  useEffect(() => {
    localStorage.setItem(STUDIO_NAV_KEY, JSON.stringify(nav));
  }, [nav]);

  // Fetch Hierarchy
  const { data: hierarchy = [], isLoading: isLoadingHierarchy } = useQuery<StudioNode[]>({
    queryKey: ["studio-hierarchy"],
    queryFn: async () => {
      const res = await api.get("/studio/hierarchy");
      return res.data;
    }
  });

  // Tab Actions
  const openTab = useCallback((item: Omit<TabItem, "id"> & { id?: string }) => {
    const tabId = item.id || `${item.type}-${item.linkedId}`;
    setNav(prev => {
      const exists = prev.openTabs.find(t => t.id === tabId);
      const newTabs = exists ? prev.openTabs : [...prev.openTabs, { ...item, id: tabId }];
      return {
        ...prev,
        openTabs: newTabs,
        activeTabId: tabId,
        view: item.type === "PROJECT" ? "list" : prev.view,
        selectedListId: item.type === "PROJECT" ? item.linkedId || null : prev.selectedListId,
        selectedTaskId: item.type === "TASK" ? item.linkedId || null : prev.selectedTaskId,
      };
    });
  }, []);

  const closeTab = useCallback((id: string) => {
    setNav(prev => {
      const newTabs = prev.openTabs.filter(t => t.id !== id);
      const newActiveId = prev.activeTabId === id 
        ? (newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null)
        : prev.activeTabId;
      
      return {
        ...prev,
        openTabs: newTabs,
        activeTabId: newActiveId
      };
    });
  }, []);

  const selectTab = useCallback((id: string) => {
    setNav(prev => {
      const tab = prev.openTabs.find(t => t.id === id);
      if (!tab) return prev;
      return {
        ...prev,
        activeTabId: id,
        view: tab.type === "PROJECT" ? "list" : prev.view,
        selectedListId: tab.type === "PROJECT" ? tab.linkedId || null : prev.selectedListId,
        selectedTaskId: tab.type === "TASK" ? tab.linkedId || null : prev.selectedTaskId,
      };
    });
  }, []);

  // Timer State (Backend Synced)
  const { data: activeSession } = useActiveTimer();
  const startTimerMutation = useStartTimer();
  const stopTimerMutation = useStopTimer();
  const saveToTimesheetMutation = useSaveTimerToTimesheet();

  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!activeSession) return;
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  // Actions
  const setView = useCallback((view: StudioView) => {
    setNav((prev) => ({ 
      ...prev, 
      view,
      // Clear selections when returning to non-project views
      selectedFolderId: (view === "home" || view === "chat") ? null : prev.selectedFolderId,
      selectedListId: (view === "home" || view === "chat") ? null : prev.selectedListId,
      selectedTaskId: (view === "home" || view === "chat") ? null : prev.selectedTaskId,
      activeTabId: (view === "home" || view === "chat") ? null : prev.activeTabId
    }));
  }, []);

  const selectFolder = useCallback((id: string | null) => {
    setNav((prev) => ({ 
      ...prev, 
      selectedFolderId: id, 
      selectedListId: null, 
      selectedTaskId: null, 
      view: id ? "overview" : "home" 
    }));
  }, []);

  const selectList = useCallback((id: string | null, folderId?: string | null) => {
    setNav((prev) => ({ 
      ...prev, 
      selectedListId: id, 
      selectedFolderId: folderId ?? prev.selectedFolderId,
      selectedTaskId: null, 
      view: id ? "overview" : "dash" 
    }));
  }, []);

  const selectTask = useCallback((id: string | null) => {
    setNav((prev) => ({ ...prev, selectedTaskId: id }));
  }, []);

  const startTimer = useCallback((taskId: string) => {
    startTimerMutation.mutate(taskId);
  }, [startTimerMutation]);

  const stopTimer = useCallback((sessionId: string, note?: string) => {
    stopTimerMutation.mutate({ sessionId, note }, {
      onSuccess: (stoppedSession) => {
        toast("Timer fermato", {
          description: stoppedSession.durata_minuti
            ? `Sessione di ${stoppedSession.durata_minuti} min registrata`
            : "Sessione registrata",
          action: {
            label: "Salva Timesheet",
            onClick: () => {
              saveToTimesheetMutation.mutate({ session_ids: [stoppedSession.id] });
            },
          },
          duration: 8000,
        });
        queryClient.invalidateQueries({ queryKey: ["timer"] });
      },
    });
  }, [stopTimerMutation, saveToTimesheetMutation, queryClient]);

  const getElapsedTime = useCallback((taskId: string) => {
    if (activeSession?.task_id === taskId && activeSession.started_at) {
      const start = new Date(activeSession.started_at).getTime();
      return Math.max(0, Date.now() - start);
    }
    return 0;
  }, [activeSession, tick]);

  // Hierarchy Data
  const spaces = useMemo<SpaceSO[]>(() => {
    if (!clienti.length) return [];
    const activeClients = clienti.filter(c => c.attivo);
    return [
      {
        id: "main-space",
        name: "Progetti Attivi",
        folders: activeClients
      }
    ];
  }, [clienti]);

  const currentFolder = useMemo(() => 
    clienti.find(c => c.id === nav.selectedFolderId) || null
  , [clienti, nav.selectedFolderId]);

  const currentList = useMemo(() => 
    progetti.find(p => p.id === nav.selectedListId) || null
  , [progetti, nav.selectedListId]);

  const folderProjects = useMemo(() => 
    progetti.filter(p => p.cliente_id === nav.selectedFolderId)
  , [progetti, nav.selectedFolderId]);

  const getFolderProjects = useCallback((folderId: string) => {
    return progetti.filter(p => p.cliente_id === folderId);
  }, [progetti]);

  const openNewTask = useCallback((folderId?: string | null, listId?: string | null) => {
    setNav(prev => ({
      ...prev,
      selectedFolderId: folderId ?? prev.selectedFolderId,
      selectedListId: listId ?? prev.selectedListId,
      selectedTaskId: "new",
      view: listId ? "list" : (folderId ? "dash" : prev.view)
    }));
  }, []);

  const openSplit = useCallback((tabId: string) => {
    setNav(prev => ({ ...prev, splitTabId: tabId }));
  }, []);

  const closeSplit = useCallback(() => {
    setNav(prev => ({ ...prev, splitTabId: null }));
  }, []);

  const value = {
    nav,
    setView,
    selectFolder,
    selectList,
    selectTask,
    openNewTask,
    splitTabId: nav.splitTabId,
    openSplit,
    closeSplit,
    isLoading: isLoadingClienti || isLoadingProgetti || isLoadingHierarchy,
    hierarchy,
    tabs: nav.openTabs,
    activeTabId: nav.activeTabId,
    selectTab,
    closeTab,
    openTab,
    spaces,
    currentFolder,
    currentList,
    allProgetti: progetti,
    getFolderProjects,
    folderProjects,
    timer: {
      active_session: activeSession || null,
      start: startTimer,
      stop: stopTimer,
      getElapsed: getElapsedTime
    }
  };

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

