import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

export const apiFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  
  const newInit = { ...init };
  
  if (url.startsWith('/api')) {
    const currentUser = auth.currentUser;
    if (currentUser) {
      if (newInit.headers instanceof Headers) {
        newInit.headers.set('x-user-uid', currentUser.uid);
      } else {
        newInit.headers = {
          ...(newInit.headers as Record<string, string>),
          'x-user-uid': currentUser.uid
        };
      }
    }
  }

  const response = await fetch(input, newInit);

  if (response.status === 403) {
    const clone = response.clone();
    try {
      const data = await clone.json();
      if (data.error === "Access revoked by institution") {
        console.log("[AUTH] Access revoked detected via apiFetch");
        await signOut(auth);
        alert("Your institutional access has been revoked. Please contact your institution administrator.");
        window.location.href = "/login";
      }
    } catch (e) {
      // Not JSON or other error
    }
  }
  return response;
};
