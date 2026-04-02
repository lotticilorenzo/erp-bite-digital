import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import type { StudioState, StudioView, StudioTimer, SpaceSO } from "@/types/studio";
import { useClienti } from "@/hooks/useClienti";
import { useProgetti } from "@/hooks/useProgetti";
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
    pause: (taskId: string) => void;
    getElapsed: (taskId: string) => number;
  };
}

const StudioContext = createContext<StudioContextType | undefined>(undefined);

const STUDIO_NAV_KEY = "studio_os_nav";
const STUDIO_TIMER_KEY = "studio_os_timer";

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

  // Timer State
  const [timer, setTimer] = useState<StudioTimer>(() => {
    const saved = localStorage.getItem(STUDIO_TIMER_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return { active_task_id: null, started_at: null, elapsed: {} };
      }
    }
    return { active_task_id: null, started_at: null, elapsed: {} };
  });

  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!timer.active_task_id) return;
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timer.active_task_id]);

  useEffect(() => {
    localStorage.setItem(STUDIO_TIMER_KEY, JSON.stringify(timer));
  }, [timer]);

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
    const now = Date.now();
    setTimer((prev) => {
      let newElapsed = { ...prev.elapsed };
      if (prev.active_task_id && prev.active_task_id !== taskId && prev.started_at) {
        const session = now - prev.started_at;
        newElapsed[prev.active_task_id] = (newElapsed[prev.active_task_id] || 0) + session;
      }
      return {
        active_task_id: taskId,
        started_at: now,
        elapsed: newElapsed,
      };
    });
  }, []);

  const pauseTimer = useCallback((taskId: string) => {
    const now = Date.now();
    setTimer((prev) => {
      if (prev.active_task_id !== taskId || !prev.started_at) return prev;
      const session = now - prev.started_at;
      const newElapsed = { 
        ...prev.elapsed,
        [taskId]: (prev.elapsed[taskId] || 0) + session 
      };
      return {
        active_task_id: null,
        started_at: null,
        elapsed: newElapsed,
      };
    });
  }, []);

  const getElapsedTime = useCallback((taskId: string) => {
    const base = timer.elapsed[taskId] || 0;
    if (timer.active_task_id === taskId && timer.started_at) {
      return base + (Date.now() - timer.started_at);
    }
    return base;
  }, [timer, tick]);

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
      ...timer,
      start: startTimer,
      pause: pauseTimer,
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
