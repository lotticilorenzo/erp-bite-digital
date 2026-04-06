import React from "react";
import { 
  ChevronRight, 
  Hash, 
  Plus,
  Search,
  Home
} from "lucide-react";
import { 
  SidebarGroup, 
  SidebarGroupContent, 
  SidebarGroupLabel, 
  SidebarMenu, 
  SidebarMenuButton, 
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { useStudio } from "@/hooks/useStudio";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ClientAvatar } from "../common/ClientAvatar";
import { ProgettoDialog } from "../progetti/ProgettoDialog";

export function StudioSidebar() {
  const { nav, selectFolder, setView, spaces } = useStudio();
  const [search, setSearch] = React.useState("");
  const [isProgettoModalOpen, setIsProgettoModalOpen] = React.useState(false);

  return (
    <div className="flex flex-col h-full bg-transparent border-r border-border/30">
      <div className="p-4 space-y-4">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#475569] group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Search tasks..." 
            className="pl-9 h-8 bg-card/50 border-border/50 text-xs focus-visible:ring-primary/30"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              isActive={nav.view === "home"}
              onClick={() => setView("home")}
              className={`h-9 px-3 rounded-lg transition-all ${
                nav.view === "home" ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_hsl(var(--primary)/0.2)]" : "text-muted-foreground hover:text-white"
              }`}
            >
              <Home className="h-4 w-4" />
              <span className="font-bold text-xs uppercase tracking-wider">Home</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </div>

      <ScrollArea className="flex-1 px-2 pb-4">
        {spaces.map((space) => (
          <SidebarGroup key={space.id} className="py-2">
            <SidebarGroupLabel className="px-3 mb-2 flex items-center justify-between text-[10px] uppercase font-black tracking-[0.2em] text-[#475569]">
              {space.name}
              <button className="hover:text-primary transition-colors" onClick={() => setIsProgettoModalOpen(true)}>
                <Plus className="h-3 w-3" />
              </button>
            </SidebarGroupLabel>
            
            <SidebarGroupContent>
              <SidebarMenu>
                {space.folders.map((folder) => {
                  const isFolderSelected = nav.selectedFolderId === folder.id;
                  
                  return (
                    <Collapsible
                      key={folder.id}
                      defaultOpen={isFolderSelected}
                      className="group/collapsible"
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton 
                            className={`h-9 px-3 rounded-lg group ${isFolderSelected ? "text-white font-bold" : "text-muted-foreground hover:text-white"}`}
                            onClick={() => selectFolder(folder.id)}
                          >
                            <ClientAvatar 
                              name={folder.ragione_sociale} 
                              logoUrl={folder.logo_url} 
                              size="xs" 
                              className="rounded-md border-border"
                            />
                            <span className="text-xs truncate">{folder.ragione_sociale}</span>
                            <ChevronRight className={`ml-auto h-3.5 w-3.5 text-[#475569] transition-transform duration-300 group-data-[state=open]/collapsible:rotate-90`} />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        
                        <CollapsibleContent>
                          <SidebarMenuSub className="border-l border-border ml-4 mt-0.5 space-y-0.5">
                            <ProjectList folderId={folder.id} />
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </ScrollArea>

      <ProgettoDialog 
        open={isProgettoModalOpen} 
        onOpenChange={setIsProgettoModalOpen} 
      />
    </div>
  );
}

function ProjectList({ folderId }: { folderId: string }) {
  const { nav, selectList, getFolderProjects } = useStudio();
  
  const projects = getFolderProjects(folderId);

  if (projects.length === 0) {
    return (
      <div className="px-4 py-2 text-[10px] text-[#475569] italic">
        Nessun progetto
      </div>
    );
  }

  return (
    <>
      {projects.map((project) => (
        <SidebarMenuSubItem key={project.id}>
          <SidebarMenuSubButton
            onClick={() => selectList(project.id, folderId)}
            isActive={nav.selectedListId === project.id}
            className={`h-8 rounded-md text-[11px] transition-all ${
              nav.selectedListId === project.id 
                ? "bg-white/5 text-primary font-bold" 
                : "text-muted-foreground hover:text-muted-foreground hover:bg-white/5"
            }`}
          >
            <Hash className={`h-3 w-3 mr-2 ${nav.selectedListId === project.id ? "text-primary" : "text-[#334155]"}`} />
            <span className="truncate">{project.nome}</span>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      ))}
    </>
  );
}
