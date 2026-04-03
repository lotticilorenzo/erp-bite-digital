import React from "react";
import { 
  Document, 
  Page, 
  Text, 
  View, 
  StyleSheet, 
  Image,
} from "@react-pdf/renderer";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import type { Commessa, Timesheet } from "@/types";

// Register fonts if needed. Standard fonts like Helvetica work out of the box.
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
  logoSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },
  logoImage: {
    height: 40,
    width: "auto",
  },
  companyInfo: {
    borderLeft: "1pt solid #e2e8f0",
    paddingLeft: 15,
    height: 30,
    justifyContent: "center",
  },
  companyName: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1e293b",
  },
  reportDate: {
    fontSize: 8,
    color: "#64748b",
  },
  reportMeta: {
    textAlign: "right",
  },
  reportTitle: {
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
    marginBottom: 4,
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
  infoGrid: {
    flexDirection: "row",
    marginBottom: 10,
  },
  infoCol: {
    flex: 1,
  },
  label: {
    fontSize: 8,
    color: "#64748b",
    marginBottom: 2,
  },
  value: {
    fontSize: 10,
    fontWeight: "bold",
  },
  // Kpi Cards
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
  kpiValue: {
    fontSize: 14,
    fontWeight: "black",
    color: "#1e293b",
  },
  // Margin Bar
  marginBarContainer: {
    marginTop: 10,
    height: 12,
    backgroundColor: "#f1f5f9",
    borderRadius: 6,
    overflow: "hidden",
    flexDirection: "row",
  },
  marginBarFill: {
    height: "100%",
  },
  // Table
  table: {
    display: "flex",
    width: "auto",
    borderStyle: "solid",
    borderWidth: 0,
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
  col1: { width: "40%" },
  col2: { width: "20%", textAlign: "center" },
  col3: { width: "20%", textAlign: "right" },
  col4: { width: "20%", textAlign: "right" },
  
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
  commessa: Commessa;
  timesheets: Timesheet[];
}

const getFullUrl = (url?: string | null) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return window.location.origin + url;
};

const formatEuro = (val: number = 0) => 
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(val);

export const CommessaReportPDF: React.FC<Props> = ({ commessa, timesheets }) => {
  const monthName = commessa.mese_competenza 
    ? format(parseISO(commessa.mese_competenza), "MMMM yyyy", { locale: it }) 
    : "Periodo non specificato";

  const marginColor = (commessa.margine_percentuale || 0) > 30 
    ? "#10b981" 
    : (commessa.margine_percentuale || 0) > 15 
      ? "#f59e0b" 
      : "#ef4444";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoSection}>
            <Image 
              src={getFullUrl('/logo_bite.jpg')!} 
              style={styles.logoImage} 
            />
            <View style={styles.companyInfo}>
              <Text style={styles.companyName}>Bite Digital S.r.l.</Text>
              <Text style={styles.reportDate}>Data Report: {format(new Date(), "dd/MM/yyyy")}</Text>
            </View>
          </View>
          <View style={styles.reportMeta}>
            <Text style={styles.reportTitle}>Report Mensile Commessa</Text>
            <Text style={styles.reportDate}>{monthName.toUpperCase()}</Text>
          </View>
        </View>

        {/* Client Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Anagrafica Committente</Text>
          <View style={styles.infoGrid}>
            <View style={{ width: 40, marginRight: 10 }}>
              {commessa.cliente?.logo_url ? (
                <Image 
                  src={getFullUrl(commessa.cliente.logo_url)!} 
                  style={{ width: 32, height: 32, borderRadius: 4, border: "0.5pt solid #e2e8f0" }} 
                />
              ) : (
                <View style={{ width: 32, height: 32, borderRadius: 4, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 10, color: "#94a3b8", fontWeight: "bold" }}>
                    {commessa.cliente?.ragione_sociale?.charAt(0) || "C"}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.label}>Cliente</Text>
              <Text style={styles.value}>{commessa.cliente?.ragione_sociale || "N/D"}</Text>
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.label}>Mese Competenza</Text>
              <Text style={styles.value}>{monthName.toUpperCase()}</Text>
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.label}>Stato</Text>
              <Text style={styles.value}>{commessa.stato}</Text>
            </View>
          </View>
        </View>

        {/* Economic Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Riepilogo Economico</Text>
          <View style={styles.kpiContainer}>
            <View style={styles.kpiCard}>
              <Text style={styles.label}>Valore Fatturabile</Text>
              <Text style={styles.kpiValue}>{formatEuro(commessa.valore_fatturabile)}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.label}>Costi Totali</Text>
              <Text style={styles.kpiValue}>{formatEuro((commessa.costo_manodopera || 0) + (commessa.costi_diretti || 0))}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={[styles.label, { color: marginColor }]}>Margine Lordo</Text>
              <Text style={[styles.kpiValue, { color: marginColor }]}>
                {formatEuro(commessa.margine_euro)} ({commessa.margine_percentuale}%)
              </Text>
            </View>
          </View>
          
          <View style={styles.marginBarContainer}>
            <View 
              style={[
                styles.marginBarFill, 
                { width: `${Math.min(Math.max((commessa.margine_percentuale || 0), 0), 100)}%`, backgroundColor: marginColor }
              ]} 
            />
          </View>
        </View>

        {/* Projects Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dettaglio Progetti</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, styles.col1, { fontWeight: "bold" }]}>Progetto</Text>
              <Text style={[styles.tableCell, styles.col2, { fontWeight: "bold" }]}>Stato</Text>
              <Text style={[styles.tableCell, styles.col3, { fontWeight: "bold" }]}>Fisso</Text>
              <Text style={[styles.tableCell, styles.col4, { fontWeight: "bold" }]}>Totale</Text>
            </View>
            {commessa.righe_progetto.map((riga, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.col1]}>{riga.id.substring(0, 8)}...</Text>
                <Text style={[styles.tableCell, styles.col2]}>Attivo</Text>
                <Text style={[styles.tableCell, styles.col3]}>{formatEuro(riga.importo_fisso)}</Text>
                <Text style={[styles.tableCell, styles.col4]}>{formatEuro(riga.importo_fisso + riga.importo_variabile)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Timesheet Table */}
        <View style={styles.section} break>
          <Text style={styles.sectionTitle}>Dettaglio Attività (Timesheet)</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, { width: "15%", fontWeight: "bold" }]}>Data</Text>
              <Text style={[styles.tableCell, { width: "20%", fontWeight: "bold" }]}>Risorsa</Text>
              <Text style={[styles.tableCell, { width: "45%", fontWeight: "bold" }]}>Servizio / Task</Text>
              <Text style={[styles.tableCell, { width: "20%", fontWeight: "bold", textAlign: "right" }]}>Durata</Text>
            </View>
            {timesheets.map((ts, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={[styles.tableCell, { width: "15%" }]}>{format(parseISO(ts.data_attivita), "dd/MM/yy")}</Text>
                <Text style={[styles.tableCell, { width: "20%" }]}>{ts.user?.nome} {ts.user?.cognome?.charAt(0)}.</Text>
                <Text style={[styles.tableCell, { width: "45%" }]}>{ts.task_display_name || ts.servizio || "-"}</Text>
                <Text style={[styles.tableCell, { width: "20%", textAlign: "right" }]}>
                  {Math.floor(ts.durata_minuti / 60)}h {ts.durata_minuti % 60}m
                </Text>
              </View>
            ))}
            {timesheets.length === 0 && (
              <View style={styles.tableRow}>
                <Text style={[styles.tableCell, { width: "100%", textAlign: "center", color: "#64748b" }]}>Nessuna attività registrata</Text>
              </View>
            )}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View>
            <Text>Bite Digital S.r.l.</Text>
            <Text>Via dell'Innovazione 12, Milano</Text>
          </View>
          <View style={{ textAlign: "right" }}>
            <Text>Documento generato automaticamente dal sistema ERP</Text>
            <Text render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} di ${totalPages}`} />
          </View>
        </View>
      </Page>
    </Document>
  );
};
