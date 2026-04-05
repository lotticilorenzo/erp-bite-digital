import React from "react";
import { 
  Document, 
  Page, 
  Text, 
  View, 
  StyleSheet, 
} from "@react-pdf/renderer";
import { format, parseISO, differenceInWeeks } from "date-fns";
import { it } from "date-fns/locale";
import type { User, Timesheet } from "@/types";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1e293b",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "2pt solid #7c3aed",
    paddingBottom: 20,
    marginBottom: 30,
  },
  userSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },
  userInfo: {
    borderLeft: "1pt solid #e2e8f0",
    paddingLeft: 15,
    height: 30,
    justifyContent: "center",
  },
  userName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1e293b",
  },
  userRole: {
    fontSize: 8,
    color: "#64748b",
    textTransform: "uppercase",
    fontWeight: "bold",
  },
  reportMeta: {
    textAlign: "right",
  },
  reportTitle: {
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
    color: "#7c3aed",
    marginBottom: 4,
  },
  reportPeriod: {
    fontSize: 9,
    color: "#64748b",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#7c3aed",
    textTransform: "uppercase",
    marginBottom: 8,
    borderBottom: "0.5pt solid #e2e8f0",
    paddingBottom: 4,
  },
  kpiContainer: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  kpiCard: {
    flex: 1,
    padding: 10,
    borderRadius: 4,
    backgroundColor: "#f8fafc",
    border: "0.5pt solid #e2e8f0",
  },
  kpiLabel: {
    fontSize: 7,
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  kpiValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1e293b",
  },
  table: {
    display: "flex",
    width: "auto",
    marginTop: 10,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomColor: "#f1f5f9",
    borderBottomWidth: 0.5,
    alignItems: "center",
    minHeight: 24,
  },
  tableHeader: {
    backgroundColor: "#f8fafc",
    borderBottomColor: "#7c3aed",
    borderBottomWidth: 1,
  },
  tableCell: {
    padding: 4,
    fontSize: 8,
  },
  col1: { width: "20%" },
  col2: { width: "20%", textAlign: "center" },
  col3: { width: "20%", textAlign: "center" },
  col4: { width: "20%", textAlign: "center" },
  col5: { width: "20%", textAlign: "right" },
  
  footer: {
    position: "absolute",
    bottom: 40,
    left: 40,
    right: 40,
    borderTop: "0.5pt solid #e2e8f0",
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    color: "#94a3b8",
    fontSize: 7,
  },
});

interface Props {
  user: User;
  timesheets: Timesheet[];
  periodo: string;
  startDate: Date;
  endDate: Date;
}

export const UserPerformancePDF: React.FC<Props> = ({ user, timesheets, periodo, startDate, endDate }) => {
  const totalMinutes = timesheets.reduce((acc, ts) => acc + (ts.durata_minuti || 0), 0);
  const totalHours = totalMinutes / 60;
  
  // Calcolo ore previste (settimanali * settimane nel periodo)
  const weeks = Math.max(1, differenceInWeeks(endDate, startDate) || 4);
  const expectedHours = (user.ore_settimanali || 40) * weeks;
  const utilization = expectedHours > 0 ? (totalHours / expectedHours) * 100 : 0;
  
  const uniqueTasks = new Set(timesheets.map(ts => ts.task_id).filter(Boolean)).size;
  const uniqueClients = new Set(timesheets.map(ts => ts.commessa?.cliente?.id).filter(Boolean)).size;

  // Raggruppamento per mese per la tabella
  const monthStats = timesheets.reduce((acc: any, ts) => {
    const month = format(parseISO(ts.data_attivita), "yyyy-MM");
    if (!acc[month]) acc[month] = { hours: 0, tasks: new Set(), clients: new Set() };
    acc[month].hours += (ts.durata_minuti || 0) / 60;
    if (ts.task_id) acc[month].tasks.add(ts.task_id);
    if (ts.commessa?.cliente?.id) acc[month].clients.add(ts.commessa.cliente.id);
    return acc;
  }, {});

  // Breakdown per cliente
  const clientBreakdown = timesheets.reduce((acc: any, ts) => {
    const clientName = ts.commessa?.cliente?.ragione_sociale || "Interno / Altro";
    acc[clientName] = (acc[clientName] || 0) + (ts.durata_minuti || 0) / 60;
    return acc;
  }, {});
  
  const topClients = Object.entries(clientBreakdown)
    .sort(([, a]: any, [, b]: any) => b - a)
    .slice(0, 5);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.userSection}>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user.nome} {user.cognome}</Text>
              <Text style={styles.userRole}>{user.ruolo}</Text>
            </View>
          </View>
          <View style={styles.reportMeta}>
            <Text style={styles.reportTitle}>Performance Report</Text>
            <Text style={styles.reportPeriod}>{periodo}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Indicatori Chiave (KPI)</Text>
          <View style={styles.kpiContainer}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Ore Totali</Text>
              <Text style={styles.kpiValue}>{totalHours.toFixed(1)}h</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Utilizzo (%)</Text>
              <Text style={styles.kpiValue}>{utilization.toFixed(1)}%</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Task Gestiti</Text>
              <Text style={styles.kpiValue}>{uniqueTasks}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Clienti Seguiti</Text>
              <Text style={styles.kpiValue}>{uniqueClients}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Andamento Mensile</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, styles.col1, { fontWeight: "bold" }]}>Mese</Text>
              <Text style={[styles.tableCell, styles.col2, { fontWeight: "bold" }]}>Ore</Text>
              <Text style={[styles.tableCell, styles.col3, { fontWeight: "bold" }]}>Task</Text>
              <Text style={[styles.tableCell, styles.col4, { fontWeight: "bold" }]}>Clienti</Text>
              <Text style={[styles.tableCell, styles.col5, { fontWeight: "bold" }]}>Stato</Text>
            </View>
            {Object.entries(monthStats).sort().map(([month, stat]: any) => (
              <View key={month} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.col1]}>{format(parseISO(`${month}-01`), "MMMM yyyy", { locale: it }).toUpperCase()}</Text>
                <Text style={[styles.tableCell, styles.col2]}>{stat.hours.toFixed(1)}h</Text>
                <Text style={[styles.tableCell, styles.col3]}>{stat.tasks.size}</Text>
                <Text style={[styles.tableCell, styles.col4]}>{stat.clients.size}</Text>
                <Text style={[styles.tableCell, styles.col5, { color: "#10b981", fontWeight: "bold" }]}>COMPLETATO</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Breakdown Ore per Cliente (Top 5)</Text>
          <View style={styles.table}>
             {topClients.map(([name, hours]: any, i) => (
               <View key={i} style={styles.tableRow}>
                 <Text style={[styles.tableCell, { width: "70%" }]}>{name}</Text>
                 <Text style={[styles.tableCell, { width: "30%", textAlign: "right", fontWeight: "bold" }]}>{hours.toFixed(1)}h</Text>
               </View>
             ))}
          </View>
        </View>

        <View style={styles.footer}>
          <Text>Bite Digital S.r.l. - HR Performance Review</Text>
          <Text render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} di ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};
