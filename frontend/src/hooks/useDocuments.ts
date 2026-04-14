import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { DocumentNode, DocumentNodeCreate, DocumentNodeUpdate } from '@/types/document';

const QUERY_KEY = ['documents-tree'];

export function useDocuments() {
  const queryClient = useQueryClient();

  const { data: tree = [], isLoading } = useQuery<DocumentNode[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await api.get('/documents/tree');
      return res.data;
    },
  });

  const createNode = useMutation({
    mutationFn: async (data: DocumentNodeCreate): Promise<DocumentNode> => {
      const res = await api.post('/documents', data);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const updateNode = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: DocumentNodeUpdate }): Promise<DocumentNode> => {
      const res = await api.patch(`/documents/${id}`, data);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const deleteNode = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/documents/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  // Fetch a single node with full content
  const fetchNode = async (id: string): Promise<DocumentNode> => {
    const res = await api.get(`/documents/${id}`);
    return res.data;
  };

  return {
    tree,
    isLoading,
    createNode,
    updateNode,
    deleteNode,
    fetchNode,
  };
}
