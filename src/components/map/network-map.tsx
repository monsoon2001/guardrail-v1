
"use client";

import dynamic from "next/dynamic";
import { useAuth } from "@/components/auth/auth-provider";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import { Loader2 } from "lucide-react";

const MapView = dynamic(() => import("./map-view"), { 
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex flex-col items-center justify-center bg-slate-50 text-slate-400 p-12 text-center">
      <Loader2 className="h-8 w-8 animate-spin mb-4" />
      <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Initializing Secure Mapping Grid</p>
    </div>
  )
});

export function NetworkMap({ onChatRequest }: { onChatRequest?: (user: any) => void }) {
  const { user } = useAuth();
  const db = useFirestore();

  const q1 = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, "requests"), where("status", "==", "accepted"), where("fromId", "==", user.uid));
  }, [db, user]);

  const q2 = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, "requests"), where("status", "==", "accepted"), where("toId", "==", user.uid));
  }, [db, user]);

  const { data: sent } = useCollection(q1);
  const { data: received } = useCollection(q2);

  const usersQ = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, "users");
  }, [db]);
  
  const { data: allUsers } = useCollection(usersQ);

  if (!user) return null;

  const contactIds = new Set([
    ...(sent || []).map(r => r.toId),
    ...(received || []).map(r => r.fromId),
    user.uid
  ]);

  const markers = (allUsers || [])
    .filter(u => contactIds.has(u.id) && u.lastLocation)
    .map(u => ({
      id: u.id,
      lat: u.lastLocation.lat,
      lng: u.lastLocation.lng,
      name: u.displayName || "Node",
      photo: u.photoURL,
      isMe: u.id === user.uid,
      guardrailId: u.guardrailId,
      batteryLevel: u.batteryLevel,
      isOnline: u.isOnline || false,
      updatedAt: u.updatedAt || new Date().toISOString()
    }));

  return (
    <div className="h-full w-full relative">
      <MapView 
        markers={markers} 
        onChatRequest={(marker) => onChatRequest?.(marker)}
      />
    </div>
  );
}
