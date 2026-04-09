import type { Cliente, Commessa } from "@/types";

const FALLBACK_CLIENT_NAME = "Cliente non disponibile";

export function buildClientById(clienti: Cliente[]) {
  return new Map(clienti.map((cliente) => [cliente.id, cliente]));
}

export function resolveCommessaCliente(
  commessa: Commessa,
  clientById: Map<string, Cliente>
) {
  return commessa.cliente ?? clientById.get(commessa.cliente_id);
}

export function hydrateCommesseWithClienti(
  commesse: Commessa[],
  clienti: Cliente[]
) {
  const clientById = buildClientById(clienti);

  return commesse.map((commessa) => {
    const cliente = resolveCommessaCliente(commessa, clientById);
    return cliente ? { ...commessa, cliente } : commessa;
  });
}

export function getClienteDisplayName(cliente?: Cliente | null) {
  const name = cliente?.ragione_sociale?.trim();
  return name || FALLBACK_CLIENT_NAME;
}
