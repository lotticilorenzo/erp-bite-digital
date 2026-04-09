import React from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@/lib/react-pdf";
import { format } from "date-fns";
import { ensurePdfArray, resolvePdfAssetSrc, safePdfNumber, safePdfText } from "@/lib/pdf-utils";

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
  col1: { width: "50%" },
  col2: { width: "25%", textAlign: "right" },
  col3: { width: "25%", textAlign: "right" },
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

interface AnalyticsReportData {
  kpis?: {
    revenueYTD?: number;
    marginYTD?: number;
    monthlyHours?: number;
  };
  clientStats?: Array<{ name?: string; delta?: number; revenue?: number }>;
  revenueTrend?: Array<{ month?: string; revenue?: number }>;
}

interface Props {
  data: AnalyticsReportData;
}

const formatEuro = (value = 0) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);

export const AnalyticsReportPDF: React.FC<Props> = ({ data }) => {
  const reportData = data ?? {};
  const kpis = reportData.kpis ?? {};
  const clientStats = ensurePdfArray(reportData.clientStats);
  const revenueTrend = ensurePdfArray(reportData.revenueTrend);
  const logoSrc = resolvePdfAssetSrc("/logo_bite.jpg");

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
            <Text style={styles.reportTitle}>Business Intelligence Report</Text>
            <Text style={styles.reportDate}>ANALISI PERFORMANCE AZIENDALI</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance Principali</Text>
          <View style={styles.kpiContainer}>
            <View style={styles.kpiCard}>
              <Text style={styles.label}>Fatturato</Text>
              <Text style={styles.kpiValue}>{formatEuro(safePdfNumber(kpis.revenueYTD))}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.label}>Margine Medio</Text>
              <Text style={styles.kpiValue}>{safePdfNumber(kpis.marginYTD).toFixed(1)}%</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.label}>Ore Lavorate</Text>
              <Text style={styles.kpiValue}>{Math.round(safePdfNumber(kpis.monthlyHours))}h</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Clienti per Fatturato</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, styles.col1, { fontWeight: "bold" }]}>Cliente</Text>
              <Text style={[styles.tableCell, styles.col2, { fontWeight: "bold" }]}>Delta %</Text>
              <Text style={[styles.tableCell, styles.col3, { fontWeight: "bold" }]}>Fatturato</Text>
            </View>
            {clientStats.map((client, index) => {
              const delta = safePdfNumber(client.delta);
              return (
                <View key={index} style={styles.tableRow}>
                  <Text style={[styles.tableCell, styles.col1]}>{safePdfText(client.name, "Cliente non disponibile")}</Text>
                  <Text style={[styles.tableCell, styles.col2, { color: delta >= 0 ? "#10b981" : "#ef4444" }]}>
                    {delta >= 0 ? "+" : ""}
                    {delta.toFixed(1)}%
                  </Text>
                  <Text style={[styles.tableCell, styles.col3]}>{formatEuro(safePdfNumber(client.revenue))}</Text>
                </View>
              );
            })}
            {clientStats.length === 0 ? (
              <View style={styles.tableRow}>
                <Text style={[styles.tableCell, { width: "100%", textAlign: "center", color: "#64748b" }]}>
                  Nessun cliente disponibile nel periodo
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Andamento Fatturato</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, { width: "50%", fontWeight: "bold" }]}>Mese</Text>
              <Text style={[styles.tableCell, { width: "50%", fontWeight: "bold", textAlign: "right" }]}>Fatturato</Text>
            </View>
            {revenueTrend.slice(-6).map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={[styles.tableCell, { width: "50%" }]}>{safePdfText(item.month, "Periodo")}</Text>
                <Text style={[styles.tableCell, { width: "50%", textAlign: "right" }]}>
                  {formatEuro(safePdfNumber(item.revenue))}
                </Text>
              </View>
            ))}
            {revenueTrend.length === 0 ? (
              <View style={styles.tableRow}>
                <Text style={[styles.tableCell, { width: "100%", textAlign: "center", color: "#64748b" }]}>
                  Nessun trend disponibile
                </Text>
              </View>
            ) : null}
          </View>
        </View>

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
