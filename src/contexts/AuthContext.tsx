import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, signInWithGoogle } from '../firebase';
import { onAuthStateChanged, User as FirebaseUser, signOut } from 'firebase/auth';

interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: 'admin' | 'user' | 'institution_admin' | 'staff' | 'student' | 'institution_student';
  status: 'active' | 'deactivated';
  onboardingCompleted: boolean;
  loginType: 'personal' | 'institutional';
  institutionId?: string;
  username?: string;
  age?: number;
  country?: string;
  discoverySource?: string;
  interests?: string[];
  hobbies?: string[];
  learningPreferences?: string[];
  motivation?: string;
  primaryGoal?: string;
  customGoal?: string;
  dailyCommitment?: string;
  subscription?: {
    plan: 'Basic' | 'Pro' | 'Institution';
    status: 'active' | 'expired' | 'canceled';
    expiryDate: string;
    paymentMethod?: string;
    transactionId?: string;
  };
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (institutionId?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const syncUser = async (firebaseUser: FirebaseUser, institutionId?: string) => {
    try {
      const res = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          institutionId
        })
      });
      
      if (res.status === 403) {
        const data = await res.json();
        await signOut(auth);
        setUser(null);
        throw new Error(data.error || "Unauthorized");
      } else if (res.ok) {
        const userData = await res.json();
        setUser(userData);
      }
    } catch (error) {
      // Rethrow if it's an error we explicitly threw (like 403)
      if (error instanceof Error && (error.message.includes("authorized") || error.message.includes("deactivated") || error.message === "Unauthorized")) {
        throw error;
      }
      console.error("Failed to sync user:", error);
      // Fallback to basic info
      setUser({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        role: 'user',
        status: 'active',
        onboardingCompleted: false,
        loginType: 'personal'
      });
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await syncUser(firebaseUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshUser = async () => {
    if (auth.currentUser) {
      await syncUser(auth.currentUser);
    }
  };

  const login = async (institutionId?: string) => {
    try {
      const user = await signInWithGoogle();
      if (user) {
        await syncUser(user, institutionId);
      }
    } catch (error: any) {
      if (error.code === 'auth/popup-blocked') {
        alert("The sign-in popup was blocked by your browser. Please allow popups for this site and try again.");
      } else {
        console.error("Login error:", error);
        throw error;
      }
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
