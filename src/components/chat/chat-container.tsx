
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { ChatList } from "./chat-list";
import { ChatWindow } from "./chat-window";
import { RequestManager } from "./request-manager";
import { Button } from "@/components/ui/button";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, getDocs, writeBatch, doc, addDoc } from "firebase/firestore";
import { Inbox, MessageCircle, ArrowLeft, MoreVertical, UserMinus, Phone, Video, AlertTriangle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

export type Contact = {
  id: string;
  uid: string;
  displayName: string;
  photoURL: string;
  guardrailId: string;
};

interface ChatContainerProps {
  externalActiveChat?: Contact | null;
  onClearExternalChat?: () => void;
  onStartCall?: (callId: string) => void;
}

export function ChatContainer({ externalActiveChat, onClearExternalChat, onStartCall }: ChatContainerProps) {
  const { user } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const [activeChat, setActiveChat] = useState<Contact | null>(null);
  const [showRequests, setShowRequests] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (externalActiveChat) {
      setActiveChat(externalActiveChat);
      setShowRequests(false);
      onClearExternalChat?.();
    }
  }, [externalActiveChat, onClearExternalChat]);

  const pendingQ = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, "requests"), where("toId", "==", user.uid), where("status", "==", "pending"));
  }, [db, user]);
  
  const { data: pending } = useCollection(pendingQ);

  const handleRemoveContact = async () => {
    if (!db || !user || !activeChat) return;

    try {
      const q1 = query(collection(db, "requests"), where("fromId", "==", user.uid), where("toId", "==", activeChat.uid));
      const q2 = query(collection(db, "requests"), where("fromId", "==", activeChat.uid), where("toId", "==", user.uid));

      const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      const docs = [...snap1.docs, ...snap2.docs];

      if (docs.length > 0) {
        const batch = writeBatch(db);
        docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();

        toast({
          title: "Connection Removed",
          description: `${activeChat.displayName} has been removed from your network.`,
        });
        setActiveChat(null);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not remove connection.",
      });
    } finally {
      setIsDeleteDialogOpen(false);
    }
  };

  const handleInitiateCall = async (type: "audio" | "video") => {
    if (!db || !user || !activeChat) return;
    
    const callData = {
      callerId: user.uid,
      callerName: user.displayName,
      callerPhoto: user.photoURL,
      calleeId: activeChat.uid,
      calleeName: activeChat.displayName,
      calleePhoto: activeChat.photoURL,
      type,
      status: "ringing",
      timestamp: Date.now()
    };
    
    try {
      const callRef = await addDoc(collection(db, "calls"), callData);
      onStartCall?.(callRef.id);
    } catch (e) {
      console.error("Failed to start call", e);
    }
  };

  if (!user) return null;

  return (
    <div className="flex h-full w-full bg-background relative overflow-hidden">
      {/* Removal Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-3xl border-border max-w-[340px]">
          <AlertDialogHeader className="flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-destructive/10 rounded-2xl flex items-center justify-center mb-2">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <AlertDialogTitle className="font-black uppercase tracking-tight text-base">Remove Member?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground leading-relaxed">
              This will sever your secure link with <span className="text-foreground">{activeChat?.displayName}</span>. You will no longer see each other on the mapping grid.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <AlertDialogCancel className="rounded-2xl h-12 border-muted hover:bg-muted font-bold uppercase tracking-widest text-[10px] flex-1">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRemoveContact}
              className="rounded-2xl h-12 bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold uppercase tracking-widest text-[10px] flex-1"
            >
              Confirm Removal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sidebar */}
      <div className={`flex flex-col h-full bg-background transition-all duration-300 shrink-0 ${activeChat ? 'hidden md:flex w-80 border-r border-border' : 'flex-1'}`}>
        <div className="px-6 py-4 flex items-center justify-between border-b border-border">
          <h2 className="text-[11px] font-black text-foreground uppercase tracking-widest text-nowrap">NETWORK</h2>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowRequests(!showRequests)}
            className={`rounded-2xl px-4 relative transition-all h-9 ${
              showRequests 
                ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground shadow-lg' 
                : 'text-muted-foreground hover:bg-primary hover:text-primary-foreground'
            }`}
          >
            {showRequests ? <MessageCircle className="h-4 w-4 mr-2" /> : <Inbox className="h-4 w-4 mr-2" />}
            <span className="text-[10px] font-black uppercase tracking-tight">{showRequests ? "Chats" : "Inbox"}</span>
            {!showRequests && pending && pending.length > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-destructive text-destructive-foreground text-[8px] font-black flex items-center justify-center rounded-full border-2 border-background animate-bounce shadow-sm">
                {pending.length}
              </span>
            )}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {showRequests ? (
            <RequestManager />
          ) : (
            <ChatList onSelectChat={setActiveChat} />
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      {activeChat && (
        <div className="absolute inset-0 md:relative md:flex-1 bg-background flex flex-col z-[60] md:z-0 animate-in slide-in-from-right duration-300">
          <div className="px-6 py-4 border-b border-border flex items-center gap-4 bg-background/80 backdrop-blur-md relative z-[70]">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setActiveChat(null)}
              className="rounded-2xl text-muted-foreground hover:bg-muted hover:text-foreground active:scale-90 transition-all shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Avatar className="h-10 w-10 border-2 border-background shadow-md shrink-0">
              <AvatarImage src={activeChat.photoURL} />
              <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-black">{activeChat.displayName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
              <p className="font-black text-foreground text-sm truncate uppercase tracking-tight">{activeChat.displayName}</p>
              <p className="text-[9px] font-mono font-bold text-muted-foreground tracking-widest uppercase">{activeChat.guardrailId}</p>
            </div>
            
            <div className="flex items-center gap-1 shrink-0">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => handleInitiateCall("audio")}
                className="rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground active:scale-90"
              >
                <Phone className="h-5 w-5" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => handleInitiateCall("video")}
                className="rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground active:scale-90"
              >
                <Video className="h-5 w-5" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-2xl p-2 w-48 shadow-2xl bg-popover text-popover-foreground border-border">
                  <DropdownMenuItem 
                    onClick={() => setIsDeleteDialogOpen(true)}
                    className="text-destructive focus:text-destructive focus:bg-destructive/10 rounded-xl px-3 py-2.5 cursor-pointer flex items-center gap-2"
                  >
                    <UserMinus className="h-4 w-4" />
                    <span className="text-xs font-black uppercase tracking-widest">Remove Member</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <ChatWindow contact={activeChat} />
          </div>
        </div>
      )}
    </div>
  );
}
