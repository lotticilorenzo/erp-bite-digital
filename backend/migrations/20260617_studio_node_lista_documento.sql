-- Migration: aggiunge tipi nodo LISTA e DOCUMENTO all'enum studio_node_type
-- Brief C3: nodi contenitore (lista) e foglia (documento) per l'albero Studio OS
ALTER TYPE studio_node_type ADD VALUE IF NOT EXISTS 'lista';
ALTER TYPE studio_node_type ADD VALUE IF NOT EXISTS 'documento';
