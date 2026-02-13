
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { useAuth as useFirebaseInstance, useFirestore } from "@/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { getUniqueGuardrailID } from "@/lib/id-generator";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signInWithGoogle: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const auth = useFirebaseInstance();
  const db = useFirestore();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  useEffect(() => {
    if (!auth || !db) return;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        
        const userDocRef = doc(db, "users", firebaseUser.uid);
        
        const unsubscribeDoc = onSnapshot(
          userDocRef,
          async (snapshot) => {
            if (snapshot.exists()) {
              setProfile(snapshot.data());
              setLoading(false);
            } else {
              // Only attempt profile creation if we're sure the doc doesn't exist
              // and we have a valid user. Use non-blocking pattern.
              try {
                const newGuardrailId = await getUniqueGuardrailID(db);
                const newProfile = {
                  id: firebaseUser.uid,
                  email: firebaseUser.email,
                  displayName: firebaseUser.displayName,
                  photoURL: firebaseUser.photoURL,
                  guardrailId: newGuardrailId,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };
                
                setDocumentNonBlocking(userDocRef, newProfile, { merge: true });
                // We don't set loading false here yet; the next snapshot will do it.
              } catch (error) {
                setLoading(false);
              }
            }
          },
          async (serverError) => {
            // If the user just signed in, we might get a transient permission error
            // due to the auth token not being attached yet.
            const permissionError = new FirestorePermissionError({
              path: userDocRef.path,
              operation: 'get',
            });
            
            // Only emit if it's a persistent issue (not just an initial race)
            if (auth.currentUser) {
              errorEmitter.emit('permission-error', permissionError);
            }
            setLoading(false);
          }
        );

        return () => unsubscribeDoc();
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [auth, db]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, signInWithGoogle }}>
      {children}
    </AuthContext.Provider>
  );
};
