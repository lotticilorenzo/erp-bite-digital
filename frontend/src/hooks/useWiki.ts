import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { WikiCategory, WikiArticle } from "@/types/wiki";

export function useWiki() {
  const queryClient = useQueryClient();

  const categories = useQuery({
    queryKey: ["wiki-categories"],
    queryFn: async () => {
      const res = await api.get<WikiCategory[]>("/wiki/categorie");
      return res.data;
    },
  });

  const articles = (categoria_id?: string) => useQuery({
    queryKey: ["wiki-articles", categoria_id],
    queryFn: async () => {
      const url = categoria_id ? `/wiki/articoli?categoria_id=${categoria_id}` : "/wiki/articoli";
      const res = await api.get<WikiArticle[]>(url);
      return res.data;
    },
  });

  const getArticle = (id: string) => useQuery({
    queryKey: ["wiki-article", id],
    queryFn: async () => {
      const res = await api.get<WikiArticle>(`/wiki/articoli/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  const createArticle = useMutation({
    mutationFn: async (data: Partial<WikiArticle>) => {
      const res = await api.post<WikiArticle>("/wiki/articoli", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wiki-articles"], exact: false });
    },
  });

  const updateArticle = useMutation({
    mutationFn: async ({ id, ...data }: Partial<WikiArticle> & { id: string }) => {
      const res = await api.patch<WikiArticle>(`/wiki/articoli/${id}`, data);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["wiki-articles"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["wiki-article", data.id], exact: false });
    },
  });

  const deleteArticle = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/wiki/articoli/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wiki-articles"], exact: false });
    },
  });

  const searchArticles = (q: string) => useQuery({
    queryKey: ["wiki-search", q],
    queryFn: async () => {
      const res = await api.get<WikiArticle[]>(`/wiki/cerca?q=${q}`);
      return res.data;
    },
    enabled: q.length > 2,
  });

  return {
    categories,
    articles,
    getArticle,
    createArticle,
    updateArticle,
    deleteArticle,
    searchArticles,
  };
}
