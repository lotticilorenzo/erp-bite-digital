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
import type { Commessa, Cliente } from "@/types";

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
    height: 35,
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
  },
  reportDate: {
    fontSize: 8,
    color: "#64748b",
  },
  reportMeta: {
    textAlign: "right",
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: "bold",
    textTransform: "uppercase",
    color: "#7c3aed",
    marginBottom: 4,
  },
  reportPeriod: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#475569",
    textTransform: "uppercase",
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#7c3aed",
    textTransform: "uppercase",
    marginBottom: 10,
    borderBottom: "0.5pt solid #e2e8f0",
    paddingBottom: 4,
  },
  kpiContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  kpiCard: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
    backgroundColor: "#f8fafc",
    border: "1pt solid #e2e8f0",
  },
  kpiLabel: {
    fontSize: 8,
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 4,
    fontWeight: "bold",
  },
  kpiValue: {
    fontSize: 16,
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
    minHeight: 28,
  },
  tableHeader: {
    backgroundColor: "#f8fafc",
    borderBottomColor: "#7c3aed",
    borderBottomWidth: 1.5,
  },
  tableCell: {
    padding: 6,
    fontSize: 9,
  },
  colMese: { width: "25%" },
  colProgetti: { width: "20%" },
  colOre: { width: "15%", textAlign: "center" },
  colValore: { width: "20%", textAlign: "right" },
  colMargine: { width: "20%", textAlign: "right" },
  
  trendBar: {
    height: 8,
    backgroundColor: "#f1f5f9",
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 4,
  },
  trendFill: {
    height: "100%",
  },
  
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTop: "0.5pt solid #e2e8f0",
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    color: "#94a3b8",
    fontSize: 8,
  },
});

interface Props {
  cliente: Cliente;
  commesse: Commessa[];
  periodo: string;
}

const formatEuro = (val: number = 0) => 
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(val);

export const ClienteReportPDF: React.FC<Props> = ({ cliente, commesse, periodo }) => {
  const totals = commesse.reduce((acc, c) => ({
    fatturato: acc.fatturato + (c.valore_fatturabile || 0),
    costi: acc.costi + (c.costo_manodopera || 0) + (c.costi_diretti || 0),
    ore: acc.ore + (c.ore_reali || 0),
  }), { fatturato: 0, costi: 0, ore: 0 });

  const margineMedio = totals.fatturato > 0 
    ? ((totals.fatturato - totals.costi) / totals.fatturato * 100).toFixed(1)
    : "0";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoSection}>
            <View style={styles.companyInfo}>
              <Text style={styles.companyName}>Bite Digital S.r.l.</Text>
              <Text style={styles.reportDate}>Report Consolidato Partner</Text>
            </View>
          </View>
          <View style={styles.reportMeta}>
            <Text style={styles.reportTitle}>Consolidato Cliente</Text>
            <Text style={styles.reportPeriod}>{periodo}</Text>
          </View>
        </View>

        {/* Informazioni Cliente */}
        <View style={styles.section}>
          <View style={{ flexDirection: "row", gap: 20, alignItems: "center", backgroundColor: "#f8fafc", padding: 15, borderRadius: 8, border: "1pt solid #e2e8f0" }}>
            <View style={styles.companyInfo}>
              <Text style={styles.kpiLabel}>Partner</Text>
              <Text style={{ fontSize: 13, fontWeight: "bold" }}>{cliente.ragione_sociale}</Text>
            </View>
            <View style={styles.companyInfo}>
              <Text style={styles.kpiLabel}>Periodo Analisi</Text>
              <Text style={{ fontSize: 11, fontWeight: "bold" }}>{periodo}</Text>
            </View>
          </View>
        </View>

        {/* Riepilogo Economico Totale */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance Economiche Complessive</Text>
          <View style={styles.kpiContainer}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Fatturato Lordo</Text>
              <Text style={styles.kpiValue}>{formatEuro(totals.fatturato)}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Costo Manodopera</Text>
              <Text style={styles.kpiValue}>{formatEuro(totals.costi)}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={[styles.kpiLabel, { color: "#7c3aed" }]}>Margine Medio</Text>
              <Text style={[styles.kpiValue, { color: "#7c3aed" }]}>
                {margineMedio}%
              </Text>
            </View>
          </View>
        </View>

        {/* Tabella Commesse Incluse */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dettaglio Mensilità / Progetti</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, styles.colMese, { fontWeight: "bold" }]}>Mese</Text>
              <Text style={[styles.tableCell, styles.colProgetti, { fontWeight: "bold" }]}>Progetti</Text>
              <Text style={[styles.tableCell, styles.colOre, { fontWeight: "bold" }]}>Ore</Text>
              <Text style={[styles.tableCell, styles.colValore, { fontWeight: "bold" }]}>Valore</Text>
              <Text style={[styles.tableCell, styles.colMargine, { fontWeight: "bold" }]}>Margine %</Text>
            </View>
            {commesse.sort((a,b) => a.mese_competenza.localeCompare(b.mese_competenza)).map((c, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.colMese]}>
                  {format(parseISO(c.mese_competenza), "MMMM yyyy", { locale: it }).toUpperCase()}
                </Text>
                <Text style={[styles.tableCell, styles.colProgetti]}>
                  {c.righe_progetto.length} Progetti
                </Text>
                <Text style={[styles.tableCell, styles.colOre]}>
                  {Math.round(c.ore_reali || 0)}h
                </Text>
                <Text style={[styles.tableCell, styles.colValore]}>
                  {formatEuro(c.valore_fatturabile)}
                </Text>
                <View style={[styles.tableCell, styles.colMargine]}>
                  <Text style={{ fontWeight: "bold", color: (c.margine_percentuale || 0) > 20 ? "#10b981" : "#ef4444" }}>
                    {c.margine_percentuale}%
                  </Text>
                  <View style={styles.trendBar}>
                    <View 
                      style={[
                        styles.trendFill, 
                        { 
                          width: `${Math.min(100, Math.max(0, c.margine_percentuale || 0))}%`, 
                          backgroundColor: (c.margine_percentuale || 0) > 20 ? "#10b981" : "#ef4444" 
                        }
                      ]} 
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Totali Finali */}
        <View style={{ marginTop: 20, padding: 15, borderTop: "2pt solid #7c3aed", backgroundColor: "#f8fafc" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }}>
            <Text style={{ fontSize: 10, fontWeight: "bold" }}>TOTALE ORE INVESTITE</Text>
            <Text style={{ fontSize: 12, fontWeight: "bold" }}>{totals.ore} Ore</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 10, fontWeight: "bold" }}>REDDITIVITÀ ORARIA MEDIA</Text>
            <Text style={{ fontSize: 12, fontWeight: "bold", color: "#7c3aed" }}>
              {formatEuro(totals.ore > 0 ? totals.fatturato / totals.ore : 0)} / h
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Bite Digital S.r.l. - Documento ad uso interno</Text>
          <Text render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} di ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};
