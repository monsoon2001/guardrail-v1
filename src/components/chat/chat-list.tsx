
"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, addDoc, getDocs, limit, orderBy, onSnapshot } from "firebase/firestore";
import { Contact } from "./chat-container";
import { Loader2, Search, AlertCircle, Plus, UserPlus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

function ChatPreviewItem({ 
  contact, 
  onSelect 
}: { 
  contact: Contact; 
  onSelect: (contact: Contact) => void 
}) {
  const { user } = useAuth();
  const db = useFirestore();
  const chatId = [user?.uid, contact.uid].sort().join("_");

  // Query for the last message to show preview text
  const lastMessageQuery = useMemoFirebase(() => {
    if (!db || !chatId) return null;
    return query(
      collection(db, "chats", chatId, "messages"),
      orderBy("timestamp", "desc"),
      limit(1)
    );
  }, [db, chatId]);

  // Query for ALL unread messages from the other person to show count
  const unreadQuery = useMemoFirebase(() => {
    if (!db || !chatId || !user) return null;
    return query(
      collection(db, "chats", chatId, "messages"),
      where("status", "!=", "seen")
    );
  }, [db, chatId, user]);

  const { data: lastMessages } = useCollection(lastMessageQuery);
  const { data: unreadMessages } = useCollection(unreadQuery);
  
  const lastMsg = lastMessages?.[0];
  const unreadCount = (unreadMessages || []).filter(m => m.senderId !== user?.uid).length;

  return (
    <button
      onClick={() => onSelect(contact)}
      className="w-full flex items-center gap-4 p-4 rounded-3xl hover:bg-muted/50 transition-all text-left group relative"
    >
      <div className="relative">
        <Avatar className="h-12 w-12 border border-border shadow-sm transition-transform group-hover:scale-105">
          <AvatarImage src={contact.photoURL} />
          <AvatarFallback className="bg-muted text-muted-foreground/30 font-bold text-xs">
            {contact.displayName?.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-accent border-2 border-background rounded-full" />
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="flex justify-between items-start">
          <p className="font-bold text-foreground truncate text-sm mb-0.5 uppercase tracking-tight">{contact.displayName}</p>
        </div>
        <p className={`text-[11px] truncate transition-all ${
          unreadCount > 0 
            ? 'font-black text-foreground' 
            : 'font-medium text-muted-foreground opacity-60'
        }`}>
          {lastMsg ? lastMsg.text : `Link Established`}
        </p>
      </div>
      {unreadCount > 0 && (
        <div className="h-5 min-w-[20px] px-1.5 bg-primary text-primary-foreground text-[9px] font-black flex items-center justify-center rounded-full shadow-sm">
          {unreadCount}
        </div>
      )}
    </button>
  );
}

export function ChatList({ onSelectChat }: { onSelectChat: (contact: Contact) => void }) {
  const { user, profile } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const [searchId, setSearchId] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [contactLastActivity, setContactLastActivity] = useState<Record<string, number>>({});

  const q1 = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, "requests"), where("status", "==", "accepted"), where("fromId", "==", user.uid));
  }, [db, user]);

  const q2 = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, "requests"), where("status", "==", "accepted"), where("toId", "==", user.uid));
  }, [db, user]);

  const { data: sent, isLoading: l1 } = useCollection(q1);
  const { data: received, isLoading: l2 } = useCollection(q2);

  const usersQ = useMemoFirebase(() => db ? collection(db, "users") : null, [db]);
  const { data: allUsers } = useCollection(usersQ);

  // Monitor last activity for each contact to handle sorting
  useEffect(() => {
    if (!db || !user || !sent || !received) return;

    const currentContactIds = [
      ...sent.map(r => r.toId),
      ...received.map(r => r.fromId)
    ];

    const unsubscribes: (() => void)[] = [];

    currentContactIds.forEach(contactId => {
      const chatId = [user.uid, contactId].sort().join("_");
      const msgQuery = query(
        collection(db, "chats", chatId, "messages"),
        orderBy("timestamp", "desc"),
        limit(1)
      );

      const unsub = onSnapshot(msgQuery, (snap) => {
        if (!snap.empty) {
          const lastTime = snap.docs[0].data().timestamp || 0;
          setContactLastActivity(prev => ({
            ...prev,
            [contactId]: lastTime
          }));
        }
      });
      unsubscribes.push(unsub);
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [db, user, sent, received]);

  const sortedContacts = useMemo(() => {
    const contactIds = new Set([
      ...(sent || []).map(r => r.toId),
      ...(received || []).map(r => r.fromId)
    ]);

    return (allUsers || [])
      .filter(u => contactIds.has(u.id))
      .sort((a, b) => {
        const timeA = contactLastActivity[a.id] || 0;
        const timeB = contactLastActivity[b.id] || 0;
        return timeB - timeA;
      });
  }, [allUsers, sent, received, contactLastActivity]);

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = searchId.trim().toUpperCase();
    if (!targetId || !user || !db) return;
    
    setIsSearching(true);
    setSearchError(null);

    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("guardrailId", "==", targetId), limit(1));
      const snap = await getDocs(q);

      if (snap.empty) {
        setSearchError("No user found with this ID.");
        return;
      }

      const targetUser = snap.docs[0].data();
      if (targetUser.id === user.uid) {
        setSearchError("You cannot add yourself.");
        return;
      }

      const existingQ = query(
        collection(db, "requests"), 
        where("fromId", "==", user.uid), 
        where("toId", "==", targetUser.id)
      );
      const existingSnap = await getDocs(existingQ);
      if (!existingSnap.empty) {
        toast({ title: "Request already sent", description: "Wait for them to accept." });
        setSearchId("");
        return;
      }

      await addDoc(collection(db, "requests"), {
        fromId: user.uid,
        fromName: profile?.displayName || user.displayName,
        fromPhoto: profile?.photoURL || user.photoURL,
        toId: targetUser.id,
        toGuardrailId: targetUser.guardrailId,
        status: "pending",
        timestamp: new Date().toISOString()
      });

      toast({ title: "Request sent!", description: "They will appear once accepted." });
      setSearchId("");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Search Error", description: e.message });
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-background">
      <div className="p-4 space-y-4 bg-muted/20 border-b border-border">
        <form onSubmit={handleSendRequest} className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
              <Input 
                value={searchId}
                onChange={(e) => {
                  setSearchId(e.target.value);
                  setSearchError(null);
                }}
                placeholder="GR-XXXXXX"
                className="rounded-2xl bg-background border-border h-11 pl-11 focus-visible:ring-primary font-mono text-sm tracking-widest uppercase"
              />
            </div>
            <Button 
              type="submit"
              disabled={isSearching || !searchId}
              size="icon"
              className="rounded-2xl h-11 w-11 bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 shadow-sm"
            >
              {isSearching ? <Loader2 className="animate-spin h-5 w-5" /> : <Plus className="h-5 w-5" />}
            </Button>
          </div>
          {searchError && (
            <div className="flex items-center gap-2 text-destructive text-[11px] font-medium px-2 animate-in fade-in slide-in-from-top-1">
              <AlertCircle className="h-3 w-3" />
              {searchError}
            </div>
          )}
        </form>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {l1 || l2 ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="animate-spin h-6 w-6 text-muted-foreground/20" />
          </div>
        ) : sortedContacts.length === 0 ? (
          <div className="p-12 text-center space-y-6">
            <div className="w-16 h-16 bg-muted rounded-[2rem] flex items-center justify-center mx-auto border border-border">
              <UserPlus className="h-6 w-6 text-muted-foreground/30" />
            </div>
            <div className="space-y-2">
              <p className="text-foreground text-sm font-bold uppercase tracking-tight">Empty Network</p>
              <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest px-4 leading-relaxed">Add a member ID above to begin.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {sortedContacts.map((contact) => (
              <ChatPreviewItem
                key={contact.id}
                contact={{
                  id: contact.id,
                  uid: contact.id,
                  displayName: contact.displayName || "User",
                  photoURL: contact.photoURL || "",
                  guardrailId: contact.guardrailId
                }}
                onSelect={onSelectChat}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
