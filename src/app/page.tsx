
// "use client";

// import { useAuth } from "@/components/auth/auth-provider";
// import { useAuth as useFirebaseInstance, useFirestore } from "@/firebase";
// import { Button } from "@/components/ui/button";
// import { signOut } from "firebase/auth";
// import { doc, updateDoc, query, collection, where, onSnapshot, addDoc } from "firebase/firestore";
// import { Loader2, MessageSquare, Map as MapIcon, User as UserIcon, ArrowLeft, Fingerprint, Edit2, Check, Shield, LogOut, AlertTriangle, Sun, Moon, Phone, PhoneIncoming, X } from "lucide-react";
// import { useState, useEffect, useRef } from "react";
// import { useToast } from "@/hooks/use-toast";
// import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
// import { ChatContainer } from "@/components/chat/chat-container";
// import { NetworkMap } from "@/components/map/network-map";
// import { LocationTracker } from "@/components/map/location-tracker";
// import { NotificationManager } from "@/components/chat/notification-manager";
// import { Switch } from "@/components/ui/switch";
// import { Input } from "@/components/ui/input";
// import { verifyWithBiometrics, checkBiometricAvailability } from "@/lib/biometrics";
// import { useTheme } from "@/components/theme-provider";
// import { CallOverlay } from "@/components/chat/call-overlay";
// import { errorEmitter } from "@/firebase/error-emitter";
// import { FirestorePermissionError } from "@/firebase/errors";
// import {
//   AlertDialog,
//   AlertDialogAction,
//   AlertDialogCancel,
//   AlertDialogContent,
//   AlertDialogDescription,
//   AlertDialogFooter,
//   AlertDialogHeader,
//   AlertDialogTitle,
// } from "@/components/ui/alert-dialog";

// export default function Home() {
//   const { user, profile, loading, signInWithGoogle } = useAuth();
//   const auth = useFirebaseInstance();
//   const db = useFirestore();
//   const { theme, toggleTheme } = useTheme();
//   const [isSigningIn, setIsSigningIn] = useState(false);
//   const [activeTab, setActiveTab] = useState<"messages" | "map" | "profile">("messages");
//   const [selectedChatUser, setSelectedChatUser] = useState<any>(null);
//   const [biometricVerified, setBiometricVerified] = useState(false);
//   const [isVerifying, setIsVerifying] = useState(false);
//   const [verificationError, setVerificationError] = useState<string | null>(null);
//   const [isEditingName, setIsEditingName] = useState(false);
//   const [newName, setNewName] = useState("");
//   const [isMobileOrTablet, setIsMobileOrTablet] = useState<boolean | null>(null);
//   const [totalUnread, setTotalUnread] = useState(0);
//   const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  
//   // Call State
//   const [incomingCallData, setIncomingCallData] = useState<any>(null);
//   const [activeCallId, setActiveCallId] = useState<string | null>(null);
//   const incomingRingtoneRef = useRef<HTMLAudioElement | null>(null);
  
//   const { toast } = useToast();

//   useEffect(() => {
//     if (profile) {
//       setNewName(profile.displayName || user?.displayName || "");
//     }
//   }, [profile, user]);

//   useEffect(() => {
//     const checkDevice = () => {
//       setIsMobileOrTablet(window.innerWidth < 1024);
//     };
//     checkDevice();
//     window.addEventListener("resize", checkDevice);
//     return () => window.removeEventListener("resize", checkDevice);
//   }, []);

//   // Monitor Incoming Calls Globally
//   useEffect(() => {
//     if (!db || !user) return;

//     const q = query(
//       collection(db, "calls"),
//       where("calleeId", "==", user.uid),
//       where("status", "==", "ringing")
//     );

//     const unsubscribe = onSnapshot(
//       q, 
//       (snapshot) => {
//         if (!snapshot.empty) {
//           const sortedDocs = [...snapshot.docs].sort((a, b) => {
//             const timeA = a.data().timestamp || 0;
//             const timeB = b.data().timestamp || 0;
//             return timeB - timeA;
//           });
//           const call = { id: sortedDocs[0].id, ...sortedDocs[0].data() };
//           setIncomingCallData(call);

//           // Play simple incoming sound if not in overlay already
//           if (!activeCallId && !incomingRingtoneRef.current) {
//             const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/135/135-preview.mp3");
//             audio.loop = true;
//             audio.play().catch(() => {});
//             incomingRingtoneRef.current = audio;
//           }
//         } else {
//           setIncomingCallData(null);
//           if (incomingRingtoneRef.current) {
//             incomingRingtoneRef.current.pause();
//             incomingRingtoneRef.current = null;
//           }
//         }
//       },
//       async (serverError) => {
//         const pError = new FirestorePermissionError({
//           path: 'calls',
//           operation: 'list',
//         });
//         errorEmitter.emit('permission-error', pError);
//       }
//     );

//     return () => {
//       unsubscribe();
//       if (incomingRingtoneRef.current) {
//         incomingRingtoneRef.current.pause();
//         incomingRingtoneRef.current = null;
//       }
//     };
//   }, [db, user, activeCallId]);

//   // Monitor Total Unread Count
//   useEffect(() => {
//     if (!db || !user) return;

//     const unreadListeners: { [chatId: string]: () => void } = {};
//     const chatUnreadCounts: { [chatId: string]: number } = {};

//     const setupChatUnreadListener = (contactUid: string) => {
//       const chatId = [user.uid, contactUid].sort().join("_");
//       if (unreadListeners[chatId]) return;

//       const msgQuery = query(
//         collection(db, "chats", chatId, "messages"),
//         where("status", "!=", "seen")
//       );

//       const unsubscribe = onSnapshot(msgQuery, (snapshot) => {
//         const unreadCount = snapshot.docs.filter(doc => doc.data().senderId !== user.uid).length;
//         chatUnreadCounts[chatId] = unreadCount;
//         const total = Object.values(chatUnreadCounts).reduce((a, b) => a + b, 0);
//         setTotalUnread(total);
//       });

//       unreadListeners[chatId] = unsubscribe;
//     };

//     const q1 = query(collection(db, "requests"), where("status", "==", "accepted"), where("fromId", "==", user.uid));
//     const q2 = query(collection(db, "requests"), where("status", "==", "accepted"), where("toId", "==", user.uid));

//     const unsubRequests1 = onSnapshot(q1, (snap) => {
//       snap.docs.forEach(doc => setupChatUnreadListener(doc.data().toId));
//     });

//     const unsubRequests2 = onSnapshot(q2, (snap) => {
//       snap.docs.forEach(doc => setupChatUnreadListener(doc.data().fromId));
//     });

//     return () => {
//       unsubRequests1();
//       unsubRequests2();
//       Object.values(unreadListeners).forEach(unsub => unsub());
//     };
//   }, [db, user]);

//   const handleDeclineCall = async () => {
//     if (!db || !incomingCallData) return;
    
//     try {
//       const callRef = doc(db, "calls", incomingCallData.id);
//       await updateDoc(callRef, { status: "missed" });
      
//       const chatId = [incomingCallData.callerId, incomingCallData.calleeId].sort().join("_");
//       await addDoc(collection(db, "chats", chatId, "messages"), {
//         senderId: incomingCallData.callerId,
//         text: `Missed ${incomingCallData.type} call`,
//         timestamp: Date.now(),
//         status: "sent"
//       });
      
//       setIncomingCallData(null);
//     } catch (e) {
//       console.error("Failed to decline call", e);
//     }
//   };

//   const handleGoogleSignIn = async () => {
//     setIsSigningIn(true);
//     try {
//       await signInWithGoogle();
//     } catch (error: any) {
//       if (error.code === 'auth/popup-closed-by-user') return;
//       toast({
//         variant: "destructive",
//         title: "Authentication Failed",
//         description: error.message || "Could not complete sign-in.",
//       });
//     } finally {
//       setIsSigningIn(false);
//     }
//   };

//   const handleBiometricChallenge = async () => {
//     setIsVerifying(true);
//     setVerificationError(null);
//     try {
//       const success = await verifyWithBiometrics();
//       if (success) {
//         setBiometricVerified(true);
//         toast({ title: "Security Verified", description: "Identity confirmed via biometric sensor." });
//       }
//     } catch (error: any) {
//       setVerificationError(error.message);
//       toast({
//         variant: "destructive",
//         title: "Security Failed",
//         description: error.message,
//       });
//     } finally {
//       setIsVerifying(false);
//     }
//   };

//   const emergencyDisableBiometric = async () => {
//     if (!db || !user) return;
//     try {
//       const userRef = doc(db, "users", user.uid);
//       await updateDoc(userRef, { biometricEnabled: false });
//       setBiometricVerified(true); 
//       toast({ title: "Lock Disabled", description: "Biometric security was removed." });
//     } catch (e) {
//       toast({ variant: "destructive", title: "Error", description: "Could not update security status." });
//     }
//   };

//   const toggleBiometric = async (enabled: boolean) => {
//     if (!db || !user) return;
    
//     if (enabled) {
//       if (isMobileOrTablet === false) {
//         toast({
//           variant: "destructive",
//           title: "Device Restriction",
//           description: "Biometric security is enforced only on mobile or tablet nodes.",
//         });
//         return;
//       }

//       const available = await checkBiometricAvailability();
//       if (!available) {
//         toast({
//           variant: "destructive",
//           title: "Incompatible Environment",
//           description: "Hardware access is restricted. Biometric security cannot be enabled.",
//         });
//         return;
//       }
//     }

//     try {
//       const userRef = doc(db, "users", user.uid);
//       await updateDoc(userRef, { biometricEnabled: enabled });
//       toast({
//         title: enabled ? "Security Enabled" : "Security Disabled",
//         description: enabled ? "Biometric lock is now active." : "Biometric lock has been removed.",
//       });
//     } catch (e) {
//       toast({ variant: "destructive", title: "Error", description: "Failed to update security settings." });
//     }
//   };

//   const saveName = async () => {
//     if (!db || !user || !newName.trim()) return;
//     try {
//       const userRef = doc(db, "users", user.uid);
//       await updateDoc(userRef, { displayName: newName.trim() });
//       setIsEditingName(false);
//       toast({ title: "Profile Updated", description: "Display name saved successfully." });
//     } catch (e) {
//       toast({ variant: "destructive", title: "Error", description: "Failed to update name." });
//     }
//   };

//   const navigateToChat = (user: any) => {
//     setSelectedChatUser({
//       id: user.id,
//       uid: user.id,
//       displayName: user.name || user.displayName,
//       photoURL: user.photo || user.photoURL,
//       guardrailId: user.guardrailId
//     });
//     setActiveTab("messages");
//   };

//   if (loading || isMobileOrTablet === null) {
//     return (
//       <div className="flex h-screen w-full items-center justify-center bg-background">
//         <Loader2 className="h-6 w-6 animate-spin text-primary/20" />
//       </div>
//     );
//   }

//   // Authenticated View Root
//   if (user) {
//     const isLocked = profile?.biometricEnabled && !biometricVerified && isMobileOrTablet;

//     return (
//       <main className="h-screen w-full flex flex-col bg-background overflow-hidden relative">
//         <LocationTracker />
//         <NotificationManager activeChatUid={selectedChatUser?.uid} />
        
//         {/* Global Call Overlays */}
//         {activeCallId && (
//           <CallOverlay 
//             callId={activeCallId} 
//             onEnd={() => {
//               setActiveCallId(null);
//               if (incomingRingtoneRef.current) {
//                 incomingRingtoneRef.current.pause();
//                 incomingRingtoneRef.current = null;
//               }
//             }} 
//           />
//         )}

//         {/* Global Logout Confirmation Dialog */}
//         <AlertDialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
//           <AlertDialogContent className="rounded-3xl border-border max-w-[340px] z-[11000]">
//             <AlertDialogHeader className="flex flex-col items-center text-center">
//               <div className="w-12 h-12 bg-destructive/10 rounded-2xl flex items-center justify-center mb-2">
//                 <LogOut className="h-6 w-6 text-destructive" />
//               </div>
//               <AlertDialogTitle className="font-black uppercase tracking-tight text-base">Confirm Logout</AlertDialogTitle>
//               <AlertDialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground leading-relaxed">
//                 Are you sure you want to terminate your current session?
//               </AlertDialogDescription>
//             </AlertDialogHeader>
//             <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-4">
//               <AlertDialogCancel className="rounded-2xl h-12 border-muted hover:bg-muted font-bold uppercase tracking-widest text-[10px] flex-1">Cancel</AlertDialogCancel>
//               <AlertDialogAction 
//                 onClick={() => {
//                   signOut(auth);
//                   setIsLogoutDialogOpen(false);
//                 }}
//                 className="rounded-2xl h-12 bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold uppercase tracking-widest text-[10px] flex-1"
//               >
//                 Logout
//               </AlertDialogAction>
//             </AlertDialogFooter>
//           </AlertDialogContent>
//         </AlertDialog>

//         {/* Global Incoming Call Notification Popup */}
//         {incomingCallData && !activeCallId && (
//           <div className="fixed left-1/2 -translate-x-1/2 top-4 z-[10000] w-full max-w-[440px] px-4 animate-in slide-in-from-top-4 duration-500">
//             <div className="bg-primary text-primary-foreground rounded-[2rem] p-4 shadow-2xl border border-primary/20 flex items-center justify-between gap-4">
//               <div className="flex items-center gap-3">
//                 <div className="relative">
//                   <Avatar className="h-12 w-12 border-2 border-primary-foreground/20">
//                     <AvatarImage src={incomingCallData.callerPhoto} />
//                     <AvatarFallback className="bg-primary-foreground/10 text-primary-foreground">
//                       {incomingCallData.callerName?.charAt(0)}
//                     </AvatarFallback>
//                   </Avatar>
//                   <div className="absolute -bottom-1 -right-1 bg-accent p-1 rounded-full animate-pulse">
//                     <PhoneIncoming className="h-3 w-3 text-accent-foreground" />
//                   </div>
//                 </div>
//                 <div>
//                   <p className="text-[10px] font-black uppercase tracking-widest text-primary-foreground/60 mb-0.5">Incoming {incomingCallData.type}</p>
//                   <p className="text-sm font-black uppercase tracking-tight text-primary-foreground">{incomingCallData.callerName}</p>
//                 </div>
//               </div>
//               <div className="flex gap-2">
//                 <Button 
//                   onClick={() => {
//                     if (incomingRingtoneRef.current) {
//                       incomingRingtoneRef.current.pause();
//                       incomingRingtoneRef.current = null;
//                     }
//                     setActiveCallId(incomingCallData.id);
//                   }}
//                   className="rounded-2xl bg-accent hover:bg-accent/90 h-12 w-12 p-0 shadow-lg text-accent-foreground"
//                 >
//                   <Phone className="h-5 w-5" />
//                 </Button>
//                 <Button 
//                   variant="destructive"
//                   onClick={handleDeclineCall}
//                   className="rounded-2xl h-12 w-12 p-0 shadow-lg"
//                 >
//                   <X className="h-5 w-5" />
//                 </Button>
//               </div>
//             </div>
//           </div>
//         )}

//         {isLocked ? (
//           <div className="fixed inset-0 z-[1000] bg-background flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
//             <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-6 shadow-xl">
//               <Shield className="h-6 w-6 text-primary-foreground" />
//             </div>
//             <h1 className="text-xl font-bold text-foreground tracking-tight mb-2 uppercase">Secure Entry Required</h1>
//             <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-10 max-w-xs leading-relaxed">
//               Identity confirmation via biometric sensor.
//             </p>

//             {verificationError && (
//               <div className="mb-10 p-4 bg-destructive/5 rounded-2xl border border-destructive/20 flex flex-col items-center gap-2 text-center max-w-xs animate-in slide-in-from-top-2">
//                 <AlertTriangle className="h-4 w-4 text-destructive" />
//                 <p className="text-[10px] font-bold text-destructive uppercase tracking-tight">
//                   {verificationError}
//                 </p>
//                 <button 
//                   onClick={emergencyDisableBiometric}
//                   className="text-[9px] font-black uppercase text-destructive underline underline-offset-4 px-0 h-auto"
//                 >
//                   Disable Lock
//                 </button>
//               </div>
//             )}

//             <div className="w-full max-w-[280px] space-y-4">
//               <Button 
//                 onClick={handleBiometricChallenge}
//                 disabled={isVerifying}
//                 className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-bold uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-all"
//               >
//                 {isVerifying ? <Loader2 className="h-5 w-5 animate-spin" /> : (
//                   <>
//                     <Fingerprint className="h-5 w-5 mr-2" />
//                     Verify Identity
//                   </>
//                 )}
//               </Button>
//               <Button 
//                 variant="ghost"
//                 onClick={() => setIsLogoutDialogOpen(true)}
//                 className="w-full h-12 text-muted-foreground hover:text-destructive text-[10px] font-bold uppercase tracking-widest rounded-xl"
//               >
//                 <LogOut className="h-4 w-4 mr-2" />
//                 Switch Account
//               </Button>
//             </div>
//           </div>
//         ) : (
//           <>
//             {activeTab === "profile" && (
//               <div className="absolute inset-0 z-[200] bg-background animate-in slide-in-from-bottom-2 duration-400 flex flex-col">
//                 <header className="h-14 px-6 flex items-center justify-between shrink-0 border-b border-border bg-background/80 backdrop-blur-md sticky top-0">
//                   <Button 
//                     variant="ghost" 
//                     onClick={() => setActiveTab("messages")} 
//                     className="text-foreground hover:bg-primary hover:text-primary-foreground font-bold uppercase text-[10px] tracking-widest h-9 px-4 rounded-xl transition-all active:scale-95"
//                   >
//                     <ArrowLeft className="h-4 w-4 mr-2" />
//                     Back
//                   </Button>
//                   <Button 
//                     variant="ghost" 
//                     onClick={() => setIsLogoutDialogOpen(true)} 
//                     className="text-destructive hover:bg-destructive hover:text-white font-bold uppercase text-[10px] tracking-widest h-9 px-4 rounded-xl transition-all active:scale-95"
//                   >
//                     <LogOut className="h-4 w-4 mr-2" />
//                     Logout
//                   </Button>
//                 </header>

//                 <div className="flex-1 overflow-y-auto px-6 py-4">
//                   <div className="max-w-md mx-auto space-y-4">
//                     <div className="flex flex-col items-center text-center">
//                       <div className="relative mb-3">
//                         <Avatar className="h-14 w-14 border-2 border-muted shadow-lg">
//                           <AvatarImage src={profile?.photoURL || user.photoURL || ""} />
//                           <AvatarFallback className="bg-muted">
//                             <UserIcon className="h-6 w-6 text-muted-foreground/30" />
//                           </AvatarFallback>
//                         </Avatar>
//                       </div>

//                       {isEditingName ? (
//                         <div className="flex flex-col items-center gap-2 w-full max-w-[200px]">
//                           <Input 
//                             value={newName} 
//                             onChange={(e) => setNewName(e.target.value)} 
//                             className="text-center font-bold text-sm h-9 rounded-xl border-border bg-background shadow-sm focus-visible:ring-primary"
//                             autoFocus
//                           />
//                           <div className="flex gap-2 w-full">
//                             <Button onClick={saveName} className="flex-1 h-8 rounded-lg bg-primary text-primary-foreground font-bold uppercase text-[9px] tracking-widest shadow-md">
//                               <Check className="h-3 w-3 mr-1.5" />
//                               Save
//                             </Button>
//                             <Button variant="ghost" onClick={() => setIsEditingName(false)} className="flex-1 h-8 rounded-lg bg-muted font-bold uppercase text-[9px] tracking-widest">
//                               Cancel
//                             </Button>
//                           </div>
//                         </div>
//                       ) : (
//                         <div className="flex items-center justify-center gap-2 group">
//                           <h2 className="text-base font-bold text-foreground tracking-tight uppercase">
//                             {profile?.displayName || user.displayName || "User"}
//                           </h2>
//                           <button 
//                             onClick={() => setIsEditingName(true)} 
//                             className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground/50 hover:text-foreground transition-all"
//                           >
//                             <Edit2 className="h-3 w-3" />
//                           </button>
//                         </div>
//                       )}
//                       <p className="text-[7px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-0.5 opacity-60">
//                         {user.email}
//                       </p>
//                     </div>

//                     <div className="bg-primary/5 p-1.5 rounded-xl border border-primary/10 max-w-[120px] mx-auto text-center">
//                       <p className="text-[6px] font-black text-primary/40 uppercase tracking-widest mb-0.5">Identity ID</p>
//                       <p className="text-[9px] font-mono font-bold text-primary tracking-widest">
//                         {profile?.guardrailId || "ID-SCAN"}
//                       </p>
//                     </div>

//                     <div className="space-y-2 pt-2">
//                       <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-2">Settings</p>
                      
//                       <div className="flex items-center justify-between p-3 bg-muted/20 rounded-2xl border border-border">
//                         <div className="flex items-center gap-3">
//                           <div className="w-8 h-8 bg-background rounded-xl flex items-center justify-center shadow-sm">
//                             {theme === 'dark' ? <Moon className="h-3.5 w-3.5 text-foreground" /> : <Sun className="h-3.5 w-3.5 text-foreground" />}
//                           </div>
//                           <div>
//                             <p className="text-[10px] font-bold text-foreground uppercase tracking-tight">Midnight Mode</p>
//                             <p className="text-[7px] font-medium text-muted-foreground uppercase tracking-widest mt-0.5">
//                               {theme === 'dark' ? "Active" : "Disabled"}
//                             </p>
//                           </div>
//                         </div>
//                         <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} />
//                       </div>

//                       <div className="flex items-center justify-between p-3 bg-muted/20 rounded-2xl border border-border">
//                         <div className="flex items-center gap-3">
//                           <div className="w-8 h-8 bg-background rounded-xl flex items-center justify-center shadow-sm">
//                             <Fingerprint className="h-3.5 w-3.5 text-foreground" />
//                           </div>
//                           <div>
//                             <p className="text-[10px] font-bold text-foreground uppercase tracking-tight">Biometric Lock</p>
//                             <p className="text-[7px] font-medium text-muted-foreground uppercase tracking-widest mt-0.5">
//                               {isMobileOrTablet ? "Active" : "Mobile Node Required"}
//                             </p>
//                           </div>
//                         </div>
//                         <Switch checked={profile?.biometricEnabled || false} onCheckedChange={toggleBiometric} />
//                       </div>
//                     </div>
//                   </div>
//                 </div>
//               </div>
//             )}
            
//             <header className="h-16 px-6 flex items-center justify-between border-b border-border shrink-0 bg-background/80 backdrop-blur-md z-50">
//               <div className="flex items-center">
//                 <h1 className="text-2xl font-black tracking-[0.2em] text-foreground uppercase">GUARDRAIL</h1>
//               </div>
              
//               <button 
//                 onClick={() => setActiveTab("profile")}
//                 className="flex items-center gap-3 group transition-all active:scale-95"
//               >
//                 <div className="text-right">
//                   <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Status</p>
//                   <p className="text-[10px] font-mono font-bold text-foreground leading-none">
//                     {profile?.guardrailId || "ID-SCAN"}
//                   </p>
//                 </div>
//                 <Avatar className="h-9 w-9 border-2 border-background shadow-md ring-1 ring-border">
//                   <AvatarImage src={profile?.photoURL || user.photoURL || ""} />
//                   <AvatarFallback className="bg-muted">
//                     <UserIcon className="h-4 w-4 text-muted-foreground/30" />
//                   </AvatarFallback>
//                 </Avatar>
//               </button>
//             </header>

//             <div className="flex-1 relative overflow-hidden bg-muted/10">
//               {activeTab === "messages" && (
//                 <div className="absolute inset-0 animate-in fade-in duration-300">
//                   <ChatContainer 
//                     externalActiveChat={selectedChatUser} 
//                     onClearExternalChat={() => setSelectedChatUser(null)}
//                     onStartCall={(callId) => setActiveCallId(callId)}
//                   />
//                 </div>
//               )}
              
//               {activeTab === "map" && (
//                 <div className="absolute inset-0 animate-in fade-in duration-300">
//                   <NetworkMap onChatRequest={navigateToChat} />
//                 </div>
//               )}
//             </div>

//             <nav className="h-18 shrink-0 border-t border-border bg-background flex items-center justify-around px-8 pb-3 z-50">
//               <button 
//                 onClick={() => {
//                   setActiveTab("messages");
//                   setSelectedChatUser(null);
//                 }}
//                 className={`flex flex-col items-center gap-1 transition-all relative ${activeTab === "messages" ? "text-foreground" : "text-muted-foreground/40"}`}
//               >
//                 <div className={`p-2 rounded-xl transition-colors ${activeTab === "messages" ? "bg-muted" : ""}`}>
//                   <MessageSquare className="h-5 w-5" />
//                 </div>
//                 <span className="text-[9px] font-bold uppercase tracking-widest">Messages</span>
//                 {totalUnread > 0 && (
//                   <span className="absolute top-1 right-2 h-4 w-4 bg-primary text-primary-foreground text-[8px] font-black flex items-center justify-center rounded-full border-2 border-background shadow-sm">
//                     {totalUnread}
//                   </span>
//                 )}
//               </button>
              
//               <button 
//                 onClick={() => setActiveTab("map")}
//                 className={`flex flex-col items-center gap-1 transition-all ${activeTab === "map" ? "text-foreground" : "text-muted-foreground/40"}`}
//               >
//                 <div className={`p-2 rounded-xl transition-colors ${activeTab === "map" ? "bg-muted" : ""}`}>
//                   <MapIcon className="h-5 w-5" />
//                 </div>
//                 <span className="text-[9px] font-bold uppercase tracking-widest">Map</span>
//               </button>
//             </nav>
//           </>
//         )}
//       </main>
//     );
//   }

//   return (
//     <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
//       <div className="w-full max-w-[360px] text-center space-y-12">
//         <div className="space-y-4">
//           <h1 className="text-5xl font-black tracking-[0.2em] text-slate-900 dark:text-white uppercase">GUARDRAIL</h1>
//           <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.4em]">Stay Close. Stay Safe.</p>
//         </div>
        
//         <div className="space-y-6">
//           <div className="px-8 py-10 bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800">
//             <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium uppercase leading-relaxed tracking-widest">
//               A private circle for families and close friends. Secured by identity, verified by you.
//             </p>
//           </div>

//           <div className="pt-4">
//             <Button 
//               onClick={handleGoogleSignIn}
//               disabled={isSigningIn}
//               className="w-full h-16 rounded-3xl text-[11px] font-bold uppercase tracking-widest bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-all shadow-xl flex items-center justify-center gap-3"
//             >
//               {isSigningIn ? (
//                 <Loader2 className="h-5 w-5 animate-spin" />
//               ) : (
//                 <>
//                   <svg className="h-4 w-4" viewBox="0 0 24 24">
//                     <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
//                     <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
//                     <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
//                     <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
//                   </svg>
//                   Login with Google
//                 </>
//               )}
//             </Button>
//           </div>
//           <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest opacity-40">Zero-Trust Privacy Protocol</p>
//         </div>
//       </div>
//     </div>
//   );
// }




"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { useAuth as useFirebaseInstance, useFirestore } from "@/firebase";
import { Button } from "@/components/ui/button";
import { signOut } from "firebase/auth";
import { doc, updateDoc, query, collection, where, onSnapshot, addDoc } from "firebase/firestore";
import { Loader2, MessageSquare, Map as MapIcon, User as UserIcon, ArrowLeft, Fingerprint, Edit2, Check, Shield, LogOut, AlertTriangle, Sun, Moon, Phone, PhoneIncoming, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChatContainer } from "@/components/chat/chat-container";
import { NetworkMap } from "@/components/map/network-map";
import { LocationTracker } from "@/components/map/location-tracker";
import { NotificationManager } from "@/components/chat/notification-manager";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { verifyWithBiometrics, checkBiometricAvailability } from "@/lib/biometrics";
import { useTheme } from "@/components/theme-provider";
import { CallOverlay } from "@/components/chat/call-overlay";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
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

export default function Home() {
  const { user, profile, loading, signInWithGoogle } = useAuth();
  const auth = useFirebaseInstance();
  const db = useFirestore();
  const { theme, toggleTheme } = useTheme();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [activeTab, setActiveTab] = useState<"messages" | "map" | "profile">("messages");
  const [selectedChatUser, setSelectedChatUser] = useState<any>(null);
  const [biometricVerified, setBiometricVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [isMobileOrTablet, setIsMobileOrTablet] = useState<boolean | null>(null);
  const [totalUnread, setTotalUnread] = useState(0);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  
  // Call State
  const [incomingCallData, setIncomingCallData] = useState<any>(null);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const incomingRingtoneRef = useRef<HTMLAudioElement | null>(null);
  
  const { toast } = useToast();

  useEffect(() => {
    if (profile) {
      setNewName(profile.displayName || user?.displayName || "");
    }
  }, [profile, user]);

  useEffect(() => {
    const checkDevice = () => {
      setIsMobileOrTablet(window.innerWidth < 1024);
    };
    checkDevice();
    window.addEventListener("resize", checkDevice);
    return () => window.removeEventListener("resize", checkDevice);
  }, []);

  // Monitor Incoming Calls Globally
  useEffect(() => {
    if (!db || !user) return;

    const q = query(
      collection(db, "calls"),
      where("calleeId", "==", user.uid),
      where("status", "==", "ringing")
    );

    const unsubscribe = onSnapshot(
      q, 
      (snapshot) => {
        if (!snapshot.empty) {
          const sortedDocs = [...snapshot.docs].sort((a, b) => {
            const timeA = a.data().timestamp || 0;
            const timeB = b.data().timestamp || 0;
            return timeB - timeA;
          });
          const call = { id: sortedDocs[0].id, ...sortedDocs[0].data() };
          setIncomingCallData(call);

          if (!activeCallId && !incomingRingtoneRef.current) {
            const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/135/135-preview.mp3");
            audio.loop = true;
            audio.play().catch(() => {});
            incomingRingtoneRef.current = audio;
          }
        } else {
          setIncomingCallData(null);
          if (incomingRingtoneRef.current) {
            incomingRingtoneRef.current.pause();
            incomingRingtoneRef.current = null;
          }
        }
      },
      async (serverError) => {
        const pError = new FirestorePermissionError({
          path: 'calls',
          operation: 'list',
        });
        errorEmitter.emit('permission-error', pError);
      }
    );

    return () => {
      unsubscribe();
      if (incomingRingtoneRef.current) {
        incomingRingtoneRef.current.pause();
        incomingRingtoneRef.current = null;
      }
    };
  }, [db, user, activeCallId]);

  // Monitor Total Unread Count
  useEffect(() => {
    if (!db || !user) return;

    const unreadListeners: { [chatId: string]: () => void } = {};
    const chatUnreadCounts: { [chatId: string]: number } = {};

    const setupChatUnreadListener = (contactUid: string) => {
      const chatId = [user.uid, contactUid].sort().join("_");
      if (unreadListeners[chatId]) return;

      const msgQuery = query(
        collection(db, "chats", chatId, "messages"),
        where("status", "!=", "seen")
      );

      const unsubscribe = onSnapshot(msgQuery, (snapshot) => {
        const unreadCount = snapshot.docs.filter(doc => doc.data().senderId !== user.uid).length;
        chatUnreadCounts[chatId] = unreadCount;
        const total = Object.values(chatUnreadCounts).reduce((a, b) => a + b, 0);
        setTotalUnread(total);
      });

      unreadListeners[chatId] = unsubscribe;
    };

    const q1 = query(collection(db, "requests"), where("status", "==", "accepted"), where("fromId", "==", user.uid));
    const q2 = query(collection(db, "requests"), where("status", "==", "accepted"), where("toId", "==", user.uid));

    const unsubRequests1 = onSnapshot(q1, (snap) => {
      snap.docs.forEach(doc => setupChatUnreadListener(doc.data().toId));
    });

    const unsubRequests2 = onSnapshot(q2, (snap) => {
      snap.docs.forEach(doc => setupChatUnreadListener(doc.data().fromId));
    });

    return () => {
      unsubRequests1();
      unsubRequests2();
      Object.values(unreadListeners).forEach(unsub => unsub());
    };
  }, [db, user]);

  const handleDeclineCall = async () => {
    if (!db || !incomingCallData) return;
    try {
      const callRef = doc(db, "calls", incomingCallData.id);
      await updateDoc(callRef, { status: "missed" });
      const chatId = [incomingCallData.callerId, incomingCallData.calleeId].sort().join("_");
      await addDoc(collection(db, "chats", chatId, "messages"), {
        senderId: incomingCallData.callerId,
        text: `Missed ${incomingCallData.type} call`,
        timestamp: Date.now(),
        status: "sent"
      });
      setIncomingCallData(null);
    } catch (e) {
      console.error("Failed to decline call", e);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
      setActiveTab("messages"); // Explicitly land on messages
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') return;
      toast({
        variant: "destructive",
        title: "Authentication Failed",
        description: error.message || "Could not complete sign-in.",
      });
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleBiometricChallenge = async () => {
    setIsVerifying(true);
    setVerificationError(null);
    try {
      const success = await verifyWithBiometrics();
      if (success) {
        setBiometricVerified(true);
        toast({ title: "Security Verified", description: "Identity confirmed via biometric sensor." });
      }
    } catch (error: any) {
      setVerificationError(error.message);
      toast({
        variant: "destructive",
        title: "Security Failed",
        description: error.message,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const emergencyDisableBiometric = async () => {
    if (!db || !user) return;
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { biometricEnabled: false });
      setBiometricVerified(true); 
      toast({ title: "Lock Disabled", description: "Biometric security was removed." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Could not update security status." });
    }
  };

  const toggleBiometric = async (enabled: boolean) => {
    if (!db || !user) return;
    if (enabled) {
      if (isMobileOrTablet === false) {
        toast({ variant: "destructive", title: "Device Restriction", description: "Biometric security is enforced only on mobile or tablet nodes." });
        return;
      }
      const available = await checkBiometricAvailability();
      if (!available) {
        toast({ variant: "destructive", title: "Incompatible Environment", description: "Hardware access is restricted. Biometric security cannot be enabled." });
        return;
      }
    }
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { biometricEnabled: enabled });
      toast({ title: enabled ? "Security Enabled" : "Security Disabled", description: enabled ? "Biometric lock is now active." : "Biometric lock has been removed." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Failed to update security settings." });
    }
  };

  const saveName = async () => {
    if (!db || !user || !newName.trim()) return;
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { displayName: newName.trim() });
      setIsEditingName(false);
      toast({ title: "Profile Updated", description: "Display name saved successfully." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Failed to update name." });
    }
  };

  const navigateToChat = (user: any) => {
    setSelectedChatUser({
      id: user.id,
      uid: user.id,
      displayName: user.name || user.displayName,
      photoURL: user.photo || user.photoURL,
      guardrailId: user.guardrailId
    });
    setActiveTab("messages");
  };

  if (loading || isMobileOrTablet === null) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary/20" />
      </div>
    );
  }

  if (user) {
    const isLocked = profile?.biometricEnabled && !biometricVerified && isMobileOrTablet;

    return (
      <main className="h-screen w-full flex flex-col bg-background overflow-hidden relative">
        <LocationTracker />
        <NotificationManager activeChatUid={selectedChatUser?.uid} />
        
        {activeCallId && (
          <CallOverlay 
            callId={activeCallId} 
            onEnd={() => {
              setActiveCallId(null);
              if (incomingRingtoneRef.current) {
                incomingRingtoneRef.current.pause();
                incomingRingtoneRef.current = null;
              }
            }} 
          />
        )}

        <AlertDialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
          <AlertDialogContent className="rounded-3xl border-border max-w-[340px] z-[11000]">
            <AlertDialogHeader className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-destructive/10 rounded-2xl flex items-center justify-center mb-2">
                <LogOut className="h-6 w-6 text-destructive" />
              </div>
              <AlertDialogTitle className="font-black uppercase tracking-tight text-base">Confirm Logout</AlertDialogTitle>
              <AlertDialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground leading-relaxed">
                Are you sure you want to terminate your current session?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-4">
              <AlertDialogCancel className="rounded-2xl h-12 border-muted hover:bg-muted font-bold uppercase tracking-widest text-[10px] flex-1">Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => {
                  signOut(auth).then(() => {
                    const { dismiss } = toast({
                      title: "Logout Successful",
                      description: "Your session has been securely terminated.",
                    });
                    // Success toast displayed for only 1 sec
                    setTimeout(dismiss, 1000);
                  });
                  setIsLogoutDialogOpen(false);
                }}
                className="rounded-2xl h-12 bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold uppercase tracking-widest text-[10px] flex-1"
              >
                Logout
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {incomingCallData && !activeCallId && (
          <div className="fixed left-1/2 -translate-x-1/2 top-4 z-[10000] w-full max-w-[440px] px-4 animate-in slide-in-from-top-4 duration-500">
            <div className="bg-primary text-primary-foreground rounded-[2rem] p-4 shadow-2xl border border-primary/20 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar className="h-12 w-12 border-2 border-primary-foreground/20">
                    <AvatarImage src={incomingCallData.callerPhoto} />
                    <AvatarFallback className="bg-primary-foreground/10 text-primary-foreground">
                      {incomingCallData.callerName?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 bg-accent p-1 rounded-full animate-pulse">
                    <PhoneIncoming className="h-3 w-3 text-accent-foreground" />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary-foreground/60 mb-0.5">Incoming {incomingCallData.type}</p>
                  <p className="text-sm font-black uppercase tracking-tight text-primary-foreground">{incomingCallData.callerName}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={() => {
                    if (incomingRingtoneRef.current) {
                      incomingRingtoneRef.current.pause();
                      incomingRingtoneRef.current = null;
                    }
                    setActiveCallId(incomingCallData.id);
                  }}
                  className="rounded-2xl bg-accent hover:bg-accent/90 h-12 w-12 p-0 shadow-lg text-accent-foreground"
                >
                  <Phone className="h-5 w-5" />
                </Button>
                <Button variant="destructive" onClick={handleDeclineCall} className="rounded-2xl h-12 w-12 p-0 shadow-lg">
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {isLocked ? (
          <div className="fixed inset-0 z-[1000] bg-background flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-6 shadow-xl">
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground tracking-tight mb-2 uppercase">Secure Entry Required</h1>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-10 max-w-xs leading-relaxed">
              Identity confirmation via biometric sensor.
            </p>
            {verificationError && (
              <div className="mb-10 p-4 bg-destructive/5 rounded-2xl border border-destructive/20 flex flex-col items-center gap-2 text-center max-w-xs animate-in slide-in-from-top-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <p className="text-[10px] font-bold text-destructive uppercase tracking-tight">{verificationError}</p>
                <button onClick={emergencyDisableBiometric} className="text-[9px] font-black uppercase text-destructive underline underline-offset-4 px-0 h-auto">Disable Lock</button>
              </div>
            )}
            <div className="w-full max-w-[280px] space-y-4">
              <Button onClick={handleBiometricChallenge} disabled={isVerifying} className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-bold uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-all">
                {isVerifying ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Fingerprint className="h-5 w-5 mr-2" />Verify Identity</>}
              </Button>
              <Button variant="ghost" onClick={() => setIsLogoutDialogOpen(true)} className="w-full h-12 text-muted-foreground hover:text-destructive text-[10px] font-bold uppercase tracking-widest rounded-xl">
                <LogOut className="h-4 w-4 mr-2" />Switch Account
              </Button>
            </div>
          </div>
        ) : (
          <>
            {activeTab === "profile" && (
              <div className="absolute inset-0 z-[200] bg-background animate-in slide-in-from-bottom-2 duration-400 flex flex-col">
                <header className="h-14 px-6 flex items-center justify-between shrink-0 border-b border-border bg-background/80 backdrop-blur-md sticky top-0">
                  <Button variant="ghost" onClick={() => setActiveTab("messages")} className="text-foreground hover:bg-primary hover:text-primary-foreground font-bold uppercase text-[10px] tracking-widest h-9 px-4 rounded-xl transition-all active:scale-95">
                    <ArrowLeft className="h-4 w-4 mr-2" />Back
                  </Button>
                  <Button variant="ghost" onClick={() => setIsLogoutDialogOpen(true)} className="text-destructive hover:bg-destructive hover:text-white font-bold uppercase text-[10px] tracking-widest h-9 px-4 rounded-xl transition-all active:scale-95">
                    <LogOut className="h-4 w-4 mr-2" />Logout
                  </Button>
                </header>
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  <div className="max-w-md mx-auto space-y-4">
                    <div className="flex flex-col items-center text-center">
                      <div className="relative mb-3">
                        <Avatar className="h-14 w-14 border-2 border-muted shadow-lg">
                          <AvatarImage src={profile?.photoURL || user.photoURL || ""} />
                          <AvatarFallback className="bg-muted"><UserIcon className="h-6 w-6 text-muted-foreground/30" /></AvatarFallback>
                        </Avatar>
                      </div>
                      {isEditingName ? (
                        <div className="flex flex-col items-center gap-2 w-full max-w-[200px]">
                          <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="text-center font-bold text-sm h-9 rounded-xl border-border bg-background shadow-sm focus-visible:ring-primary" autoFocus />
                          <div className="flex gap-2 w-full">
                            <Button onClick={saveName} className="flex-1 h-8 rounded-lg bg-primary text-primary-foreground font-bold uppercase text-[9px] tracking-widest shadow-md"><Check className="h-3 w-3 mr-1.5" />Save</Button>
                            <Button variant="ghost" onClick={() => setIsEditingName(false)} className="flex-1 h-8 rounded-lg bg-muted font-bold uppercase text-[9px] tracking-widest">Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2 group">
                          <h2 className="text-base font-bold text-foreground tracking-tight uppercase">{profile?.displayName || user.displayName || "User"}</h2>
                          <button onClick={() => setIsEditingName(true)} className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground/50 hover:text-foreground transition-all"><Edit2 className="h-3 w-3" /></button>
                        </div>
                      )}
                      <p className="text-[7px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-0.5 opacity-60">{user.email}</p>
                    </div>
                    <div className="bg-primary/5 p-1.5 rounded-xl border border-primary/10 max-w-[120px] mx-auto text-center">
                      <p className="text-[6px] font-black text-primary/40 uppercase tracking-widest mb-0.5">Identity ID</p>
                      <p className="text-[9px] font-mono font-bold text-primary tracking-widest">{profile?.guardrailId || "ID-SCAN"}</p>
                    </div>
                    <div className="space-y-2 pt-2">
                      <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-2">Settings</p>
                      <div className="flex items-center justify-between p-3 bg-muted/20 rounded-2xl border border-border">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-background rounded-xl flex items-center justify-center shadow-sm">
                            {theme === 'dark' ? <Moon className="h-3.5 w-3.5 text-foreground" /> : <Sun className="h-3.5 w-3.5 text-foreground" />}
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-foreground uppercase tracking-tight">Midnight Mode</p>
                            <p className="text-[7px] font-medium text-muted-foreground uppercase tracking-widest mt-0.5">{theme === 'dark' ? "Active" : "Disabled"}</p>
                          </div>
                        </div>
                        <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} />
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted/20 rounded-2xl border border-border">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-background rounded-xl flex items-center justify-center shadow-sm"><Fingerprint className="h-3.5 w-3.5 text-foreground" /></div>
                          <div>
                            <p className="text-[10px] font-bold text-foreground uppercase tracking-tight">Biometric Lock</p>
                            <p className="text-[7px] font-medium text-muted-foreground uppercase tracking-widest mt-0.5">{isMobileOrTablet ? "Active" : "Mobile Node Required"}</p>
                          </div>
                        </div>
                        <Switch checked={profile?.biometricEnabled || false} onCheckedChange={toggleBiometric} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <header className="h-16 px-6 flex items-center justify-between border-b border-border shrink-0 bg-background/80 backdrop-blur-md z-50">
              <div className="flex items-center">
                <h1 className="text-2xl font-black tracking-[0.2em] text-foreground uppercase">GUARDRAIL</h1>
              </div>
              <button onClick={() => setActiveTab("profile")} className="flex items-center gap-3 group transition-all active:scale-95">
                <div className="text-right">
                  <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Status</p>
                  <p className="text-[10px] font-mono font-bold text-foreground leading-none">{profile?.guardrailId || "ID-SCAN"}</p>
                </div>
                <Avatar className="h-9 w-9 border-2 border-background shadow-md ring-1 ring-border">
                  <AvatarImage src={profile?.photoURL || user.photoURL || ""} />
                  <AvatarFallback className="bg-muted"><UserIcon className="h-4 w-4 text-muted-foreground/30" /></AvatarFallback>
                </Avatar>
              </button>
            </header>

            <div className="flex-1 relative overflow-hidden bg-muted/10">
              {activeTab === "messages" && (
                <div className="absolute inset-0 animate-in fade-in duration-300">
                  <ChatContainer externalActiveChat={selectedChatUser} onClearExternalChat={() => setSelectedChatUser(null)} onStartCall={(callId) => setActiveCallId(callId)} />
                </div>
              )}
              {activeTab === "map" && (
                <div className="absolute inset-0 animate-in fade-in duration-300">
                  <NetworkMap onChatRequest={navigateToChat} />
                </div>
              )}
            </div>

            <nav className="h-18 shrink-0 border-t border-border bg-background flex items-center justify-around px-8 pb-3 z-50">
              <button onClick={() => { setActiveTab("messages"); setSelectedChatUser(null); }} className={`flex flex-col items-center gap-1 transition-all relative ${activeTab === "messages" ? "text-foreground" : "text-muted-foreground/40"}`}>
                <div className={`p-2 rounded-xl transition-colors ${activeTab === "messages" ? "bg-muted" : ""}`}><MessageSquare className="h-5 w-5" /></div>
                <span className="text-[9px] font-bold uppercase tracking-widest">Messages</span>
                {totalUnread > 0 && (
                  <span className="absolute top-1 right-2 h-4 w-4 bg-primary text-primary-foreground text-[8px] font-black flex items-center justify-center rounded-full border-2 border-background shadow-sm">{totalUnread}</span>
                )}
              </button>
              <button onClick={() => setActiveTab("map")} className={`flex flex-col items-center gap-1 transition-all ${activeTab === "map" ? "text-foreground" : "text-muted-foreground/40"}`}>
                <div className={`p-2 rounded-xl transition-colors ${activeTab === "map" ? "bg-muted" : ""}`}><MapIcon className="h-5 w-5" /></div>
                <span className="text-[9px] font-bold uppercase tracking-widest">Map</span>
              </button>
            </nav>
          </>
        )}
      </main>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
      <div className="w-full max-w-[360px] text-center space-y-12">
        <div className="space-y-4">
          <h1 className="text-5xl font-black tracking-[0.2em] text-slate-900 dark:text-white uppercase">GUARDRAIL</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.4em]">Stay Close. Stay Safe.</p>
        </div>
        <div className="space-y-6">
          <div className="px-8 py-10 bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800">
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium uppercase leading-relaxed tracking-widest">A private circle for families and close friends. Secured by identity, verified by you.</p>
          </div>
          <div className="pt-4">
            <Button onClick={handleGoogleSignIn} disabled={isSigningIn} className="w-full h-16 rounded-3xl text-[11px] font-bold uppercase tracking-widest bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-all shadow-xl flex items-center justify-center gap-3">
              {isSigningIn ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                <><svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" /><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>Login with Google</>
              )}
            </Button>
          </div>
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest opacity-40">Zero-Trust Privacy Protocol</p>
        </div>
      </div>
    </div>
  );
}
