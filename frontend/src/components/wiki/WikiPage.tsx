import { lazy, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { WikiSidebar } from "@/components/wiki/WikiSidebar";
import { WikiHome } from "@/components/wiki/WikiHome";
import { WikiArticleView } from "@/components/wiki/WikiArticleView";

const WikiArticleEditor = lazy(async () => {
  const module = await import("@/components/wiki/WikiArticleEditor");
  return { default: module.WikiArticleEditor };
});

export default function WikiPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | undefined>(undefined);

  const articleId = searchParams.get("id");

  useEffect(() => {
    if (isEditing && !editId && articleId) {
      // If we are editing but have an articleId, it means we clicked edit on an existing one
      setEditId(articleId);
    }
  }, [isEditing, editId, articleId]);

  const handleNewArticle = () => {
    setEditId(undefined);
    setIsEditing(true);
  };

  const handleEditArticle = (id: string) => {
    setEditId(id);
    setIsEditing(true);
  };

  const handleCloseEditor = () => {
    setIsEditing(false);
    setEditId(undefined);
  };

  const handleSaved = (id: string) => {
    setSearchParams({ id });
    setIsEditing(false);
    setEditId(undefined);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-background">
      <WikiSidebar onNewArticle={handleNewArticle} />
      
      <div className="flex-1 flex flex-col min-w-0">
        {isEditing ? (
          <Suspense
            fallback={
              <div className="flex flex-1 items-center justify-center bg-background text-sm text-muted-foreground">
                Caricamento editor wiki...
              </div>
            }
          >
            <WikiArticleEditor
              id={editId}
              onClose={handleCloseEditor}
              onSaved={handleSaved}
            />
          </Suspense>
        ) : articleId ? (
          <WikiArticleView onEdit={handleEditArticle} />
        ) : (
          <WikiHome />
        )}
      </div>
    </div>
  );
}
