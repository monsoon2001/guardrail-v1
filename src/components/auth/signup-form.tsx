"use client";

import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { useAuth as useFirebaseInstance, useFirestore } from "@/firebase";
import { doc, setDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Mail, Lock, Loader2, CheckCircle2 } from "lucide-react";
import { getUniqueGuardrailID } from "@/lib/id-generator";

export function SignupForm({ onToggle }: { onToggle: () => void }) {
  const auth = useFirebaseInstance();
  const db = useFirestore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [newId, setNewId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // 1. Create user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Generate Unique Guardrail ID
      const guardrailId = await getUniqueGuardrailID(db);

      // 3. Save to Firestore
      await setDoc(doc(db, "users", user.uid), {
        id: user.uid,
        email: user.email,
        guardrailId: guardrailId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setNewId(guardrailId);
      
      toast({
        title: "Account created!",
        description: `Your unique Guardrail ID is ${guardrailId}`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Sign up failed",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (newId) {
    return (
      <Card className="w-full max-w-md border-none auth-card-shadow bg-card animate-in fade-in zoom-in duration-300">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-green-100 p-3 rounded-full">
              <CheckCircle2 className="w-12 h-12 text-green-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold font-headline">Registration Successful!</CardTitle>
          <CardDescription>Welcome to the Guardrail network.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <p className="text-sm text-muted-foreground">Your unique identification code is:</p>
          <div className="bg-primary/5 border-2 border-dashed border-primary/30 p-6 rounded-xl">
            <span className="text-4xl font-mono font-bold tracking-widest text-primary">{newId}</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Please keep this ID safe. It will be used to identify you securely within the application.
          </p>
        </CardContent>
        <CardFooter>
          <Button className="w-full h-11" onClick={() => window.location.reload()}>
            Go to Dashboard
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md border-none auth-card-shadow bg-card">
      <CardHeader className="space-y-1 text-center">
        <div className="flex justify-center mb-4">
          <div className="bg-accent/10 p-3 rounded-full">
            <UserPlus className="w-8 h-8 text-accent" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight font-headline">Create your Account</CardTitle>
        <CardDescription className="text-muted-foreground">
          Sign up to get your unique Guardrail ID
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSignup}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                className="pl-10 h-11"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                className="pl-10 h-11"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button 
            className="w-full h-11 text-base font-medium transition-all hover:translate-y-[-1px] active:translate-y-[0px] shadow-sm" 
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Account...
              </>
            ) : (
              "Sign Up"
            )}
          </Button>
          <div className="text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <button
              type="button"
              onClick={onToggle}
              className="text-primary font-semibold hover:underline underline-offset-4"
            >
              Sign in
            </button>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
