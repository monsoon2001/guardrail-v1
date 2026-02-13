"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, updateDoc, doc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Loader2, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function RequestManager() {
  const { user } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();

  const incomingQ = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, "requests"), where("toId", "==", user.uid), where("status", "==", "pending"));
  }, [db, user]);

  const { data: incoming, isLoading } = useCollection(incomingQ);

  const handleResponse = async (requestId: string, status: 'accepted' | 'rejected') => {
    if (!db) return;
    await updateDoc(doc(db, "requests", requestId), { status });
    toast({ title: status === 'accepted' ? "Request accepted" : "Request ignored" });
  };

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-300">
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
            Pending Requests
          </p>
          <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
            {incoming?.length || 0}
          </span>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center p-4"><Loader2 className="animate-spin h-5 w-5 text-muted-foreground/20" /></div>
        ) : incoming?.length === 0 ? (
          <div className="bg-muted/10 rounded-3xl p-8 text-center border border-dashed border-border">
            <p className="text-sm text-muted-foreground/50">No pending requests at the moment.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {incoming?.map((req) => (
              <div key={req.id} className="flex items-center justify-between p-4 bg-background rounded-3xl border border-border shadow-sm">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border border-border">
                    <AvatarImage src={req.fromPhoto} />
                    <AvatarFallback className="bg-muted text-muted-foreground/30">{req.fromName?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-bold text-foreground">{req.fromName}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">CONNECTION REQUEST</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={() => handleResponse(req.id, 'accepted')}
                    className="rounded-xl text-accent hover:bg-accent/10"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={() => handleResponse(req.id, 'rejected')}
                    className="rounded-xl text-muted-foreground hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
