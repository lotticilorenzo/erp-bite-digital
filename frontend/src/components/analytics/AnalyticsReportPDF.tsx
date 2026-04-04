import React from "react";
import { 
  Document, 
  Page, 
  Text, 
  View, 
  StyleSheet, 
} from "@react-pdf/renderer";
import { format } from "date-fns";

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
  label: {
    fontSize: 8,
    color: "#64748b",
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
  col1: { width: "50%" },
  col2: { width: "25%", textAlign: "right" },
  col3: { width: "25%", textAlign: "right" },
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
  data: any;
}

const formatEuro = (val: number = 0) => 
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(val);

export const AnalyticsReportPDF: React.FC<Props> = ({ data }) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoSection}>
            <View style={styles.companyInfo}>
              <Text style={styles.companyName}>Bite Digital S.r.l.</Text>
              <Text style={styles.reportDate}>Data Report: {format(new Date(), "dd/MM/yyyy")}</Text>
            </View>
          </View>
          <View style={styles.reportMeta}>
            <Text style={styles.reportTitle}>Business Intelligence Report</Text>
            <Text style={styles.reportDate}>ANALISI PERFORMANCE AZIENDALI</Text>
          </View>
        </View>

        {/* KPI Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance Principali (YTD)</Text>
          <View style={styles.kpiContainer}>
            <View style={styles.kpiCard}>
              <Text style={styles.label}>Fatturato Annuale</Text>
              <Text style={styles.kpiValue}>{formatEuro(data.kpis.revenueYTD)}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.label}>Margine Medio</Text>
              <Text style={styles.kpiValue}>{data.kpis.marginYTD.toFixed(1)}%</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.label}>Ore Lavorate (Mese)</Text>
              <Text style={styles.kpiValue}>{Math.round(data.kpis.monthlyHours)}h</Text>
            </View>
          </View>
        </View>

        {/* Top Clients Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top 5 Clienti per Fatturato</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, styles.col1, { fontWeight: "bold" }]}>Cliente</Text>
              <Text style={[styles.tableCell, styles.col2, { fontWeight: "bold" }]}>Delta %</Text>
              <Text style={[styles.tableCell, styles.col3, { fontWeight: "bold" }]}>Fatturato Totale</Text>
            </View>
            {data.clientStats.map((client: any, i: number) => (
              <View key={i} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.col1]}>{client.name}</Text>
                <Text style={[styles.tableCell, styles.col2, { color: client.delta >= 0 ? "#10b981" : "#ef4444" }]}>
                  {client.delta >= 0 ? "+" : ""}{client.delta.toFixed(1)}%
                </Text>
                <Text style={[styles.tableCell, styles.col3]}>{formatEuro(client.revenue)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Revenue Trend Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Andamento Mensile Fatturato</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, { width: "50%", fontWeight: "bold" }]}>Mese</Text>
              <Text style={[styles.tableCell, { width: "50%", fontWeight: "bold", textAlign: "right" }]}>Fatturato</Text>
            </View>
            {data.revenueTrend.slice(-6).map((item: any, i: number) => (
              <View key={i} style={styles.tableRow}>
                <Text style={[styles.tableCell, { width: "50%" }]}>{item.month}</Text>
                <Text style={[styles.tableCell, { width: "50%", textAlign: "right" }]}>{formatEuro(item.revenue)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View>
            <Text>Bite Digital S.r.l. - Report Riservato</Text>
          </View>
          <View style={{ textAlign: "right" }}>
            <Text>Generato il {format(new Date(), "dd/MM/yyyy HH:mm")}</Text>
            <Text render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} di ${totalPages}`} />
          </View>
        </View>
      </Page>
    </Document>
  );
};
