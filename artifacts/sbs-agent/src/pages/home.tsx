import { useState, useRef, useEffect } from "react";
import {
  useListOpenaiConversations,
  useCreateOpenaiConversation,
  useGetOpenaiConversation,
  useDeleteOpenaiConversation,
  useCreateSpiel,
  getGetOpenaiConversationQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Trash2, Send, Copy, BookmarkPlus, Loader2, Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export default function Home() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [spielDialogOpen, setSpielDialogOpen] = useState(false);
  const [spielToSave, setSpielToSave] = useState("");
  const [spielTitle, setSpielTitle] = useState("");
  const [spielCategory, setSpielCategory] = useState("General");
  
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [], isLoading: isLoadingConversations } = useListOpenaiConversations();
  const createConversation = useCreateOpenaiConversation();
  const deleteConversation = useDeleteOpenaiConversation();
  const saveSpiel = useCreateSpiel();

  const { data: activeConversation, isLoading: isLoadingMessages } = useGetOpenaiConversation(
    activeConversationId as number,
    { query: { enabled: !!activeConversationId, queryKey: getGetOpenaiConversationQueryKey(activeConversationId as number) } }
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeConversation?.messages, streamingContent]);

  const detectLanguage = (text: string) => {
    const tagalogWords = ["ang", "mga", "nito", "sa", "ay", "na", "ba", "po", "opo", "hindi", "ano", "ito", "yan", "iyon", "dito", "diyan", "doon", "bakit", "kailan", "paano", "sino", "saan", "ilang", "magkano"];
    const words = text.toLowerCase().split(/\s+/);
    let tagalogCount = 0;
    
    words.forEach(word => {
      if (tagalogWords.includes(word)) {
        tagalogCount++;
      }
    });

    const ratio = tagalogCount / words.length;
    if (ratio > 0.05) {
      return { lang: "Tagalog", label: "Tagalog detected - Mixed EN/TL" };
    }
    return { lang: "English", label: "English detected - 100% EN" };
  };

  const handleGenerateSpiel = async () => {
    if (!inputValue.trim() || isStreaming) return;
    
    let currentConvId = activeConversationId;
    const currentInput = inputValue.trim();
    setInputValue("");
    
    try {
      if (!currentConvId) {
        const titleWords = currentInput.split(/\s+/).slice(0, 4).join(" ");
        const newConv = await createConversation.mutateAsync({
          data: { title: titleWords + "..." }
        });
        currentConvId = newConv.id;
        setActiveConversationId(currentConvId);
        queryClient.invalidateQueries({ queryKey: ["/api/openai/conversations"] });
      }

      setIsStreaming(true);
      setStreamingContent("");
      
      const queryKey = getGetOpenaiConversationQueryKey(currentConvId);
      
      // Optimistic user message
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          messages: [
            ...old.messages,
            { id: Date.now(), conversationId: currentConvId, role: "user", content: currentInput, createdAt: new Date().toISOString() }
          ]
        };
      });

      const response = await fetch(`/api/openai/conversations/${currentConvId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: currentInput }),
      });
      
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalAssistantContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                setStreamingContent(prev => prev + data.content);
                finalAssistantContent += data.content;
              }
              if (data.done) {
                // Done streaming
              }
            } catch (e) {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }

      // Add assistant message to cache
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          messages: [
            ...old.messages,
            { id: Date.now() + 1, conversationId: currentConvId, role: "assistant", content: finalAssistantContent, createdAt: new Date().toISOString() }
          ]
        };
      });

    } catch (error) {
      toast({
        title: "Error generating spiel",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
      if (currentConvId) {
        queryClient.invalidateQueries({ queryKey: getGetOpenaiConversationQueryKey(currentConvId) });
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Spiel copied to clipboard.",
    });
  };

  const handleDeleteConversation = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      await deleteConversation.mutateAsync({ id });
      if (activeConversationId === id) {
        setActiveConversationId(null);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/openai/conversations"] });
      toast({ title: "Conversation deleted" });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const handleSaveSpielSubmit = async () => {
    if (!spielTitle.trim() || !spielCategory.trim()) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }

    try {
      await saveSpiel.mutateAsync({
        data: {
          title: spielTitle,
          category: spielCategory,
          content: spielToSave
        }
      });
      toast({ title: "Spiel saved successfully!" });
      setSpielDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/spiels"] });
    } catch {
      toast({ title: "Failed to save spiel", variant: "destructive" });
    }
  };

  const openSaveSpielDialog = (content: string) => {
    setSpielToSave(content);
    setSpielTitle("");
    setSpielCategory("General");
    setSpielDialogOpen(true);
  };

  return (
    <div className="flex w-full h-full overflow-hidden">
      {/* Left Sidebar - Conversations */}
      <div className="w-80 border-r bg-muted/30 flex flex-col shrink-0">
        <div className="p-4 border-b bg-background flex items-center justify-between">
          <h2 className="font-semibold">Recent Sessions</h2>
          <Button variant="ghost" size="icon" onClick={() => setActiveConversationId(null)}>
            <Plus className="h-5 w-5" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {isLoadingConversations ? (
              <div className="flex justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center p-6 text-muted-foreground text-sm">
                No past sessions. Start a new one!
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => setActiveConversationId(conv.id)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors group relative border ${
                    activeConversationId === conv.id 
                      ? "bg-primary/10 border-primary/20" 
                      : "bg-background border-transparent hover:border-border hover:bg-muted/50"
                  }`}
                >
                  <p className="font-medium text-sm truncate pr-8">{conv.title || "New Session"}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(conv.createdAt), "MMM d, h:mm a")}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-2 h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                    onClick={(e) => handleDeleteConversation(e, conv.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        <div className="h-14 border-b flex items-center px-6 shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <h1 className="font-semibold text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {activeConversationId ? activeConversation?.title || "Session" : "New Generation"}
          </h1>
        </div>

        <ScrollArea className="flex-1 p-6" ref={scrollRef}>
          <div className="max-w-4xl mx-auto space-y-6 pb-4">
            {!activeConversationId && !isStreaming && (
              <div className="flex flex-col items-center justify-center h-[50vh] text-center px-4">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight mb-2">How can I help you reply?</h2>
                <p className="text-muted-foreground max-w-md">
                  Paste a customer message below to generate a polite, rule-compliant Shopee response spiel instantly.
                </p>
              </div>
            )}

            {activeConversation?.messages.map((msg, i) => {
              if (msg.role === "user") {
                const lang = detectLanguage(msg.content);
                return (
                  <div key={msg.id} className="flex flex-col items-end gap-2">
                    <Badge variant="outline" className="text-xs font-normal text-muted-foreground mb-1">
                      {lang.label}
                    </Badge>
                    <div className="bg-muted p-4 rounded-2xl rounded-tr-sm max-w-[85%] text-sm">
                      {msg.content}
                    </div>
                  </div>
                );
              } else {
                return (
                  <div key={msg.id} className="flex flex-col items-start gap-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Sparkles className="h-3 w-3 text-white" />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">Exszj (SBS Assistant)</span>
                    </div>
                    <div className="bg-card border shadow-sm p-5 rounded-2xl rounded-tl-sm max-w-[90%] w-full">
                      <div className="prose prose-sm max-w-none text-foreground mb-4 whitespace-pre-wrap">
                        {msg.content}
                      </div>
                      <div className="flex items-center gap-2 pt-4 border-t">
                        <Button 
                          onClick={() => copyToClipboard(msg.content)}
                          className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm hover-elevate"
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Spiel
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => openSaveSpielDialog(msg.content)}
                        >
                          <BookmarkPlus className="h-4 w-4 mr-2" />
                          Save as Template
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              }
            })}

            {isStreaming && (
              <div className="flex flex-col items-start gap-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center animate-pulse">
                    <Sparkles className="h-3 w-3 text-white" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">Generating...</span>
                </div>
                <div className="bg-card border shadow-sm p-5 rounded-2xl rounded-tl-sm max-w-[90%] w-full">
                  <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">
                    {streamingContent}
                    <span className="inline-block w-1.5 h-4 ml-1 bg-primary animate-pulse align-middle" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 bg-background border-t">
          <div className="max-w-4xl mx-auto relative flex items-end shadow-sm border rounded-2xl bg-card focus-within:ring-1 focus-within:ring-primary/50 transition-shadow">
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Paste customer message here..."
              className="min-h-[80px] max-h-64 resize-none border-0 shadow-none focus-visible:ring-0 p-4 pb-14 text-base"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleGenerateSpiel();
                }
              }}
            />
            <div className="absolute bottom-3 right-3 flex items-center gap-2">
              <span className="text-xs text-muted-foreground mr-2 hidden sm:inline-block">
                Press Enter to generate
              </span>
              <Button 
                onClick={handleGenerateSpiel} 
                disabled={!inputValue.trim() || isStreaming}
                size="sm"
                className="h-9 px-4 rounded-xl shadow-sm hover-elevate"
              >
                {isStreaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Spiel
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={spielDialogOpen} onOpenChange={setSpielDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save to Spiel Library</DialogTitle>
            <DialogDescription>
              Save this response as a reusable template for future use.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="e.g. Apology for delayed shipping"
                value={spielTitle}
                onChange={(e) => setSpielTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                placeholder="e.g. Order Status, Return/Refund"
                value={spielCategory}
                onChange={(e) => setSpielCategory(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <div className="text-sm bg-muted p-3 rounded-md max-h-40 overflow-y-auto whitespace-pre-wrap">
                {spielToSave}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSpielDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveSpielSubmit}>Save Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
