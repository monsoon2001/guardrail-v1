
// "use client";

// import { useState, useEffect, useRef } from "react";
// import { useAuth } from "@/components/auth/auth-provider";
// import { useFirestore } from "@/firebase";
// import { 
//   doc, 
//   onSnapshot, 
//   updateDoc, 
//   collection, 
//   addDoc, 
// } from "firebase/firestore";
// import { Button } from "@/components/ui/button";
// import { 
//   Phone, 
//   PhoneOff, 
//   Video, 
//   VideoOff, 
//   Mic, 
//   MicOff, 
//   Loader2,
//   ShieldAlert,
//   Clock
// } from "lucide-react";
// import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
// import { useToast } from "@/hooks/use-toast";
// import { errorEmitter } from "@/firebase/error-emitter";
// import { FirestorePermissionError } from "@/firebase/errors";

// interface CallOverlayProps {
//   callId: string;
//   onEnd: () => void;
// }

// const servers = {
//   iceServers: [
//     {
//       urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
//     },
//   ],
//   iceCandidatePoolSize: 10,
// };

// export function CallOverlay({ callId, onEnd }: CallOverlayProps) {
//   const { user } = useAuth();
//   const db = useFirestore();
//   const { toast } = useToast();
  
//   const [callData, setCallData] = useState<any>(null);
//   const [localStream, setLocalStream] = useState<MediaStream | null>(null);
//   const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
//   const [isMuted, setIsMuted] = useState(false);
//   const [isVideoOff, setIsVideoOff] = useState(false);
//   const [isConnecting, setIsConnecting] = useState(true);
//   const [permissionError, setPermissionError] = useState(false);
//   const [callStartTime, setCallStartTime] = useState<number | null>(null);
//   const [duration, setDuration] = useState<string>("0:00");
  
//   const localVideoRef = useRef<HTMLVideoElement>(null);
//   const remoteVideoRef = useRef<HTMLVideoElement>(null);
//   const remoteAudioRef = useRef<HTMLAudioElement>(null);
//   const soundRef = useRef<HTMLAudioElement | null>(null);
//   const pc = useRef<RTCPeerConnection | null>(null);
//   const timeoutRef = useRef<NodeJS.Timeout | null>(null);
//   const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
//   const unsubscribes = useRef<(() => void)[]>([]);
//   const hasLoggedResult = useRef(false);
//   const startAttempted = useRef(false);

//   const stopMediaTracks = (stream: MediaStream | null) => {
//     if (stream) {
//       stream.getTracks().forEach(track => {
//         track.stop();
//         track.enabled = false;
//       });
//     }
//   };

//   const stopSound = () => {
//     if (soundRef.current) {
//       soundRef.current.pause();
//       soundRef.current.currentTime = 0;
//       soundRef.current = null;
//     }
//   };

//   const playSound = (url: string) => {
//     if (soundRef.current) return;
//     const audio = new Audio(url);
//     audio.loop = true;
//     audio.play().catch(() => {});
//     soundRef.current = audio;
//   };

//   const cleanup = () => {
//     unsubscribes.current.forEach(unsub => unsub());
//     unsubscribes.current = [];

//     stopSound();

//     if (timeoutRef.current) {
//       clearTimeout(timeoutRef.current);
//       timeoutRef.current = null;
//     }
//     if (durationIntervalRef.current) {
//       clearInterval(durationIntervalRef.current);
//       durationIntervalRef.current = null;
//     }
    
//     // Explicit hardware cleanup
//     stopMediaTracks(localStream);
//     setLocalStream(null);
//     setRemoteStream(null);

//     if (localVideoRef.current) localVideoRef.current.srcObject = null;
//     if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
//     if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;

//     if (pc.current) {
//       if (pc.current.signalingState !== 'closed') {
//         pc.current.close();
//       }
//       pc.current = null;
//     }
//   };

//   const formatDuration = (ms: number) => {
//     const totalSeconds = Math.floor(ms / 1000);
//     const minutes = Math.floor(totalSeconds / 60);
//     const seconds = totalSeconds % 60;
//     return `${minutes}:${seconds.toString().padStart(2, '0')}`;
//   };

//   useEffect(() => {
//     if (localVideoRef.current && localStream) {
//       localVideoRef.current.srcObject = localStream;
//     }
//   }, [localStream]);

//   useEffect(() => {
//     if (remoteStream) {
//       if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
//       if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;
//     }
//   }, [remoteStream]);

//   useEffect(() => {
//     if (!db || !callId) return;

//     const unsubscribe = onSnapshot(
//       doc(db, "calls", callId), 
//       (snapshot) => {
//         const data = snapshot.data();
//         if (!data) return;
//         setCallData(data);

//         // Caller side: play dialing tone
//         if (data.status === "ringing" && data.callerId === user?.uid) {
//           playSound("https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3");
//         } else if (data.status !== "ringing") {
//           stopSound();
//         }

//         // Auto-missed call timeout
//         if (data.status === "ringing" && data.callerId === user?.uid && !timeoutRef.current) {
//           timeoutRef.current = setTimeout(() => {
//             logCallStatus("missed");
//           }, 35000);
//         }

//         // Start duration timer when status becomes active
//         if (data.status === "active" && !callStartTime) {
//           const start = Date.now();
//           setCallStartTime(start);
//           if (timeoutRef.current) {
//             clearTimeout(timeoutRef.current);
//             timeoutRef.current = null;
//           }
//           if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
//           durationIntervalRef.current = setInterval(() => {
//             setDuration(formatDuration(Date.now() - start));
//           }, 1000);
//         }

//         if (data.status === "ended" || data.status === "missed") {
//           cleanup();
//           onEnd();
//         }
//       },
//       async (serverError) => {
//         const pError = new FirestorePermissionError({
//           path: `calls/${callId}`,
//           operation: 'get',
//         });
//         errorEmitter.emit('permission-error', pError);
//       }
//     );

//     unsubscribes.current.push(unsubscribe);

//     return () => {
//       cleanup();
//     };
//   }, [db, callId, user]);

//   useEffect(() => {
//     if (callData && !startAttempted.current) {
//       startAttempted.current = true;
//       startCall();
//     }
//   }, [callData]);

//   const logCallStatus = async (status: "ended" | "missed") => {
//     if (!db || !callData || hasLoggedResult.current) return;
//     hasLoggedResult.current = true;

//     try {
//       await updateDoc(doc(db, "calls", callId), { status });

//       const finalDuration = callStartTime ? formatDuration(Date.now() - callStartTime) : "0:00";
//       const callTypeName = callData.type.charAt(0).toUpperCase() + callData.type.slice(1);
      
//       const logText = status === "missed" 
//         ? `Missed ${callData.type} call` 
//         : `${callTypeName} call ended • ${finalDuration}`;

//       const chatId = [callData.callerId, callData.calleeId].sort().join("_");
//       await addDoc(collection(db, "chats", chatId, "messages"), {
//         senderId: callData.callerId,
//         text: logText,
//         timestamp: Date.now(),
//         status: "sent"
//       });
//     } catch (e) {
//       console.error("Failed to log call result", e);
//     }
//   };

//   const startCall = async () => {
//     if (pc.current || !callData) return;

//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({
//         video: callData.type === "video",
//         audio: true
//       });
      
//       setLocalStream(stream);

//       const peerConnection = new RTCPeerConnection(servers);
//       pc.current = peerConnection;

//       stream.getTracks().forEach((track) => {
//         peerConnection.addTrack(track, stream);
//       });

//       peerConnection.ontrack = (event) => {
//         const newRemoteStream = event.streams[0];
//         setRemoteStream(newRemoteStream);
//       };

//       setIsConnecting(false);

//       if (callData.callerId === user?.uid) {
//         peerConnection.onicecandidate = (event) => {
//           if (event.candidate && pc.current && pc.current.signalingState !== 'closed') {
//             addDoc(collection(db, "calls", callId, "callerCandidates"), event.candidate.toJSON());
//           }
//         };

//         const offerDescription = await peerConnection.createOffer();
//         await peerConnection.setLocalDescription(offerDescription);

//         await updateDoc(doc(db, "calls", callId), { 
//           offer: { sdp: offerDescription.sdp, type: offerDescription.type } 
//         });

//         const unsubAnswer = onSnapshot(doc(db, "calls", callId), (snapshot) => {
//           const data = snapshot.data();
//           if (data?.answer && pc.current && pc.current.signalingState === 'have-local-offer') {
//             const answerDescription = new RTCSessionDescription(data.answer);
//             pc.current.setRemoteDescription(answerDescription);
//           }
//         });
//         unsubscribes.current.push(unsubAnswer);

//         const unsubCalleeCandidates = onSnapshot(collection(db, "calls", callId, "calleeCandidates"), (snapshot) => {
//           snapshot.docChanges().forEach((change) => {
//             if (change.type === 'added' && pc.current && pc.current.signalingState !== 'closed' && pc.current.remoteDescription) {
//               pc.current.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(() => {});
//             }
//           });
//         });
//         unsubscribes.current.push(unsubCalleeCandidates);

//       } else {
//         peerConnection.onicecandidate = (event) => {
//           if (event.candidate && pc.current && pc.current.signalingState !== 'closed') {
//             addDoc(collection(db, "calls", callId, "calleeCandidates"), event.candidate.toJSON());
//           }
//         };

//         if (callData.offer) {
//           await peerConnection.setRemoteDescription(new RTCSessionDescription(callData.offer));
//           const answerDescription = await peerConnection.createAnswer();
//           await peerConnection.setLocalDescription(answerDescription);

//           await updateDoc(doc(db, "calls", callId), { 
//             answer: { type: answerDescription.type, sdp: answerDescription.sdp },
//             status: "active" 
//           });
//         }

//         const unsubCallerCandidates = onSnapshot(collection(db, "calls", callId, "callerCandidates"), (snapshot) => {
//           snapshot.docChanges().forEach((change) => {
//             if (change.type === 'added' && pc.current && pc.current.signalingState !== 'closed' && pc.current.remoteDescription) {
//               pc.current.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(() => {});
//             }
//           });
//         });
//         unsubscribes.current.push(unsubCallerCandidates);
//       }
//     } catch (e: any) {
//       setPermissionError(true);
//       toast({
//         variant: "destructive",
//         title: "Hardware Access Denied",
//         description: "Please enable camera and microphone access.",
//       });
//     }
//   };

//   const endCall = async () => {
//     await logCallStatus(callStartTime ? "ended" : "missed");
//     cleanup();
//     onEnd();
//   };

//   const toggleMute = () => {
//     if (localStream) {
//       const audioTracks = localStream.getAudioTracks();
//       audioTracks.forEach(track => {
//         track.enabled = !track.enabled;
//       });
//       setIsMuted(!isMuted);
//     }
//   };

//   const toggleVideo = () => {
//     if (localStream) {
//       const videoTracks = localStream.getVideoTracks();
//       videoTracks.forEach(track => {
//         track.enabled = !track.enabled;
//       });
//       setIsVideoOff(!isVideoOff);
//     }
//   };

//   if (!callData) return null;

//   return (
//     <div className="fixed inset-0 z-[1000] bg-slate-950 flex flex-col items-center justify-center animate-in fade-in duration-500">
//       <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

//       <div className="absolute inset-0 w-full h-full overflow-hidden flex items-center justify-center">
//         {callData.type === "video" && remoteStream ? (
//           <video 
//             ref={remoteVideoRef} 
//             autoPlay 
//             playsInline 
//             className="w-full h-full object-cover"
//           />
//         ) : (
//           <div className="flex flex-col items-center gap-6">
//             <Avatar className="h-32 w-32 border-4 border-slate-800 shadow-2xl">
//               <AvatarImage src={callData.callerId === user?.uid ? callData.calleePhoto : callData.callerPhoto} />
//               <AvatarFallback className="bg-slate-900 text-white text-4xl font-black">
//                 {(callData.callerId === user?.uid ? callData.calleeName : callData.callerName)?.charAt(0)}
//               </AvatarFallback>
//             </Avatar>
//             <div className="text-center space-y-2">
//               <h2 className="text-2xl font-black text-white uppercase tracking-widest">
//                 {callData.callerId === user?.uid && isConnecting ? "Connecting..." : (callData.callerId === user?.uid ? callData.calleeName : callData.callerName)}
//               </h2>
//               <div className="flex items-center justify-center gap-2">
//                 <div className={`h-1.5 w-1.5 rounded-full ${callStartTime ? 'bg-green-500 animate-pulse' : 'bg-yellow-500 animate-bounce'}`} />
//                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">
//                   {callStartTime ? `Active: ${duration}` : "Establishing Link"}
//                 </p>
//               </div>
//             </div>
//           </div>
//         )}
//       </div>

//       {callData.type === "video" && !permissionError && (
//         <div className="absolute top-8 right-8 w-32 md:w-48 aspect-video bg-slate-900 rounded-2xl overflow-hidden border-2 border-slate-800 shadow-2xl z-20">
//           <video 
//             ref={localVideoRef} 
//             autoPlay 
//             muted 
//             playsInline 
//             className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
//           />
//           {isVideoOff && (
//             <div className="w-full h-full flex items-center justify-center bg-slate-900">
//               <VideoOff className="h-6 w-6 text-slate-700" />
//             </div>
//           )}
//         </div>
//       )}

//       {permissionError && (
//         <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center">
//           <ShieldAlert className="h-16 w-16 text-red-500 mb-6" />
//           <h3 className="text-xl font-black text-white uppercase mb-2">Hardware Restricted</h3>
//           <p className="text-xs text-slate-400 max-w-xs mb-8 uppercase font-bold tracking-tight">
//             Security policy blocks hardware access.
//           </p>
//           <Button onClick={endCall} variant="destructive" className="rounded-2xl px-12 h-14 font-black uppercase tracking-widest">
//             Close Terminal
//           </Button>
//         </div>
//       )}

//       <div className="absolute bottom-12 flex items-center gap-6 z-[100] animate-in slide-in-from-bottom-8 duration-700">
//         <Button 
//           size="icon" 
//           variant="ghost" 
//           onClick={toggleMute}
//           className={`h-14 w-14 rounded-2xl transition-all ${isMuted ? 'bg-red-500 text-white' : 'bg-slate-900/50 text-white hover:bg-slate-800'}`}
//         >
//           {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
//         </Button>

//         <Button 
//           size="icon" 
//           onClick={endCall}
//           className="h-18 w-18 rounded-3xl bg-red-600 hover:bg-red-700 text-white shadow-2xl shadow-red-900/40 active:scale-90 transition-all"
//         >
//           <PhoneOff className="h-8 w-8" />
//         </Button>

//         {callData.type === "video" && (
//           <Button 
//             size="icon" 
//             variant="ghost" 
//             onClick={toggleVideo}
//             className={`h-14 w-14 rounded-2xl transition-all ${isVideoOff ? 'bg-red-500 text-white' : 'bg-slate-900/50 text-white hover:bg-slate-800'}`}
//           >
//             {isVideoOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
//           </Button>
//         )}
//       </div>

//       <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur-md px-4 py-1.5 rounded-full border border-slate-800/50 flex items-center gap-2">
//         <Clock className="h-3 w-3 text-slate-400" />
//         <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest leading-none">
//           {callStartTime ? `Talk Time: ${duration}` : "Establishing Link"}
//         </span>
//       </div>
//     </div>
//   );
// }






// "use client";

// import { useState, useEffect, useRef } from "react";
// import { useAuth } from "@/components/auth/auth-provider";
// import { useFirestore } from "@/firebase";
// import { 
//   doc, 
//   onSnapshot, 
//   updateDoc, 
//   collection, 
//   addDoc, 
// } from "firebase/firestore";
// import { Button } from "@/components/ui/button";
// import { 
//   Phone, 
//   PhoneOff, 
//   Video, 
//   VideoOff, 
//   Mic, 
//   MicOff, 
//   Loader2,
//   ShieldAlert,
//   Clock
// } from "lucide-react";
// import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
// import { useToast } from "@/hooks/use-toast";
// import { errorEmitter } from "@/firebase/error-emitter";
// import { FirestorePermissionError } from "@/firebase/errors";

// interface CallOverlayProps {
//   callId: string;
//   onEnd: () => void;
// }

// const servers = {
//   iceServers: [
//     {
//       urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
//     },
//   ],
//   iceCandidatePoolSize: 10,
// };

// export function CallOverlay({ callId, onEnd }: CallOverlayProps) {
//   const { user } = useAuth();
//   const db = useFirestore();
//   const { toast } = useToast();
  
//   const [callData, setCallData] = useState<any>(null);
//   const [localStream, setLocalStream] = useState<MediaStream | null>(null);
//   const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
//   const [isMuted, setIsMuted] = useState(false);
//   const [isVideoOff, setIsVideoOff] = useState(false);
//   const [isConnecting, setIsConnecting] = useState(true);
//   const [permissionError, setPermissionError] = useState(false);
//   const [callStartTime, setCallStartTime] = useState<number | null>(null);
//   const [duration, setDuration] = useState<string>("0:00");
  
//   const localVideoRef = useRef<HTMLVideoElement>(null);
//   const remoteVideoRef = useRef<HTMLVideoElement>(null);
//   const remoteAudioRef = useRef<HTMLAudioElement>(null);
//   const soundRef = useRef<HTMLAudioElement | null>(null);
  
//   // CRITICAL: Refs to ensure hardware is released even if state is stale
//   const localStreamRef = useRef<MediaStream | null>(null);
//   const remoteStreamRef = useRef<MediaStream | null>(null);
//   const pc = useRef<RTCPeerConnection | null>(null);
  
//   const timeoutRef = useRef<NodeJS.Timeout | null>(null);
//   const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
//   const unsubscribes = useRef<(() => void)[]>([]);
//   const hasLoggedResult = useRef(false);
//   const startAttempted = useRef(false);

//   const stopStream = (streamRef: React.MutableRefObject<MediaStream | null>) => {
//     if (streamRef.current) {
//       streamRef.current.getTracks().forEach(track => {
//         track.stop();
//         track.enabled = false;
//       });
//       streamRef.current = null;
//     }
//   };

//   const stopSound = () => {
//     if (soundRef.current) {
//       soundRef.current.pause();
//       soundRef.current.currentTime = 0;
//       soundRef.current = null;
//     }
//   };

//   const playSound = (url: string) => {
//     if (soundRef.current) return;
//     const audio = new Audio(url);
//     audio.loop = true;
//     audio.play().catch(() => {});
//     soundRef.current = audio;
//   };

//   const cleanup = () => {
//     unsubscribes.current.forEach(unsub => unsub());
//     unsubscribes.current = [];

//     stopSound();

//     if (timeoutRef.current) {
//       clearTimeout(timeoutRef.current);
//       timeoutRef.current = null;
//     }
//     if (durationIntervalRef.current) {
//       clearInterval(durationIntervalRef.current);
//       durationIntervalRef.current = null;
//     }
    
//     // Explicitly kill hardware via refs
//     stopStream(localStreamRef);
//     stopStream(remoteStreamRef);
    
//     setLocalStream(null);
//     setRemoteStream(null);

//     if (localVideoRef.current) localVideoRef.current.srcObject = null;
//     if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
//     if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;

//     if (pc.current) {
//       if (pc.current.signalingState !== 'closed') {
//         pc.current.close();
//       }
//       pc.current = null;
//     }
//   };

//   const formatDuration = (ms: number) => {
//     const totalSeconds = Math.floor(ms / 1000);
//     const minutes = Math.floor(totalSeconds / 60);
//     const seconds = totalSeconds % 60;
//     return `${minutes}:${seconds.toString().padStart(2, '0')}`;
//   };

//   useEffect(() => {
//     if (localVideoRef.current && localStream) {
//       localVideoRef.current.srcObject = localStream;
//     }
//   }, [localStream]);

//   useEffect(() => {
//     if (remoteStream) {
//       if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
//       if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;
//     }
//   }, [remoteStream]);

//   useEffect(() => {
//     if (!db || !callId) return;

//     const unsubscribe = onSnapshot(
//       doc(db, "calls", callId), 
//       (snapshot) => {
//         const data = snapshot.data();
//         if (!data) return;
//         setCallData(data);

//         // Outgoing: Dialing sound
//         if (data.status === "ringing" && data.callerId === user?.uid) {
//           playSound("https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3");
//         } else if (data.status !== "ringing") {
//           stopSound();
//         }

//         if (data.status === "ringing" && data.callerId === user?.uid && !timeoutRef.current) {
//           timeoutRef.current = setTimeout(() => {
//             logCallStatus("missed");
//           }, 35000);
//         }

//         if (data.status === "active" && !callStartTime) {
//           const start = Date.now();
//           setCallStartTime(start);
//           if (timeoutRef.current) {
//             clearTimeout(timeoutRef.current);
//             timeoutRef.current = null;
//           }
//           if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
//           durationIntervalRef.current = setInterval(() => {
//             setDuration(formatDuration(Date.now() - start));
//           }, 1000);
//         }

//         if (data.status === "ended" || data.status === "missed") {
//           cleanup();
//           onEnd();
//         }
//       },
//       async (serverError) => {
//         const pError = new FirestorePermissionError({
//           path: `calls/${callId}`,
//           operation: 'get',
//         });
//         errorEmitter.emit('permission-error', pError);
//       }
//     );

//     unsubscribes.current.push(unsubscribe);

//     return () => {
//       cleanup();
//     };
//   }, [db, callId, user]);

//   useEffect(() => {
//     if (callData && !startAttempted.current) {
//       startAttempted.current = true;
//       startCall();
//     }
//   }, [callData]);

//   const logCallStatus = async (status: "ended" | "missed") => {
//     if (!db || !callData || hasLoggedResult.current) return;
//     hasLoggedResult.current = true;

//     try {
//       await updateDoc(doc(db, "calls", callId), { status });

//       const finalDuration = callStartTime ? formatDuration(Date.now() - callStartTime) : "0:00";
//       const callTypeName = callData.type.charAt(0).toUpperCase() + callData.type.slice(1);
      
//       const logText = status === "missed" 
//         ? `Missed ${callData.type} call` 
//         : `${callTypeName} call ended • ${finalDuration}`;

//       const chatId = [callData.callerId, callData.calleeId].sort().join("_");
//       await addDoc(collection(db, "chats", chatId, "messages"), {
//         senderId: callData.callerId,
//         text: logText,
//         timestamp: Date.now(),
//         status: "sent"
//       });
//     } catch (e) {
//       console.error("Failed to log call result", e);
//     }
//   };

//   const startCall = async () => {
//     if (pc.current || !callData) return;

//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({
//         video: callData.type === "video",
//         audio: true
//       });
      
//       setLocalStream(stream);
//       localStreamRef.current = stream;

//       const peerConnection = new RTCPeerConnection(servers);
//       pc.current = peerConnection;

//       stream.getTracks().forEach((track) => {
//         peerConnection.addTrack(track, stream);
//       });

//       peerConnection.ontrack = (event) => {
//         const newRemoteStream = event.streams[0];
//         setRemoteStream(newRemoteStream);
//         remoteStreamRef.current = newRemoteStream;
//       };

//       setIsConnecting(false);

//       if (callData.callerId === user?.uid) {
//         peerConnection.onicecandidate = (event) => {
//           if (event.candidate && pc.current && pc.current.signalingState !== 'closed') {
//             addDoc(collection(db, "calls", callId, "callerCandidates"), event.candidate.toJSON());
//           }
//         };

//         const offerDescription = await peerConnection.createOffer();
//         await peerConnection.setLocalDescription(offerDescription);

//         await updateDoc(doc(db, "calls", callId), { 
//           offer: { sdp: offerDescription.sdp, type: offerDescription.type } 
//         });

//         const unsubAnswer = onSnapshot(doc(db, "calls", callId), (snapshot) => {
//           const data = snapshot.data();
//           if (data?.answer && pc.current && pc.current.signalingState === 'have-local-offer') {
//             const answerDescription = new RTCSessionDescription(data.answer);
//             pc.current.setRemoteDescription(answerDescription);
//           }
//         });
//         unsubscribes.current.push(unsubAnswer);

//         const unsubCalleeCandidates = onSnapshot(collection(db, "calls", callId, "calleeCandidates"), (snapshot) => {
//           snapshot.docChanges().forEach((change) => {
//             if (change.type === 'added' && pc.current && pc.current.signalingState !== 'closed' && pc.current.remoteDescription) {
//               pc.current.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(() => {});
//             }
//           });
//         });
//         unsubscribes.current.push(unsubCalleeCandidates);

//       } else {
//         peerConnection.onicecandidate = (event) => {
//           if (event.candidate && pc.current && pc.current.signalingState !== 'closed') {
//             addDoc(collection(db, "calls", callId, "calleeCandidates"), event.candidate.toJSON());
//           }
//         };

//         if (callData.offer) {
//           await peerConnection.setRemoteDescription(new RTCSessionDescription(callData.offer));
//           const answerDescription = await peerConnection.createAnswer();
//           await peerConnection.setLocalDescription(answerDescription);

//           await updateDoc(doc(db, "calls", callId), { 
//             answer: { type: answerDescription.type, sdp: answerDescription.sdp },
//             status: "active" 
//           });
//         }

//         const unsubCallerCandidates = onSnapshot(collection(db, "calls", callId, "callerCandidates"), (snapshot) => {
//           snapshot.docChanges().forEach((change) => {
//             if (change.type === 'added' && pc.current && pc.current.signalingState !== 'closed' && pc.current.remoteDescription) {
//               pc.current.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(() => {});
//             }
//           });
//         });
//         unsubscribes.current.push(unsubCallerCandidates);
//       }
//     } catch (e: any) {
//       setPermissionError(true);
//       toast({
//         variant: "destructive",
//         title: "Hardware Restricted",
//         description: "Secure terminal requires access to audio/video components.",
//       });
//     }
//   };

//   const endCall = async () => {
//     await logCallStatus(callStartTime ? "ended" : "missed");
//     cleanup();
//     onEnd();
//   };

//   const toggleMute = () => {
//     if (localStreamRef.current) {
//       const audioTracks = localStreamRef.current.getAudioTracks();
//       audioTracks.forEach(track => {
//         track.enabled = !track.enabled;
//       });
//       setIsMuted(!isMuted);
//     }
//   };

//   const toggleVideo = () => {
//     if (localStreamRef.current) {
//       const videoTracks = localStreamRef.current.getVideoTracks();
//       videoTracks.forEach(track => {
//         track.enabled = !track.enabled;
//       });
//       setIsVideoOff(!isVideoOff);
//     }
//   };

//   if (!callData) return null;

//   return (
//     <div className="fixed inset-0 z-[1000] bg-slate-950 flex flex-col items-center justify-center animate-in fade-in duration-500">
//       <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

//       <div className="absolute inset-0 w-full h-full overflow-hidden flex items-center justify-center">
//         {callData.type === "video" && remoteStream ? (
//           <video 
//             ref={remoteVideoRef} 
//             autoPlay 
//             playsInline 
//             className="w-full h-full object-cover"
//           />
//         ) : (
//           <div className="flex flex-col items-center gap-6">
//             <Avatar className="h-32 w-32 border-4 border-slate-800 shadow-2xl">
//               <AvatarImage src={callData.callerId === user?.uid ? callData.calleePhoto : callData.callerPhoto} />
//               <AvatarFallback className="bg-slate-900 text-white text-4xl font-black">
//                 {(callData.callerId === user?.uid ? callData.calleeName : callData.callerName)?.charAt(0)}
//               </AvatarFallback>
//             </Avatar>
//             <div className="text-center space-y-2">
//               <h2 className="text-2xl font-black text-white uppercase tracking-widest">
//                 {callData.callerId === user?.uid && isConnecting ? "Connecting..." : (callData.callerId === user?.uid ? callData.calleeName : callData.callerName)}
//               </h2>
//               <div className="flex items-center justify-center gap-2">
//                 <div className={`h-1.5 w-1.5 rounded-full ${callStartTime ? 'bg-green-500 animate-pulse' : 'bg-yellow-500 animate-bounce'}`} />
//                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">
//                   {callStartTime ? `Active: ${duration}` : "Establishing Link"}
//                 </p>
//               </div>
//             </div>
//           </div>
//         )}
//       </div>

//       {callData.type === "video" && !permissionError && (
//         <div className="absolute top-8 right-8 w-32 md:w-48 aspect-video bg-slate-900 rounded-2xl overflow-hidden border-2 border-slate-800 shadow-2xl z-20">
//           <video 
//             ref={localVideoRef} 
//             autoPlay 
//             muted 
//             playsInline 
//             className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
//           />
//           {isVideoOff && (
//             <div className="w-full h-full flex items-center justify-center bg-slate-900">
//               <VideoOff className="h-6 w-6 text-slate-700" />
//             </div>
//           )}
//         </div>
//       )}

//       {permissionError && (
//         <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center">
//           <ShieldAlert className="h-16 w-16 text-red-500 mb-6" />
//           <h3 className="text-xl font-black text-white uppercase mb-2">Hardware Restricted</h3>
//           <p className="text-xs text-slate-400 max-w-xs mb-8 uppercase font-bold tracking-tight">
//             Terminal access blocked by device policy.
//           </p>
//           <Button onClick={endCall} variant="destructive" className="rounded-2xl px-12 h-14 font-black uppercase tracking-widest">
//             Close Terminal
//           </Button>
//         </div>
//       )}

//       <div className="absolute bottom-12 flex items-center gap-6 z-[100] animate-in slide-in-from-bottom-8 duration-700">
//         <Button 
//           size="icon" 
//           variant="ghost" 
//           onClick={toggleMute}
//           className={`h-14 w-14 rounded-2xl transition-all ${isMuted ? 'bg-red-500 text-white' : 'bg-slate-900/50 text-white hover:bg-slate-800'}`}
//         >
//           {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
//         </Button>

//         <Button 
//           size="icon" 
//           onClick={endCall}
//           className="h-18 w-18 rounded-3xl bg-red-600 hover:bg-red-700 text-white shadow-2xl shadow-red-900/40 active:scale-90 transition-all"
//         >
//           <PhoneOff className="h-8 w-8" />
//         </Button>

//         {callData.type === "video" && (
//           <Button 
//             size="icon" 
//             variant="ghost" 
//             onClick={toggleVideo}
//             className={`h-14 w-14 rounded-2xl transition-all ${isVideoOff ? 'bg-red-500 text-white' : 'bg-slate-900/50 text-white hover:bg-slate-800'}`}
//           >
//             {isVideoOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
//           </Button>
//         )}
//       </div>

//       <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur-md px-4 py-1.5 rounded-full border border-slate-800/50 flex items-center gap-2">
//         <Clock className="h-3 w-3 text-slate-400" />
//         <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest leading-none">
//           {callStartTime ? `Talk Time: ${duration}` : "Establishing Link"}
//         </span>
//       </div>
//     </div>
//   );
// }






"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useFirestore } from "@/firebase";
import { 
  doc, 
  onSnapshot, 
  updateDoc, 
  collection, 
  addDoc, 
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { 
  Phone, 
  PhoneOff, 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Loader2,
  ShieldAlert,
  Clock
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

interface CallOverlayProps {
  callId: string;
  onEnd: () => void;
}

const servers = {
  iceServers: [
    {
      urls: [
        'stun:stun1.l.google.com:19302', 
        'stun:stun2.l.google.com:19302',
        'stun:stun3.l.google.com:19302',
        'stun:stun4.l.google.com:19302'
      ],
    },
  ],
  iceCandidatePoolSize: 10,
};

export function CallOverlay({ callId, onEnd }: CallOverlayProps) {
  const { user } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [callData, setCallData] = useState<any>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [permissionError, setPermissionError] = useState(false);
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const [duration, setDuration] = useState<string>("0:00");
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const soundRef = useRef<HTMLAudioElement | null>(null);
  
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const unsubscribes = useRef<(() => void)[]>([]);
  const hasLoggedResult = useRef(false);
  const setupAttempted = useRef(false);
  const signalingStarted = useRef(false);
  
  const iceBuffer = useRef<RTCIceCandidateInit[]>([]);

  const stopStream = (streamRef: React.MutableRefObject<MediaStream | null>) => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.enabled = false;
        track.stop();
      });
      streamRef.current = null;
    }
  };

  const stopSound = () => {
    if (soundRef.current) {
      soundRef.current.pause();
      soundRef.current.currentTime = 0;
      soundRef.current = null;
    }
  };

  const playSound = (url: string) => {
    if (soundRef.current) return;
    const audio = new Audio(url);
    audio.loop = true;
    audio.play().catch(() => {});
    soundRef.current = audio;
  };

  const cleanup = () => {
    unsubscribes.current.forEach(unsub => unsub());
    unsubscribes.current = [];
    stopSound();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    
    stopStream(localStreamRef);
    stopStream(remoteStreamRef);
    setLocalStream(null);
    setRemoteStream(null);

    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;

    if (pc.current) {
      if (pc.current.signalingState !== 'closed') pc.current.close();
      pc.current = null;
    }
    iceBuffer.current = [];
  };

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (remoteStream) {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Main Call Monitoring Effect
  useEffect(() => {
    if (!db || !callId) return;

    const unsubscribe = onSnapshot(
      doc(db, "calls", callId), 
      (snapshot) => {
        const data = snapshot.data();
        if (!data) return;
        setCallData(data);

        // Sound Management
        if (data.status === "ringing" && data.callerId === user?.uid) {
          playSound("https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3");
        } else {
          stopSound();
        }

        // Timeout for missed calls
        if (data.status === "ringing" && data.callerId === user?.uid && !timeoutRef.current) {
          timeoutRef.current = setTimeout(() => logCallStatus("missed"), 35000);
        }

        // Active Call Duration Tracking
        if (data.status === "active" && !callStartTime) {
          const start = Date.now();
          setCallStartTime(start);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = setInterval(() => {
            setDuration(formatDuration(Date.now() - start));
          }, 1000);
        }

        // Handshake: Callee reacts to offer
        if (!signalingStarted.current && data.offer && data.calleeId === user?.uid && pc.current) {
          handleIncomingOffer(data.offer);
        }

        // Handshake: Caller reacts to answer
        if (!signalingStarted.current && data.answer && data.callerId === user?.uid && pc.current && pc.current.signalingState === 'have-local-offer') {
          handleIncomingAnswer(data.answer);
        }

        if (data.status === "ended" || data.status === "missed") {
          cleanup();
          onEnd();
        }
      },
      async (serverError) => {
        const pError = new FirestorePermissionError({ path: `calls/${callId}`, operation: 'get' });
        errorEmitter.emit('permission-error', pError);
      }
    );

    unsubscribes.current.push(unsubscribe);
    return () => cleanup();
  }, [db, callId, user]);

  // Setup Peer Connection & Local Media
  useEffect(() => {
    if (callData && !setupAttempted.current) {
      setupAttempted.current = true;
      initializeMediaAndConnection();
    }
  }, [callData]);

  const initializeMediaAndConnection = async () => {
    if (pc.current || !callData) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: callData.type === "video" ? {
          facingMode: "user",
          width: { ideal: 640 }, // Lowering for better mobile compatibility
          height: { ideal: 480 }
        } : false,
        audio: true
      });
      
      setLocalStream(stream);
      localStreamRef.current = stream;

      const peerConnection = new RTCPeerConnection(servers);
      pc.current = peerConnection;

      stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

      peerConnection.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
          remoteStreamRef.current = event.streams[0];
        }
      };

      peerConnection.onicecandidate = (event) => {
        if (event.candidate && pc.current && pc.current.signalingState !== 'closed') {
          const collectionName = callData.callerId === user?.uid ? "callerCandidates" : "calleeCandidates";
          addDoc(collection(db, "calls", callId, collectionName), event.candidate.toJSON());
        }
      };

      setIsConnecting(false);

      // Setup Listeners for Candidates
      const candidatesPath = callData.callerId === user?.uid ? "calleeCandidates" : "callerCandidates";
      const unsubCandidates = onSnapshot(collection(db, "calls", callId, candidatesPath), (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' && pc.current && pc.current.signalingState !== 'closed') {
            const candidate = change.doc.data() as RTCIceCandidateInit;
            if (pc.current?.remoteDescription) {
              pc.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
            } else {
              iceBuffer.current.push(candidate);
            }
          }
        });
      });
      unsubscribes.current.push(unsubCandidates);

      // If I am the caller, start the offer process
      if (callData.callerId === user?.uid) {
        const offerDescription = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offerDescription);
        await updateDoc(doc(db, "calls", callId), { 
          offer: { sdp: offerDescription.sdp, type: offerDescription.type } 
        });
      } else if (callData.offer) {
        // If I am the callee and offer already exists
        handleIncomingOffer(callData.offer);
      }
    } catch (e: any) {
      setPermissionError(true);
      toast({ variant: "destructive", title: "Hardware Restricted", description: "Terminal access denied." });
    }
  };

  const handleIncomingOffer = async (offer: any) => {
    if (!pc.current || signalingStarted.current) return;
    signalingStarted.current = true;
    try {
      await pc.current.setRemoteDescription(new RTCSessionDescription(offer));
      while (iceBuffer.current.length > 0) {
        const candidate = iceBuffer.current.shift();
        if (candidate) await pc.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      }
      const answerDescription = await pc.current.createAnswer();
      await pc.current.setLocalDescription(answerDescription);
      await updateDoc(doc(db, "calls", callId), { 
        answer: { type: answerDescription.type, sdp: answerDescription.sdp },
        status: "active" 
      });
    } catch (e) {
      console.error("Failed to handle incoming offer", e);
    }
  };

  const handleIncomingAnswer = async (answer: any) => {
    if (!pc.current || pc.current.signalingState !== 'have-local-offer') return;
    signalingStarted.current = true;
    try {
      await pc.current.setRemoteDescription(new RTCSessionDescription(answer));
      while (iceBuffer.current.length > 0) {
        const candidate = iceBuffer.current.shift();
        if (candidate) await pc.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      }
    } catch (e) {
      console.error("Failed to handle incoming answer", e);
    }
  };

  const logCallStatus = async (status: "ended" | "missed") => {
    if (!db || !callData || hasLoggedResult.current) return;
    hasLoggedResult.current = true;
    try {
      await updateDoc(doc(db, "calls", callId), { status });
      const finalDuration = callStartTime ? formatDuration(Date.now() - callStartTime) : "0:00";
      const callTypeName = callData.type.charAt(0).toUpperCase() + callData.type.slice(1);
      const logText = status === "missed" ? `Missed ${callData.type} call` : `${callTypeName} call ended • ${finalDuration}`;
      const chatId = [callData.callerId, callData.calleeId].sort().join("_");
      await addDoc(collection(db, "chats", chatId, "messages"), {
        senderId: callData.callerId,
        text: logText,
        timestamp: Date.now(),
        status: "sent"
      });
    } catch (e) {}
  };

  const endCall = async () => {
    await logCallStatus(callStartTime ? "ended" : "missed");
    cleanup();
    onEnd();
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => track.enabled = !track.enabled);
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => track.enabled = !track.enabled);
      setIsVideoOff(!isVideoOff);
    }
  };

  if (!callData) return null;

  return (
    <div className="fixed inset-0 z-[10000] bg-slate-950 flex flex-col items-center justify-center animate-in fade-in duration-500">
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
      <div className="absolute inset-0 w-full h-full overflow-hidden flex items-center justify-center">
        <video 
          ref={remoteVideoRef} 
          autoPlay 
          playsInline 
          className={`w-full h-full object-cover ${(callData.type !== "video" || !remoteStream) ? 'hidden' : ''}`}
        />
        {(callData.type !== "video" || !remoteStream) && (
          <div className="flex flex-col items-center gap-6">
            <Avatar className="h-32 w-32 border-4 border-slate-800 shadow-2xl">
              <AvatarImage src={callData.callerId === user?.uid ? callData.calleePhoto : callData.callerPhoto} />
              <AvatarFallback className="bg-slate-900 text-white text-4xl font-black">
                {(callData.callerId === user?.uid ? callData.calleeName : callData.callerName)?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-black text-white uppercase tracking-widest">
                {callData.callerId === user?.uid && isConnecting ? "Connecting..." : (callData.callerId === user?.uid ? callData.calleeName : callData.callerName)}
              </h2>
              <div className="flex items-center justify-center gap-2">
                <div className={`h-1.5 w-1.5 rounded-full ${callStartTime ? 'bg-green-500 animate-pulse' : 'bg-yellow-500 animate-bounce'}`} />
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">
                  {callStartTime ? `Active: ${duration}` : "Establishing Link"}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={`absolute top-8 right-8 w-32 md:w-48 aspect-video bg-slate-900 rounded-2xl overflow-hidden border-2 border-slate-800 shadow-2xl z-20 ${callData.type !== "video" || permissionError ? 'hidden' : ''}`}>
        <video ref={localVideoRef} autoPlay muted playsInline className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`} />
        {isVideoOff && (
          <div className="w-full h-full flex items-center justify-center bg-slate-900">
            <VideoOff className="h-6 w-6 text-slate-700" />
          </div>
        )}
      </div>

      {permissionError && (
        <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center">
          <ShieldAlert className="h-16 w-16 text-red-500 mb-6" />
          <h3 className="text-xl font-black text-white uppercase mb-2">Hardware Restricted</h3>
          <Button onClick={endCall} variant="destructive" className="rounded-2xl px-12 h-14 font-black uppercase tracking-widest">Close Terminal</Button>
        </div>
      )}

      <div className="absolute bottom-12 flex items-center gap-6 z-[100] animate-in slide-in-from-bottom-8 duration-700">
        <Button size="icon" variant="ghost" onClick={toggleMute} className={`h-14 w-14 rounded-2xl transition-all ${isMuted ? 'bg-red-500 text-white' : 'bg-slate-900/50 text-white hover:bg-slate-800'}`}>
          {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </Button>
        <Button size="icon" onClick={endCall} className="h-18 w-18 rounded-3xl bg-red-600 hover:bg-red-700 text-white shadow-2xl active:scale-90 transition-all">
          <PhoneOff className="h-8 w-8" />
        </Button>
        {callData.type === "video" && (
          <Button size="icon" variant="ghost" onClick={toggleVideo} className={`h-14 w-14 rounded-2xl transition-all ${isVideoOff ? 'bg-red-500 text-white' : 'bg-slate-900/50 text-white hover:bg-slate-800'}`}>
            {isVideoOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
          </Button>
        )}
      </div>

      <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur-md px-4 py-1.5 rounded-full border border-slate-800/50 flex items-center gap-2">
        <Clock className="h-3 w-3 text-slate-400" />
        <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest leading-none">
          {callStartTime ? `Talk Time: ${duration}` : "Establishing Link"}
        </span>
      </div>
    </div>
  );
}
