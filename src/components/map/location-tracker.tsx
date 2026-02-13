
"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useFirestore, useAuth as useFirebaseInstance } from "@/firebase";
import { doc } from "firebase/firestore";
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";

/**
 * Background component that tracks user location and real-time battery levels.
 * Specifically monitors mobile and tablet nodes for hardware telemetry.
 */
export function LocationTracker() {
  const { user } = useAuth();
  const db = useFirestore();
  const auth = useFirebaseInstance();
  const lastKnownCoords = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!user || !db || !auth) return;

    const userRef = doc(db, "users", user.uid);

    const syncStatus = async (lat?: number, lng?: number) => {
      if (!auth.currentUser) return;

      // Extract battery details specifically for mobile/tablet nodes
      const isMobileOrTablet = window.innerWidth < 1024;
      let batteryLevel: number | null = null;

      if (isMobileOrTablet) {
        try {
          if (typeof navigator !== "undefined" && "getBattery" in navigator) {
            const battery: any = await (navigator as any).getBattery();
            batteryLevel = Math.round(battery.level * 100);
          }
        } catch (e) {
          // Fallback or unsupported remains null
        }
      }

      const updateData: any = {
        isOnline: document.visibilityState === "visible",
        updatedAt: new Date().toISOString()
      };

      if (batteryLevel !== null) {
        updateData.batteryLevel = batteryLevel;
      }

      if (lat !== undefined && lng !== undefined) {
        lastKnownCoords.current = { lat, lng };
        updateData.lastLocation = {
          lat,
          lng,
          timestamp: Date.now()
        };
      } else if (lastKnownCoords.current) {
        updateData.lastLocation = {
          ...lastKnownCoords.current,
          timestamp: Date.now()
        };
      }

      setDocumentNonBlocking(userRef, updateData, { merge: true });
    };

    // 1. Monitor Battery Events
    let batteryObj: any = null;
    const onBatteryChange = () => {
      syncStatus(lastKnownCoords.current?.lat, lastKnownCoords.current?.lng);
    };
    
    if (typeof navigator !== "undefined" && "getBattery" in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        batteryObj = battery;
        battery.addEventListener('levelchange', onBatteryChange);
        battery.addEventListener('chargingchange', onBatteryChange);
        syncStatus();
      });
    }

    // 2. Monitor Location Changes
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          syncStatus(latitude, longitude);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );

      const handleVisibility = () => {
        if (auth.currentUser) {
          syncStatus();
        }
      };
      document.addEventListener("visibilitychange", handleVisibility);

      const heartbeat = setInterval(() => {
        syncStatus();
      }, 120000);

      return () => {
        navigator.geolocation.clearWatch(watchId);
        document.removeEventListener("visibilitychange", handleVisibility);
        clearInterval(heartbeat);
        if (batteryObj) {
          batteryObj.removeEventListener('levelchange', onBatteryChange);
          batteryObj.removeEventListener('chargingchange', onBatteryChange);
        }
        if (auth.currentUser) {
          setDocumentNonBlocking(userRef, { 
            isOnline: false,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }
      };
    }
  }, [user, db, auth]);

  return null;
}
