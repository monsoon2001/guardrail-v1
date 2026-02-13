
"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Wifi, WifiOff, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function ConnectivityStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [showNotification, setShowNotification] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setIsOnline(true);
      setShowNotification(true);
      toast({
        title: "Connection Restored",
        description: "Your secure link is back online.",
        className: "bg-green-50 border-green-200 text-green-800",
      });
      setTimeout(() => setShowNotification(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowNotification(true);
      toast({
        variant: "destructive",
        title: "Connection Lost",
        description: "You are currently offline. Local cache active.",
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [toast]);

  if (isOnline) {
    if (!showNotification) return null;
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[2000] animate-in slide-in-from-top-4 duration-500">
        <div className="bg-green-500 text-white px-6 py-2 rounded-full shadow-2xl flex items-center gap-2">
          <Wifi className="h-4 w-4" />
          <span className="text-[10px] font-black uppercase tracking-widest">Network Synchronized</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[2000] w-full max-w-xs px-4 animate-in slide-in-from-top-4 duration-500">
      <Alert variant="destructive" className="shadow-2xl border-2 bg-white/95 backdrop-blur-md">
        <WifiOff className="h-4 w-4" />
        <AlertTitle className="text-[10px] font-black uppercase tracking-widest">Link Failure</AlertTitle>
        <AlertDescription className="text-[9px] font-bold uppercase opacity-70">
          Your node is disconnected from the global network.
        </AlertDescription>
      </Alert>
    </div>
  );
}
