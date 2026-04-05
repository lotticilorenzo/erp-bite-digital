import React from "react";
import { 
  Document, 
  Page, 
  Text, 
  View, 
  StyleSheet, 
} from "@react-pdf/renderer";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import type { Timesheet } from "@/types";

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: "Helvetica",
    fontSize: 8,
    color: "#1e293b",
  },
  header: {
    borderBottom: "1pt solid #7c3aed",
    paddingBottom: 10,
    marginBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#7c3aed",
    textTransform: "uppercase",
  },
  subtitle: {
    fontSize: 8,
    color: "#64748b",
    marginTop: 2,
  },
  filterInfo: {
    fontSize: 7,
    color: "#94a3b8",
    textAlign: "right",
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
    minHeight: 20,
  },
  tableHeader: {
    backgroundColor: "#f8fafc",
    borderBottomColor: "#7c3aed",
    borderBottomWidth: 1,
  },
  tableCell: {
    padding: 3,
  },
  colData: { width: "10%" },
  colUtente: { width: "15%" },
  colCliente: { width: "20%" },
  colServizio: { width: "40%" },
  colOre: { width: "15%", textAlign: "right" },
  
  summary: {
    marginTop: 20,
    padding: 10,
    backgroundColor: "#f8fafc",
    borderTop: "1pt solid #7c3aed",
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 20,
  },
  summaryLabel: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#64748b",
  },
  summaryValue: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#1e293b",
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    borderTop: "0.5pt solid #e2e8f0",
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    color: "#94a3b8",
    fontSize: 6,
  },
});

interface Props {
  timesheets: Timesheet[];
  filters: {
    mese?: string;
    user_id?: string;
    commessa_id?: string;
    stato?: string;
  };
  userName?: string;
}

const formatEuro = (val: number = 0) => 
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(val);

export const TimesheetExportPDF: React.FC<Props> = ({ timesheets, filters, userName }) => {
  const totalMinutes = timesheets.reduce((acc, ts) => acc + (ts.durata_minuti || 0), 0);
  const totalHours = totalMinutes / 60;
  const totalCost = timesheets.reduce((acc, ts) => acc + (ts.costo_lavoro || 0), 0);

  const periodoStr = filters.mese 
    ? format(parseISO(filters.mese), "MMMM yyyy", { locale: it }).toUpperCase()
    : "Periodo Personalizzato";

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Export Registro Ore</Text>
            <Text style={styles.subtitle}>Bite Digital S.r.l. - {periodoStr}</Text>
          </View>
          <View style={styles.filterInfo}>
            <Text>Risorsa: {userName || "Tutte"}</Text>
            <Text>Data Export: {format(new Date(), "dd/MM/yyyy HH:mm")}</Text>
            <Text>Stato: {filters.stato || "Tutti"}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableCell, styles.colData, { fontWeight: "bold" }]}>Data</Text>
            <Text style={[styles.tableCell, styles.colUtente, { fontWeight: "bold" }]}>Utente</Text>
            <Text style={[styles.tableCell, styles.colCliente, { fontWeight: "bold" }]}>Cliente / Commessa</Text>
            <Text style={[styles.tableCell, styles.colServizio, { fontWeight: "bold" }]}>Servizio / Attività</Text>
            <Text style={[styles.tableCell, styles.colOre, { fontWeight: "bold" }]}>Durata</Text>
          </View>
          {timesheets.map((ts, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.colData]}>{format(parseISO(ts.data_attivita), "dd/MM/yy")}</Text>
              <Text style={[styles.tableCell, styles.colUtente]}>{ts.user?.nome} {ts.user?.cognome?.charAt(0)}.</Text>
              <Text style={[styles.tableCell, styles.colCliente]}>{ts.commessa?.cliente?.ragione_sociale || "Interno"}</Text>
              <Text style={[styles.tableCell, styles.colServizio]}>{ts.task_display_name || ts.servizio || "-"}</Text>
              <Text style={[styles.tableCell, styles.colOre]}>
                {Math.floor(ts.durata_minuti / 60)}h {ts.durata_minuti % 60}m
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.summary}>
          <View>
            <Text style={styles.summaryLabel}>TOTALE ORE</Text>
            <Text style={styles.summaryValue}>{totalHours.toFixed(1)} h</Text>
          </View>
          <View>
            <Text style={styles.summaryLabel}>COSTO TOTALE LAVORO</Text>
            <Text style={[styles.summaryValue, { color: "#7c3aed" }]}>{formatEuro(totalCost)}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text>Export generato automaticamente da Bite ERP</Text>
          <Text render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} di ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};
