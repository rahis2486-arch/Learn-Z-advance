import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
// @ts-ignore
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    if (error.code === 'auth/popup-closed-by-user') {
      console.warn("Sign-in popup was closed by the user before completion.");
      return null;
    }
    if (error.code === 'auth/cancelled-popup-request') {
      console.warn("Sign-in request was cancelled due to a newer request.");
      return null;
    }
    console.error("Error signing in with Google:", error);
    throw error;
  }
};
