"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, doc, addDoc, writeBatch } from "firebase/firestore";
import { Contact } from "./chat-container";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Loader2, Check, CheckCheck, PhoneOff, VideoOff, PhoneIncoming, PhoneOutgoing } from "lucide-react";
import { format } from "date-fns";

export function ChatWindow({ contact }: { contact: Contact }) {
  const { user } = useAuth();
  const db = useFirestore();
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatId = [user?.uid, contact.uid].sort().join("_");

  const messagesQuery = useMemoFirebase(() => {
    if (!db || !chatId) return null;
    return query(
      collection(db, "chats", chatId, "messages"),
      orderBy("timestamp", "asc")
    );
  }, [db, chatId]);

  const { data: messages, isLoading } = useCollection(messagesQuery);

  useEffect(() => {
    if (!db || !user || !messages || messages.length === 0) return;

    const unreadMessages = messages.filter(
      (msg) => msg.senderId !== user.uid && msg.status !== "seen"
    );

    if (unreadMessages.length > 0) {
      const batch = writeBatch(db);
      unreadMessages.forEach((msg) => {
        const msgRef = doc(db, "chats", chatId, "messages", msg.id);
        batch.update(msgRef, { status: "seen" });
      });
      batch.commit();
    }
  }, [db, user, messages, chatId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "auto" });
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !user || !db) return;

    const messageData = {
      senderId: user.uid,
      text: text.trim(),
      timestamp: Date.now(),
      status: "sent"
    };

    const chatRef = collection(db, "chats", chatId, "messages");
    addDoc(chatRef, messageData);
    setText("");
  };

  const renderStatus = (msg: any) => {
    if (msg.senderId !== user?.uid) return null;
    if (msg.status === 'seen') return <CheckCheck className="h-3 w-3 text-accent" />;
    return <Check className="h-3 w-3 text-muted-foreground/30" />;
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="animate-spin h-5 w-5 text-muted-foreground/20" />
          </div>
        ) : (
          messages?.map((msg, i) => {
            const isMe = msg.senderId === user?.uid;
            const timeLabel = msg.timestamp ? format(msg.timestamp, "h:mm a") : "";
            
            const lowerText = msg.text?.toLowerCase() || "";
            const isCallLog = lowerText.includes("call");
            const isMissed = lowerText.includes("missed");
            const isVideo = lowerText.includes("video");
            
            return (
              <div key={msg.id || i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-[13px] font-medium flex items-center gap-3 ${
                  isCallLog 
                    ? isMissed
                      ? 'bg-destructive/10 text-destructive border border-destructive/20' 
                      : 'bg-muted/50 text-foreground border border-border'
                    : isMe 
                      ? 'bg-primary text-primary-foreground rounded-tr-none' 
                      : 'bg-muted text-foreground rounded-tl-none'
                }`}>
                  {isCallLog && (
                    <div className={`p-1.5 rounded-full ${isMissed ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                      {isMissed ? (
                        isVideo ? <VideoOff className="h-3.5 w-3.5" /> : <PhoneOff className="h-3.5 w-3.5" />
                      ) : (
                        isMe ? <PhoneOutgoing className="h-3.5 w-3.5 text-primary" /> : <PhoneIncoming className="h-3.5 w-3.5 text-primary" />
                      )}
                    </div>
                  )}
                  <span className={isCallLog ? "font-bold uppercase tracking-tight text-[11px]" : ""}>
                    {msg.text}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1 px-1">
                  <span className="text-[9px] font-bold text-muted-foreground/50 uppercase">
                    {timeLabel}
                  </span>
                  {isMe && renderStatus(msg)}
                </div>
              </div>
            );
          })
        )}
        <div ref={scrollRef} />
      </div>

      <form onSubmit={handleSend} className="p-3 border-t border-border flex gap-2 items-center bg-background">
        <Input 
          value={text} 
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          className="rounded-xl bg-muted/30 border-none h-11 focus-visible:ring-1 focus-visible:ring-primary px-4 text-sm"
        />
        <Button 
          type="submit" 
          size="icon" 
          disabled={!text.trim()}
          className="h-11 w-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 shadow-sm transition-all active:scale-95"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
