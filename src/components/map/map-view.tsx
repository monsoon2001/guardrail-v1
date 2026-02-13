
"use client";

import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import * as L from "leaflet";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Battery, MessageSquare, Radar, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export type MarkerData = {
  id: string;
  lat: number;
  lng: number;
  name: string;
  photo?: string;
  isMe: boolean;
  guardrailId: string;
  batteryLevel?: number;
  isOnline: boolean;
  updatedAt: string;
};

function MapAutoController({ markers }: { markers: MarkerData[] }) {
  const map = useMap();
  const [hasInitiallyFocused, setHasInitiallyFocused] = useState(false);

  useEffect(() => {
    if (markers.length === 0) return;

    if (!hasInitiallyFocused) {
      const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]));
      
      if (markers.length === 1) {
        map.setView([markers[0].lat, markers[0].lng], 15);
      } else {
        map.fitBounds(bounds, { 
          padding: [70, 70], 
          maxZoom: 15,
          animate: true 
        });
      }
      setHasInitiallyFocused(true);
    }
  }, [markers, map, hasInitiallyFocused]);

  return null;
}

export default function MapView({ 
  markers, 
  onChatRequest 
}: { 
  markers: MarkerData[], 
  onChatRequest: (marker: MarkerData) => void 
}) {
  useEffect(() => {
    // Fix Leaflet marker icon issues
    // @ts-ignore
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });
  }, []);

  const defaultCenter: [number, number] = markers.length > 0 
    ? [markers[0].lat, markers[0].lng] 
    : [0, 0];

  return (
    <div className="h-full w-full rounded-[2.5rem] overflow-hidden border border-slate-100 shadow-inner bg-slate-50">
      <MapContainer 
        center={defaultCenter} 
        zoom={15} 
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {markers.map((marker) => {
          const isActive = marker.isOnline || (Date.now() - new Date(marker.updatedAt).getTime() < 300000);
          const lastSeen = formatDistanceToNow(new Date(marker.updatedAt), { addSuffix: true });
          const statusBorder = isActive 
            ? 'border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)]' 
            : 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]';
          
          const batteryColor = marker.batteryLevel !== undefined && marker.batteryLevel < 20 ? 'text-red-500' : 'text-white';

          return (
            <Marker 
              key={marker.id} 
              position={[marker.lat, marker.lng]}
              icon={L.divIcon({
                className: 'custom-marker',
                html: `
                  <div class="relative flex flex-col items-center">
                    <div class="relative w-11 h-11 rounded-full border-[3px] ${statusBorder} overflow-hidden bg-white flex items-center justify-center z-10 transition-all duration-300">
                      ${marker.photo ? `<img src="${marker.photo}" class="w-full h-full object-cover" />` : `<div class="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400 font-black text-xs">${marker.name.charAt(0)}</div>`}
                    </div>
                    
                    <!-- Mobile Battery Tag -->
                    <div class="absolute -bottom-2 bg-slate-900 px-2 py-0.5 rounded-full shadow-lg border border-white/20 flex items-center justify-center z-30 scale-90">
                      <span class="text-[8px] font-black ${batteryColor} leading-none">
                        ${marker.batteryLevel !== undefined ? `${marker.batteryLevel}%` : '--'}
                      </span>
                    </div>
                    
                    ${isActive ? '<div class="absolute inset-0 w-11 h-11 rounded-full bg-green-500/20 animate-ping -z-10"></div>' : ''}
                  </div>`,
                iconSize: [44, 44],
                iconAnchor: [22, 22]
              })}
            >
              <Popup className="custom-popup" maxWidth={260}>
                <div className="p-3 w-full">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`relative h-12 w-12 rounded-2xl overflow-hidden border-2 ${isActive ? 'border-green-500' : 'border-red-500'} bg-slate-50 shrink-0 shadow-sm`}>
                      {marker.photo && <img src={marker.photo} className="w-full h-full object-cover" alt={marker.name} />}
                      {!marker.photo && <div className="w-full h-full flex items-center justify-center text-slate-300 font-bold uppercase">{marker.name.charAt(0)}</div>}
                    </div>
                    <div className="flex-1 overflow-hidden text-left">
                      <p className="font-black text-slate-900 text-sm truncate uppercase tracking-tight">{marker.isMe ? "Identity: You" : marker.name}</p>
                      <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest truncate">{marker.guardrailId}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="bg-slate-50 rounded-xl p-2.5 flex flex-col items-center justify-center border border-slate-100 transition-colors">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Battery className={`h-3.5 w-3.5 ${marker.batteryLevel !== undefined && marker.batteryLevel < 20 ? 'text-red-500' : 'text-slate-400'}`} />
                        <span className="text-xs font-black text-slate-900">
                          {marker.batteryLevel !== undefined ? `${marker.batteryLevel}%` : "--"}
                        </span>
                      </div>
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Live Power</span>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-2.5 flex flex-col items-center justify-center border border-slate-100 transition-colors">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Zap className={`h-3.5 w-3.5 ${isActive ? 'text-green-500' : 'text-red-500'}`} />
                        <span className="text-xs font-black text-slate-900">{isActive ? "Online" : "Away"}</span>
                      </div>
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Presence</span>
                    </div>
                  </div>

                  <div className="text-center mb-4 border-t border-slate-50 pt-3">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      {isActive ? "Live Telemetry: Synchronized" : `Last Active: ${lastSeen}`}
                    </p>
                  </div>

                  {!marker.isMe && (
                    <div className="flex flex-col gap-2">
                      <Button 
                        size="sm" 
                        className="w-full rounded-xl bg-slate-900 hover:bg-slate-800 text-[10px] font-black uppercase tracking-widest h-10 shadow-lg"
                        onClick={() => onChatRequest(marker)}
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Secure Message
                      </Button>
                      {!isActive && (
                        <Button 
                          variant="outline"
                          size="sm" 
                          className="w-full rounded-xl border-slate-200 text-[10px] font-black uppercase tracking-widest h-10 text-slate-600 hover:bg-slate-50"
                        >
                          <Radar className="h-4 w-4 mr-2" />
                          Request Live
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        <MapAutoController markers={markers} />
      </MapContainer>
    </div>
  );
}
