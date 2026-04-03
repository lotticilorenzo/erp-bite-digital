import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import type { StudioState, StudioView, StudioTimer, SpaceSO } from "@/types/studio";
import { useClienti } from "@/hooks/useClienti";
import { useProgetti } from "@/hooks/useProgetti";
import { useActiveTimer, useStartTimer, useStopTimer } from "@/hooks/useTimer";
import type { Cliente, Progetto } from "@/types";

interface StudioContextType {
  nav: StudioState;
  setView: (view: StudioView) => void;
  selectFolder: (id: string | null) => void;
  selectList: (id: string | null, folderId?: string | null) => void;
  selectTask: (id: string | null) => void;
  isLoading: boolean;
  spaces: SpaceSO[];
  currentFolder: Cliente | null;
  currentList: Progetto | null;
  allProgetti: Progetto[];
  getFolderProjects: (folderId: string) => Progetto[];
  folderProjects: Progetto[];
  openNewTask: (folderId?: string | null, listId?: string | null) => void;
  timer: StudioTimer & {
    start: (taskId: string) => void;
    stop: (sessionId: string, note?: string) => void;
    getElapsed: (taskId: string) => number;
  };
}

const StudioContext = createContext<StudioContextType | undefined>(undefined);

const STUDIO_NAV_KEY = "studio_os_nav";

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const { data: clienti = [], isLoading: isLoadingClienti } = useClienti();
  const { data: progetti = [], isLoading: isLoadingProgetti } = useProgetti();

  // Navigation State
  const [nav, setNav] = useState<StudioState>(() => {
    const saved = localStorage.getItem(STUDIO_NAV_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return { view: "home", selectedFolderId: null, selectedListId: null, selectedTaskId: null };
      }
    }
    return { view: "home", selectedFolderId: null, selectedListId: null, selectedTaskId: null };
  });

  useEffect(() => {
    localStorage.setItem(STUDIO_NAV_KEY, JSON.stringify(nav));
  }, [nav]);

  // Timer State (Backend Synced)
  const { data: activeSession } = useActiveTimer();
  const startTimerMutation = useStartTimer();
  const stopTimerMutation = useStopTimer();

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
    setNav((prev) => ({ ...prev, view }));
  }, []);

  const selectFolder = useCallback((id: string | null) => {
    setNav((prev) => ({ 
      ...prev, 
      selectedFolderId: id, 
      selectedListId: null, 
      selectedTaskId: null, 
      view: id ? "dash" : "home" 
    }));
  }, []);

  const selectList = useCallback((id: string | null, folderId?: string | null) => {
    setNav((prev) => ({ 
      ...prev, 
      selectedListId: id, 
      selectedFolderId: folderId ?? prev.selectedFolderId,
      selectedTaskId: null, 
      view: id ? "list" : "dash" 
    }));
  }, []);

  const selectTask = useCallback((id: string | null) => {
    setNav((prev) => ({ ...prev, selectedTaskId: id }));
  }, []);

  const startTimer = useCallback((taskId: string) => {
    startTimerMutation.mutate(taskId);
  }, [startTimerMutation]);

  const stopTimer = useCallback((sessionId: string, note?: string) => {
    stopTimerMutation.mutate({ sessionId, note });
  }, [stopTimerMutation]);

  const getElapsedTime = useCallback((taskId: string) => {
    if (activeSession?.task_id === taskId && activeSession.started_at) {
      const start = new Date(activeSession.started_at).getTime();
      return Date.now() - start;
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

  const value = {
    nav,
    setView,
    selectFolder,
    selectList,
    selectTask,
    openNewTask,
    isLoading: isLoadingClienti || isLoadingProgetti,
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

export function useStudio() {
  const context = useContext(StudioContext);
  if (context === undefined) {
    throw new Error("useStudio must be used within a StudioProvider");
  }
  return context;
}
