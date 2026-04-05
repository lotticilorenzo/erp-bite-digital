import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { WikiSidebar } from "@/components/wiki/WikiSidebar";
import { WikiHome } from "@/components/wiki/WikiHome";
import { WikiArticleView } from "@/components/wiki/WikiArticleView";
import { WikiArticleEditor } from "@/components/wiki/WikiArticleEditor";

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
          <WikiArticleEditor 
            id={editId} 
            onClose={handleCloseEditor} 
            onSaved={handleSaved} 
          />
        ) : articleId ? (
          <WikiArticleView onEdit={handleEditArticle} />
        ) : (
          <WikiHome />
        )}
      </div>
    </div>
  );
}
