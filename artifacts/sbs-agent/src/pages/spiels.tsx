import { useState } from "react";
import {
  useListSpiels,
  useCreateSpiel,
  useUpdateSpiel,
  useDeleteSpiel,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Search, Trash2, Edit2, Copy, MoreVertical, Library, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function Spiels() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSpiel, setEditingSpiel] = useState<{ id?: number, title: string, category: string, content: string } | null>(null);

  const { data: spiels = [], isLoading } = useListSpiels();
  const createSpiel = useCreateSpiel();
  const updateSpiel = useUpdateSpiel();
  const deleteSpiel = useDeleteSpiel();

  const categories = Array.from(new Set(spiels.map(s => s.category))).filter(Boolean);
  
  const filteredSpiels = spiels.filter(s => {
    const matchesSearch = s.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory ? s.category === activeCategory : true;
    return matchesSearch && matchesCategory;
  });

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({ title: "Copied to clipboard!" });
  };

  const handleOpenAddDialog = () => {
    setEditingSpiel({ title: "", category: "General", content: "" });
    setDialogOpen(true);
  };

  const handleOpenEditDialog = (spiel: any) => {
    setEditingSpiel({ ...spiel });
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this spiel template?")) return;
    try {
      await deleteSpiel.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: ["/api/spiels"] });
      toast({ title: "Template deleted" });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const handleSaveSubmit = async () => {
    if (!editingSpiel || !editingSpiel.title.trim() || !editingSpiel.content.trim()) {
      toast({ title: "Please fill in title and content", variant: "destructive" });
      return;
    }

    try {
      if (editingSpiel.id) {
        await updateSpiel.mutateAsync({
          id: editingSpiel.id,
          data: {
            title: editingSpiel.title,
            category: editingSpiel.category,
            content: editingSpiel.content
          }
        });
        toast({ title: "Template updated!" });
      } else {
        await createSpiel.mutateAsync({
          data: {
            title: editingSpiel.title,
            category: editingSpiel.category || "General",
            content: editingSpiel.content
          }
        });
        toast({ title: "Template added!" });
      }
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/spiels"] });
    } catch {
      toast({ title: "Failed to save template", variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col h-full bg-muted/20">
      <div className="px-8 py-6 border-b bg-background flex flex-col gap-6 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Library className="h-6 w-6 text-primary" />
              Saved Spiels
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Your library of approved, ready-to-use customer responses.
            </p>
          </div>
          <Button onClick={handleOpenAddDialog} className="shadow-sm hover-elevate">
            <Plus className="h-4 w-4 mr-2" />
            Add Template
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-muted/50 border-transparent focus-visible:border-primary/50"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 -mb-2">
            <Badge 
              variant={activeCategory === null ? "default" : "secondary"}
              className="cursor-pointer whitespace-nowrap"
              onClick={() => setActiveCategory(null)}
            >
              All Categories
            </Badge>
            {categories.map(cat => (
              <Badge 
                key={cat}
                variant={activeCategory === cat ? "default" : "secondary"}
                className="cursor-pointer whitespace-nowrap"
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        {isLoading ? (
          <div className="text-center text-muted-foreground p-10">Loading templates...</div>
        ) : filteredSpiels.length === 0 ? (
          <div className="text-center py-20 bg-background rounded-2xl border border-dashed flex flex-col items-center max-w-lg mx-auto">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <BookOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">No templates found</h3>
            <p className="text-muted-foreground mt-2 mb-6">
              Create your first spiel template or try adjusting your search filters.
            </p>
            <Button onClick={handleOpenAddDialog}>Create Template</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {filteredSpiels.map((spiel) => (
              <div 
                key={spiel.id}
                className="bg-card border rounded-xl overflow-hidden flex flex-col hover:border-primary/30 hover:shadow-md transition-all group"
              >
                <div className="p-5 border-b bg-muted/10 flex items-start justify-between">
                  <div className="space-y-1 pr-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] font-medium px-1.5 py-0">
                        {spiel.category}
                      </Badge>
                    </div>
                    <h3 className="font-semibold text-base leading-tight line-clamp-2">
                      {spiel.title}
                    </h3>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 -mr-2">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenEditDialog(spiel)}>
                        <Edit2 className="h-4 w-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(spiel.id)} className="text-destructive focus:text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="p-5 flex-1 text-sm text-muted-foreground whitespace-pre-wrap line-clamp-6">
                  {spiel.content}
                </div>
                <div className="p-4 pt-0 mt-auto">
                  <Button 
                    className="w-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                    onClick={() => handleCopy(spiel.content)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Template
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingSpiel?.id ? "Edit Template" : "Add New Template"}</DialogTitle>
            <DialogDescription>
              Create standard responses for quick access.
            </DialogDescription>
          </DialogHeader>
          {editingSpiel && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="e.g. Apology for delayed shipping"
                    value={editingSpiel.title}
                    onChange={(e) => setEditingSpiel({ ...editingSpiel, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    placeholder="e.g. Order Status, Return/Refund"
                    value={editingSpiel.category}
                    onChange={(e) => setEditingSpiel({ ...editingSpiel, category: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">Spiel Content</Label>
                <Textarea
                  id="content"
                  placeholder="Enter the full spiel here..."
                  className="min-h-[200px]"
                  value={editingSpiel.content}
                  onChange={(e) => setEditingSpiel({ ...editingSpiel, content: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveSubmit}>Save Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
