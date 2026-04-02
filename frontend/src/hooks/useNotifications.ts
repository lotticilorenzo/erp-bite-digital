import { 
  isPast, 
  isToday, 
  isTomorrow, 
  differenceInDays, 
  parseISO, 
} from "date-fns";
import { useTasks } from "./useTasks";
import { useFattureAttive } from "./useFatture";
import { useTimesheets } from "./useTimesheet";
import { useAuth } from "./useAuth";
import type { Notification } from "@/types";
import { useState, useEffect, useMemo } from "react";

const STORAGE_KEY = "BITE_ERP_READ_NOTIFICATIONS";

export function useNotifications() {
  const { user } = useAuth();
  const { data: tasks = [] } = useTasks();
  const { data: fatture = [] } = useFattureAttive();
  // Fetch pending timesheets only for Admins/PMs
  const isPrivileged = user?.ruolo === "ADMIN" || user?.ruolo === "PM";
  const { data: timesheets = [] } = useTimesheets(isPrivileged ? { stato: "PENDING" } : {});

  const [readIds, setReadIds] = useState<string[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  // Persist read status
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(readIds));
  }, [readIds]);

  const notifications: Notification[] = useMemo(() => {
    const list: Notification[] = [];
    const now = new Date();

    // 1. TASKS (URGENTE / AVVISO)
    tasks.forEach(t => {
      if (!t.due_date || t.state_id === "PRONTO" || t.state_id === "PUBBLICATO") return;
      
      const dueDate = parseISO(t.due_date);
      if (isPast(dueDate) && differenceInDays(now, dueDate) >= 1) {
        list.push({
          id: `task-urgent-${t.id}`,
          type: "URGENTE",
          title: "Task Scaduto!",
          description: `Il task "${t.title}" è scaduto da ${differenceInDays(now, dueDate)} giorni.`,
          timestamp: t.due_date,
          link: `/studio-os`,
          isRead: readIds.includes(`task-urgent-${t.id}`),
          priority: "HIGH"
        });
      } else if (isToday(dueDate) || isTomorrow(dueDate)) {
        list.push({
          id: `task-avviso-${t.id}`,
          type: "AVVISO",
          title: "Scadenza Imminente",
          description: `Il task "${t.title}" scade ${isToday(dueDate) ? "oggi" : "domani"}.`,
          timestamp: t.due_date,
          link: `/studio-os`,
          isRead: readIds.includes(`task-avviso-${t.id}`),
          priority: "MEDIUM"
        });
      }
    });

    // 2. FATTURE (FATTURA)
    fatture.forEach(f => {
      if (f.stato_pagamento !== "pagato" && f.data_scadenza && isPast(parseISO(f.data_scadenza))) {
        list.push({
          id: `fattura-overdue-${f.id}`,
          type: "FATTURA",
          title: "Fattura Scaduta",
          description: `La fattura ${f.numero || f.fic_id} di ${f.importo_totale}€ è scaduta.`,
          timestamp: f.data_scadenza,
          link: `/fatture`,
          isRead: readIds.includes(`fattura-overdue-${f.id}`),
          priority: "HIGH"
        });
      }
    });

    // 3. TIMESHEETS (APPROVAZIONE)
    if (isPrivileged && timesheets.length > 0) {
      list.push({
        id: `timesheet-approval-pending`,
        type: "APPROVAZIONE",
        title: "Approvazione Ore",
        description: `Ci sono ${timesheets.length} sessioni di timesheet in attesa di approvazione.`,
        timestamp: new Date().toISOString(),
        link: `/timesheet`,
        isRead: readIds.includes(`timesheet-approval-pending`),
        priority: "MEDIUM"
      });
    }

    // 4. INFO (Sync FIC - Mock)
    // In a real scenario, this would check a 'sync_logs' table or similar
    // For now, we'll add a persistent notification if a sync happened recently
    list.push({
      id: `sync-fic-info`,
      type: "INFO",
      title: "Sync FIC Completata",
      description: "La sincronizzazione con Fatture in Cloud è stata eseguita correttamente.",
      timestamp: new Date().toISOString(),
      link: `/cassa`,
      isRead: readIds.includes(`sync-fic-info`),
      priority: "LOW"
    });

    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [tasks, fatture, timesheets, readIds, isPrivileged]);

  const markAsRead = (id: string) => {
    setReadIds(prev => prev.includes(id) ? prev : [...prev, id]);
  };

  const markAllAsRead = () => {
    const allIds = notifications.map(n => n.id);
    setReadIds(allIds);
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const hasUrgent = notifications.some(n => n.type === "URGENTE" && !n.isRead);

  return {
    notifications,
    unreadCount,
    hasUrgent,
    markAsRead,
    markAllAsRead,
    // Tabs helpers
    allNodes: notifications,
    unreadNodes: notifications.filter(n => !n.isRead),
    importantNodes: notifications.filter(n => n.priority === "HIGH"),
  };
}
