import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, signInWithGoogle } from '../firebase';
import { onAuthStateChanged, User as FirebaseUser, signOut } from 'firebase/auth';

interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: 'admin' | 'user';
  status: 'active' | 'deactivated';
  onboardingCompleted: boolean;
  age?: number;
  country?: string;
  discoverySource?: string;
  interests?: string[];
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
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const syncUser = async (firebaseUser: FirebaseUser) => {
    try {
      const res = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL
        })
      });
      
      if (res.status === 403) {
        const data = await res.json();
        alert(data.error || "Your account has been deactivated.");
        await signOut(auth);
        setUser(null);
      } else if (res.ok) {
        const userData = await res.json();
        setUser(userData);
      }
    } catch (error) {
      console.error("Failed to sync user:", error);
      // Fallback to basic info
      setUser({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        role: 'user',
        status: 'active',
        onboardingCompleted: false
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

  const login = async () => {
    try {
      await signInWithGoogle();
    } catch (error: any) {
      if (error.code === 'auth/popup-blocked') {
        alert("The sign-in popup was blocked by your browser. Please allow popups for this site and try again.");
      } else {
        console.error("Login error:", error);
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
