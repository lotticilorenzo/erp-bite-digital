import React from "react";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@/lib/react-pdf";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { ensurePdfArray, resolvePdfAssetSrc, safePdfNumber, safePdfText } from "@/lib/pdf-utils";
import type { Commessa, Timesheet } from "@/types";

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
    borderBottomWidth: 2,
    borderBottomStyle: "solid",
    borderBottomColor: "#7c3aed",
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
    width: 120,
    objectFit: "contain",
  },
  companyInfo: {
    borderLeftWidth: 1,
    borderLeftStyle: "solid",
    borderLeftColor: "#e2e8f0",
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
    borderBottomWidth: 0.5,
    borderBottomStyle: "solid",
    borderBottomColor: "#e2e8f0",
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
    borderTopWidth: 0.5,
    borderTopStyle: "solid",
    borderTopColor: "#e2e8f0",
    borderRightWidth: 0.5,
    borderRightStyle: "solid",
    borderRightColor: "#e2e8f0",
    borderBottomWidth: 0.5,
    borderBottomStyle: "solid",
    borderBottomColor: "#e2e8f0",
    borderLeftWidth: 0.5,
    borderLeftStyle: "solid",
    borderLeftColor: "#e2e8f0",
  },
  kpiValue: {
    fontSize: 14,
    fontWeight: "black",
    color: "#1e293b",
  },
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
  table: {
    display: "flex",
    width: "auto",
    marginTop: 10,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomColor: "#f1f5f9",
    borderBottomWidth: 0.5,
    borderBottomStyle: "solid",
    alignItems: "center",
    minHeight: 24,
  },
  tableHeader: {
    backgroundColor: "#f8fafc",
    borderBottomColor: "#7c3aed",
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
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
    borderTopWidth: 0.5,
    borderTopStyle: "solid",
    borderTopColor: "#e2e8f0",
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

const formatEuro = (value = 0) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);

export const CommessaReportPDF: React.FC<Props> = ({ commessa, timesheets }) => {
  const righeProgetto = ensurePdfArray(commessa?.righe_progetto);
  const timesheetRows = ensurePdfArray(timesheets);
  const logoSrc = resolvePdfAssetSrc("/logo_bite.jpg");
  const clienteLogoSrc = resolvePdfAssetSrc(commessa?.cliente?.logo_url);
  const monthName = commessa?.mese_competenza
    ? format(parseISO(commessa.mese_competenza), "MMMM yyyy", { locale: it })
    : "Periodo non specificato";
  const marginPercent = safePdfNumber(commessa?.margine_percentuale);
  const marginColor =
    marginPercent > 30 ? "#10b981" : marginPercent > 15 ? "#f59e0b" : "#ef4444";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.logoSection}>
            {logoSrc ? <Image src={logoSrc} style={styles.logoImage} /> : null}
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Anagrafica Committente</Text>
          <View style={styles.infoGrid}>
            <View style={{ width: 40, marginRight: 10 }}>
              {clienteLogoSrc ? (
                <Image
                  src={clienteLogoSrc}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 4,
                    borderTopWidth: 0.5,
                    borderTopStyle: "solid",
                    borderTopColor: "#e2e8f0",
                    borderRightWidth: 0.5,
                    borderRightStyle: "solid",
                    borderRightColor: "#e2e8f0",
                    borderBottomWidth: 0.5,
                    borderBottomStyle: "solid",
                    borderBottomColor: "#e2e8f0",
                    borderLeftWidth: 0.5,
                    borderLeftStyle: "solid",
                    borderLeftColor: "#e2e8f0",
                  }}
                />
              ) : (
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 4,
                    backgroundColor: "#f1f5f9",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 10, color: "#94a3b8", fontWeight: "bold" }}>
                    {safePdfText(commessa?.cliente?.ragione_sociale, "C").charAt(0)}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.label}>Cliente</Text>
              <Text style={styles.value}>{safePdfText(commessa?.cliente?.ragione_sociale, "N/D")}</Text>
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.label}>Mese Competenza</Text>
              <Text style={styles.value}>{monthName.toUpperCase()}</Text>
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.label}>Stato</Text>
              <Text style={styles.value}>{safePdfText(commessa?.stato, "N/D")}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Riepilogo Economico</Text>
          <View style={styles.kpiContainer}>
            <View style={styles.kpiCard}>
              <Text style={styles.label}>Valore Fatturabile</Text>
              <Text style={styles.kpiValue}>{formatEuro(safePdfNumber(commessa?.valore_fatturabile))}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.label}>Costi Totali</Text>
              <Text style={styles.kpiValue}>
                {formatEuro(safePdfNumber(commessa?.costo_manodopera) + safePdfNumber(commessa?.costi_diretti))}
              </Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={[styles.label, { color: marginColor }]}>Margine Lordo</Text>
              <Text style={[styles.kpiValue, { color: marginColor }]}>
                {formatEuro(safePdfNumber(commessa?.margine_euro))} ({marginPercent.toFixed(1)}%)
              </Text>
            </View>
          </View>

          <View style={styles.marginBarContainer}>
            <View
              style={[
                styles.marginBarFill,
                { width: `${Math.min(Math.max(marginPercent, 0), 100)}%`, backgroundColor: marginColor },
              ]}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dettaglio Progetti</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, styles.col1, { fontWeight: "bold" }]}>Progetto</Text>
              <Text style={[styles.tableCell, styles.col2, { fontWeight: "bold" }]}>Stato</Text>
              <Text style={[styles.tableCell, styles.col3, { fontWeight: "bold" }]}>Fisso</Text>
              <Text style={[styles.tableCell, styles.col4, { fontWeight: "bold" }]}>Totale</Text>
            </View>
            {righeProgetto.map((riga, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.col1]}>
                  {safePdfText(riga.progetto?.nome, `${safePdfText(riga.id, "Riga")}`.slice(0, 8))}
                </Text>
                <Text style={[styles.tableCell, styles.col2]}>Attivo</Text>
                <Text style={[styles.tableCell, styles.col3]}>{formatEuro(safePdfNumber(riga.importo_fisso))}</Text>
                <Text style={[styles.tableCell, styles.col4]}>
                  {formatEuro(safePdfNumber(riga.importo_fisso) + safePdfNumber(riga.importo_variabile))}
                </Text>
              </View>
            ))}
            {righeProgetto.length === 0 ? (
              <View style={styles.tableRow}>
                <Text style={[styles.tableCell, { width: "100%", textAlign: "center", color: "#64748b" }]}>
                  Nessun progetto collegato
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.section} break>
          <Text style={styles.sectionTitle}>Dettaglio Attività (Timesheet)</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, { width: "15%", fontWeight: "bold" }]}>Data</Text>
              <Text style={[styles.tableCell, { width: "20%", fontWeight: "bold" }]}>Risorsa</Text>
              <Text style={[styles.tableCell, { width: "45%", fontWeight: "bold" }]}>Servizio / Task</Text>
              <Text style={[styles.tableCell, { width: "20%", fontWeight: "bold", textAlign: "right" }]}>Durata</Text>
            </View>
            {timesheetRows.map((ts, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={[styles.tableCell, { width: "15%" }]}>
                  {ts.data_attivita ? format(parseISO(ts.data_attivita), "dd/MM/yy") : "-"}
                </Text>
                <Text style={[styles.tableCell, { width: "20%" }]}>
                  {safePdfText(ts.user?.nome, "N/D")} {safePdfText(ts.user?.cognome, "").charAt(0)}.
                </Text>
                <Text style={[styles.tableCell, { width: "45%" }]}>
                  {safePdfText(ts.task_display_name || ts.servizio, "-")}
                </Text>
                <Text style={[styles.tableCell, { width: "20%", textAlign: "right" }]}>
                  {Math.floor(safePdfNumber(ts.durata_minuti) / 60)}h {safePdfNumber(ts.durata_minuti) % 60}m
                </Text>
              </View>
            ))}
            {timesheetRows.length === 0 ? (
              <View style={styles.tableRow}>
                <Text style={[styles.tableCell, { width: "100%", textAlign: "center", color: "#64748b" }]}>
                  Nessuna attività registrata
                </Text>
              </View>
            ) : null}
          </View>
        </View>

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
