
"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useFirestore } from "@/firebase";
import { collection, query, where, onSnapshot, limit, orderBy, doc, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

interface NotificationManagerProps {
  activeChatUid?: string | null;
}

/**
 * Handles browser and in-app notifications for incoming messages and contact requests.
 * Automatically dismisses message toasts after 3 seconds.
 */
export function NotificationManager({ activeChatUid }: NotificationManagerProps) {
  const { user } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const listeners = useRef<{ [chatId: string]: () => void }>({});
  const initialLoadDone = useRef<{ [chatId: string]: boolean }>({});
  const initialRequestsLoadDone = useRef(false);

  // Request Notification Permission on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, []);

  useEffect(() => {
    if (!db || !user) return;

    // --- 1. Message Notifications ---
    const q1 = query(collection(db, "requests"), where("status", "==", "accepted"), where("fromId", "==", user.uid));
    const q2 = query(collection(db, "requests"), where("status", "==", "accepted"), where("toId", "==", user.uid));

    const setupChatListener = async (contactUid: string, initialName: string) => {
      const chatId = [user.uid, contactUid].sort().join("_");
      
      if (listeners.current[chatId]) return;

      let contactName = initialName;
      if (contactName === "Someone" || !contactName) {
        try {
          const userDoc = await getDoc(doc(db, "users", contactUid));
          if (userDoc.exists()) {
            contactName = userDoc.data().displayName || "Someone";
          }
        } catch (e) {}
      }

      const msgQuery = query(
        collection(db, "chats", chatId, "messages"),
        orderBy("timestamp", "desc"),
        limit(1)
      );

      const unsubscribe = onSnapshot(
        msgQuery, 
        (snapshot) => {
          if (!initialLoadDone.current[chatId]) {
            initialLoadDone.current[chatId] = true;
            return;
          }

          if (snapshot.empty) return;
          const lastMsg = snapshot.docs[0].data();

          if (
            lastMsg.senderId !== user.uid && 
            lastMsg.status !== "seen" && 
            activeChatUid !== contactUid
          ) {
            // Browser Notification
            if (Notification.permission === "granted" && document.visibilityState !== "visible") {
              new Notification(`Message from ${contactName}`, {
                body: lastMsg.text,
              });
            }

            // In-app Toast with 3s auto-dismiss
            const { dismiss } = toast({
              title: contactName.toUpperCase(),
              description: lastMsg.text,
              className: "bg-background border-2 border-primary/20 rounded-[2rem] shadow-2xl z-[11000] top-4",
            });

            // Automatically dismiss after 3 seconds
            setTimeout(() => dismiss(), 3000);

            try {
              const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3");
              audio.volume = 0.5;
              audio.play();
            } catch (e) {}
          }
        },
        async (serverError) => {
          const pError = new FirestorePermissionError({
            path: `chats/${chatId}/messages`,
            operation: 'list',
          });
          errorEmitter.emit('permission-error', pError);
        }
      );

      listeners.current[chatId] = unsubscribe;
    };

    const unsubscribeContacts1 = onSnapshot(q1, (snap) => {
      snap.docs.forEach(doc => {
        const data = doc.data();
        setupChatListener(data.toId, "Someone");
      });
    });

    const unsubscribeContacts2 = onSnapshot(q2, (snap) => {
      snap.docs.forEach(doc => {
        const data = doc.data();
        setupChatListener(data.fromId, data.fromName || "Someone");
      });
    });

    // --- 2. Request Notifications ---
    const requestsQuery = query(
      collection(db, "requests"),
      where("toId", "==", user.uid),
      where("status", "==", "pending")
    );

    const unsubscribeRequests = onSnapshot(
      requestsQuery, 
      (snapshot) => {
        if (!initialRequestsLoadDone.current) {
          initialRequestsLoadDone.current = true;
          return;
        }

        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const data = change.doc.data();
            const senderName = data.fromName || "Someone";

            if (Notification.permission === "granted" && document.visibilityState !== "visible") {
              new Notification("Connection Request", {
                body: `${senderName} wants to link with you.`,
              });
            }

            const { dismiss } = toast({
              title: "CONNECTION REQUEST",
              description: `${senderName} wants to join your network.`,
              className: "bg-primary text-primary-foreground border-none rounded-[2rem] shadow-2xl z-[11000] top-4",
            });

            setTimeout(() => dismiss(), 3000);

            try {
              const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3");
              audio.volume = 0.4;
              audio.play();
            } catch (e) {}
          }
        });
      },
      async (serverError) => {
        const pError = new FirestorePermissionError({
          path: 'requests',
          operation: 'list',
        });
        errorEmitter.emit('permission-error', pError);
      }
    );

    return () => {
      unsubscribeContacts1();
      unsubscribeContacts2();
      unsubscribeRequests();
      Object.values(listeners.current).forEach(unsub => unsub());
      listeners.current = {};
    };
  }, [db, user, activeChatUid, toast]);

  return null;
}
