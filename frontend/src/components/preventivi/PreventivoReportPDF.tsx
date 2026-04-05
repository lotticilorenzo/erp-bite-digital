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
import type { Preventivo } from "@/types/preventivi";

const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1e293b",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 40,
    borderBottom: "1pt solid #e2e8f0",
    paddingBottom: 20,
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#7c3aed",
    marginBottom: 5,
  },
  companyLabels: {
    fontSize: 8,
    color: "#64748b",
    lineHeight: 1.4,
  },
  quoteMeta: {
    textAlign: "right",
  },
  quoteTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 5,
  },
  quoteNumber: {
    fontSize: 12,
    color: "#7c3aed",
    fontWeight: "bold",
  },
  section: {
    marginBottom: 20,
  },
  clientSection: {
    marginBottom: 40,
    padding: 15,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
  },
  label: {
    fontSize: 8,
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 5,
    fontWeight: "bold",
  },
  clientName: {
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
    borderBottomWidth: 1,
    alignItems: "center",
    minHeight: 35,
  },
  tableHeader: {
    backgroundColor: "#7c3aed",
    color: "white",
  },
  tableCell: {
    padding: 8,
  },
  colDesc: { width: "55%" },
  colQty: { width: "10%", textAlign: "center" },
  colPrice: { width: "15%", textAlign: "right" },
  colTotal: { width: "20%", textAlign: "right" },

  summary: {
    marginTop: 30,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  summaryBox: {
    width: "40%",
    borderTop: "2pt solid #7c3aed",
    paddingTop: 10,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1e293b",
  },
  totalValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#7c3aed",
  },
  notes: {
    marginTop: 50,
    padding: 15,
    borderLeft: "2pt solid #7c3aed",
    backgroundColor: "#f8fafc",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 50,
    right: 50,
    textAlign: "center",
    fontSize: 8,
    color: "#94a3b8",
    borderTop: "1pt solid #e2e8f0",
    paddingTop: 10,
  }
});

const formatEuro = (val: number = 0) => 
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(val);

interface Props {
  preventivo: Preventivo;
}

export const PreventivoReportPDF: React.FC<Props> = ({ preventivo }) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.companyInfo}>
            <Text style={styles.companyName}>BITE DIGITAL</Text>
            <Text style={styles.companyLabels}>Bite Digital S.r.l.</Text>
            <Text style={styles.companyLabels}>Via delle Industrie 15, Milano</Text>
            <Text style={styles.companyLabels}>P.IVA 12345678901</Text>
          </View>
          <View style={styles.quoteMeta}>
            <Text style={styles.quoteTitle}>PREVENTIVO</Text>
            <Text style={styles.quoteNumber}>N. {preventivo.numero}</Text>
            <Text style={{ fontSize: 9, color: "#64748b", marginTop: 5 }}>
              Data: {format(parseISO(preventivo.data_creazione), "dd MMMM yyyy", { locale: it })}
            </Text>
            {preventivo.data_scadenza && (
              <Text style={{ fontSize: 8, color: "#ef4444", marginTop: 2 }}>
                Valido fino al: {format(parseISO(preventivo.data_scadenza), "dd/MM/yyyy")}
              </Text>
            )}
          </View>
        </View>

        {/* Cliente */}
        <View style={styles.clientSection}>
          <Text style={styles.label}>Destinatario</Text>
          <Text style={styles.clientName}>{preventivo.cliente?.ragione_sociale || "Cliente n.d."}</Text>
          <Text style={{ fontSize: 9, color: "#64748b", marginTop: 4 }}>
            {preventivo.cliente?.indirizzo} {preventivo.cliente?.comune}
          </Text>
          <Text style={{ fontSize: 9, color: "#64748b" }}>
            P.IVA: {preventivo.cliente?.piva}
          </Text>
        </View>

        {/* Titolo e Oggetto */}
        <View style={styles.section}>
          <Text style={{ fontSize: 14, fontWeight: "bold", marginBottom: 5 }}>{preventivo.titolo}</Text>
          {preventivo.descrizione && (
            <Text style={{ fontSize: 10, color: "#475569", lineHeight: 1.5 }}>{preventivo.descrizione}</Text>
          )}
        </View>

        {/* Tabella Voci */}
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableCell, styles.colDesc, { fontWeight: "bold" }]}>Descrizione Servizio</Text>
            <Text style={[styles.tableCell, styles.colQty, { fontWeight: "bold" }]}>Q.tà</Text>
            <Text style={[styles.tableCell, styles.colPrice, { fontWeight: "bold" }]}>Prezzo</Text>
            <Text style={[styles.tableCell, styles.colTotal, { fontWeight: "bold" }]}>Totale</Text>
          </View>
          {preventivo.voci.map((v, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.colDesc]}>{v.descrizione}</Text>
              <Text style={[styles.tableCell, styles.colQty]}>{Math.round(v.quantita)}</Text>
              <Text style={[styles.tableCell, styles.colPrice]}>{formatEuro(v.prezzo_unitario)}</Text>
              <Text style={[styles.tableCell, styles.colTotal, { fontWeight: "bold" }]}>{formatEuro(v.totale)}</Text>
            </View>
          ))}
        </View>

        {/* Riepilogo */}
        <View style={styles.summary}>
          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={{ fontSize: 10, color: "#64748b" }}>Imponibile</Text>
              <Text style={{ fontSize: 10 }}>{formatEuro(preventivo.importo_totale)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={{ fontSize: 10, color: "#64748b" }}>IVA (22%)</Text>
              <Text style={{ fontSize: 10 }}>{formatEuro(preventivo.importo_totale * 0.22)}</Text>
            </View>
            <View style={[styles.summaryRow, { marginTop: 10 }]}>
              <Text style={styles.totalLabel}>TOTALE IVATO</Text>
              <Text style={styles.totalValue}>{formatEuro(preventivo.importo_totale * 1.22)}</Text>
            </View>
          </View>
        </View>

        {/* Note */}
        {preventivo.note && (
          <View style={styles.notes}>
            <Text style={styles.label}>Note e Condizioni</Text>
            <Text style={{ fontSize: 9, color: "#475569", lineHeight: 1.4 }}>{preventivo.note}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Bite Digital S.r.l. - Documento non valido ai fini fiscali</Text>
          <Text render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} di ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};
