import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../firebase';
import { getJson, putJson } from '../utils/api';

const AuthContext = createContext();
const LOCAL_USER_STORAGE_KEY = 'resourcesync_local_user';

export const roleDefinitions = {
  admin: {
    label: 'Admin',
    description: 'Full access to operations, assignments, intake, and user workflows.'
  },
  coordinator: {
    label: 'Coordinator',
    description: 'Manages needs, assignments, dispatch activity, and intake review.'
  },
  field_volunteer: {
    label: 'Field Volunteer',
    description: 'Views mission activity and manages volunteer participation workflows.'
  },
  viewer: {
    label: 'Viewer',
    description: 'Read-only visibility for demos, judges, and stakeholders.'
  }
};

export const billingPlanDefinitions = {
  community: {
    label: 'Community',
    accent: 'var(--accent-green)'
  },
  pro: {
    label: 'Pro Coordination',
    accent: 'var(--accent-cyan)'
  },
  enterprise: {
    label: 'Enterprise Response',
    accent: 'var(--accent-orange)'
  }
};

const permissionMatrix = {
  dashboard_view: ['admin', 'coordinator', 'field_volunteer', 'viewer'],
  assignment_manage: ['admin', 'coordinator'],
  intake_access: ['admin', 'coordinator'],
  intake_review: ['admin', 'coordinator'],
  volunteer_manage: ['admin', 'coordinator', 'field_volunteer'],
  volunteer_register: ['admin', 'coordinator', 'field_volunteer'],
  training_access: ['admin', 'coordinator', 'field_volunteer']
};

function normalizeRole(role) {
  return roleDefinitions[role] ? role : 'viewer';
}

function attachRole(user, role = 'viewer') {
  if (!user) {
    return null;
  }

  user.role = normalizeRole(role);
  return user;
}

function attachBilling(user, billing = null) {
  if (!user) {
    return null;
  }

  user.billing = billing || {
    planId: 'community',
    planName: 'Community',
    status: 'active',
    provider: 'mock',
    billingCycle: 'monthly',
    amount: 0,
    currency: 'USD',
    renewalDate: null,
    customerId: null,
    subscriptionId: null,
    checkoutHistory: [],
    paymentHistory: []
  };
  return user;
}

function readStoredUser() {
  try {
    const raw = window.localStorage.getItem(LOCAL_USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed) return null;

    return {
      ...parsed,
      uid: parsed.uid || `local_${Date.now()}`,
      role: normalizeRole(parsed.role),
      billing: parsed.billing || {
        planId: 'community',
        planName: 'Community',
        status: 'active',
        provider: 'mock',
        billingCycle: 'monthly',
        amount: 0,
        currency: 'USD',
        renewalDate: null,
        customerId: null,
        subscriptionId: null,
        checkoutHistory: [],
        paymentHistory: []
      },
      isLocalAuth: true
    };
  } catch {
    return null;
  }
}

function writeStoredUser(user) {
  if (!user) {
    window.localStorage.removeItem(LOCAL_USER_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(LOCAL_USER_STORAGE_KEY, JSON.stringify(user));
}

function createLocalUser(email, role = 'viewer') {
  return {
    email,
    uid: `local_${email.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`,
    role: normalizeRole(role),
    billing: {
      planId: 'community',
      planName: 'Community',
      status: 'active',
      provider: 'mock',
      billingCycle: 'monthly',
      amount: 0,
      currency: 'USD',
      renewalDate: null,
      customerId: null,
      subscriptionId: null,
      checkoutHistory: [],
      paymentHistory: []
    },
    isLocalAuth: true
  };
}

function createLocalToken(user) {
  const payload = {
    uid: user.uid,
    email: user.email,
    role: normalizeRole(user.role)
  };

  return `local-auth:${window.btoa(JSON.stringify(payload))}`;
}

function shouldFallbackToLocalAuth(error) {
  const firebaseErrorCode = error?.code || '';
  const message = String(error?.message || '').toLowerCase();

  return [
    'auth/configuration-not-found',
    'auth/operation-not-allowed',
    'auth/api-key-not-valid.-please-pass-a-valid-api-key.',
    'auth/invalid-api-key'
  ].includes(firebaseErrorCode) || message.includes('load failed') || message.includes('failed to fetch');
}

function isFirebaseOperationError(error) {
  return Boolean(error?.code?.startsWith?.('auth/'));
}

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [useLocalAuthFallback, setUseLocalAuthFallback] = useState(false);

  const isMockMode = !isFirebaseConfigured || useLocalAuthFallback;

  const setUserWithPersistence = (user) => {
    setCurrentUser(user);
    if (isMockMode) {
      writeStoredUser(user);
    }
  };

  const loadLiveUserProfile = async (user) => {
    const token = await user.getIdToken();
    const data = await getJson('/api/auth/profile', { token });

    return attachBilling(attachRole(user, data.profile?.role || 'viewer'), data.profile?.billing);
  };

  const syncLiveUserProfile = async (user, role = 'viewer') => {
    const token = await user.getIdToken();
    const data = await putJson('/api/auth/profile', {
      email: user.email || '',
      role: normalizeRole(role)
    }, { token });

    return attachBilling(attachRole(user, data.profile?.role || role), data.profile?.billing);
  };

  const getToken = async () => {
    if (!currentUser) {
      return null;
    }

    if (isMockMode) {
      return createLocalToken(currentUser);
    }

    return currentUser.getIdToken();
  };

  const signup = async (email, password, role = 'viewer') => {
    if (isMockMode) {
      const user = createLocalUser(email, role);
      setUserWithPersistence(user);
      return user;
    }

    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      try {
        const liveUser = await syncLiveUserProfile(credential.user, role);
        setCurrentUser(liveUser);
        return credential;
      } catch (profileError) {
        if (shouldFallbackToLocalAuth(profileError)) {
          console.warn('Firebase signup worked, but profile sync failed. Falling back to local demo auth.', profileError);
          setUseLocalAuthFallback(true);
          const user = createLocalUser(email, role);
          setUserWithPersistence(user);
          return user;
        }

        setCurrentUser(attachBilling(attachRole(credential.user, role)));
        return credential;
      }
    } catch (error) {
      if (shouldFallbackToLocalAuth(error)) {
        console.warn('Falling back to local demo auth for signup because Firebase Auth is not fully configured.', error);
        setUseLocalAuthFallback(true);
        const user = createLocalUser(email, role);
        setUserWithPersistence(user);
        return user;
      }

      throw error;
    }
  };

  const login = async (email, password, role = 'viewer') => {
    if (isMockMode) {
      const user = createLocalUser(email, role);
      setUserWithPersistence(user);
      return user;
    }

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      try {
        const liveUser = await loadLiveUserProfile(credential.user);
        setCurrentUser(liveUser);
        return credential;
      } catch (profileError) {
        if (shouldFallbackToLocalAuth(profileError)) {
          console.warn('Firebase login worked, but profile load failed. Falling back to local demo auth.', profileError);
          setUseLocalAuthFallback(true);
          const user = createLocalUser(email, role);
          setUserWithPersistence(user);
          return user;
        }

        setCurrentUser(attachBilling(attachRole(credential.user, 'viewer')));
        return credential;
      }
    } catch (error) {
      if (shouldFallbackToLocalAuth(error)) {
        console.warn('Falling back to local demo auth for login because Firebase Auth is not fully configured.', error);
        setUseLocalAuthFallback(true);
        const user = createLocalUser(email, role);
        setUserWithPersistence(user);
        return user;
      }

      throw error;
    }
  };

  const loginWithGoogle = async (role = 'viewer', mode = 'login') => {
    if (isMockMode) {
      const user = createLocalUser(`google_${Date.now()}@demo.local`, role);
      setUserWithPersistence(user);
      return user;
    }

    try {
      const credential = await signInWithPopup(auth, googleProvider);

      try {
        const liveUser = mode === 'signup'
          ? await syncLiveUserProfile(credential.user, role)
          : await loadLiveUserProfile(credential.user);

        setCurrentUser(liveUser);
        return credential;
      } catch (profileError) {
        if (shouldFallbackToLocalAuth(profileError)) {
          console.warn('Google sign-in worked, but profile sync failed. Falling back to local demo auth.', profileError);
          setUseLocalAuthFallback(true);
          const user = createLocalUser(credential.user.email || `google_${Date.now()}@demo.local`, role);
          setUserWithPersistence(user);
          return user;
        }

        setCurrentUser(attachBilling(attachRole(credential.user, mode === 'signup' ? role : 'viewer')));
        return credential;
      }
    } catch (error) {
      if (shouldFallbackToLocalAuth(error)) {
        console.warn('Falling back to local demo auth for Google sign-in because Firebase Auth is not fully configured.', error);
        setUseLocalAuthFallback(true);
        const user = createLocalUser(`google_${Date.now()}@demo.local`, role);
        setUserWithPersistence(user);
        return user;
      }

      throw error;
    }
  };

  const logout = async () => {
    if (isMockMode) {
      setUserWithPersistence(null);
      return;
    }

    await signOut(auth);
  };

  const updateRole = async (nextRole) => {
    if (!currentUser) {
      throw new Error('No authenticated user');
    }

    const normalizedRole = normalizeRole(nextRole);

    if (isMockMode) {
      const updatedUser = {
        ...currentUser,
        role: normalizedRole
      };
      setUserWithPersistence(updatedUser);
      return updatedUser;
    }

    const token = await currentUser.getIdToken();
    const data = await putJson('/api/auth/profile', {
      email: currentUser.email || '',
      role: normalizedRole
    }, { token });

    const updatedUser = attachBilling(attachRole(currentUser, data.profile?.role || normalizedRole), data.profile?.billing);
    setCurrentUser({ ...updatedUser });
    return updatedUser;
  };

  const updateBilling = async (billingPatch) => {
    if (!currentUser) {
      throw new Error('No authenticated user');
    }

    if (isMockMode) {
      const updatedUser = {
        ...currentUser,
        billing: {
          ...(currentUser.billing || {}),
          ...billingPatch
        }
      };
      setUserWithPersistence(updatedUser);
      return updatedUser;
    }

    const token = await currentUser.getIdToken();
    const data = await putJson('/api/auth/profile', {
      email: currentUser.email || '',
      role: currentUser.role || 'viewer',
      billing: {
        ...(currentUser.billing || {}),
        ...billingPatch
      }
    }, { token });

    const updatedUser = attachBilling(attachRole(currentUser, data.profile?.role || currentUser.role), data.profile?.billing);
    setCurrentUser({ ...updatedUser });
    return updatedUser;
  };

  const hasPlanFeature = (feature) => {
    const planId = currentUser?.billing?.planId || 'community';
    const featureMatrix = {
      advanced_analytics: ['pro', 'enterprise'],
      marketplace_exchange: ['pro', 'enterprise'],
      governance_controls: ['pro', 'enterprise'],
      white_label: ['enterprise'],
      institutional_reporting: ['enterprise']
    };
    return (featureMatrix[feature] || ['community', 'pro', 'enterprise']).includes(planId);
  };

  const hasPermission = (permission) => {
    const allowedRoles = permissionMatrix[permission] || [];
    return Boolean(currentUser && allowedRoles.includes(normalizeRole(currentUser.role)));
  };

  useEffect(() => {
    if (isMockMode) {
      setCurrentUser(readStoredUser());
      setLoading(false);
      return () => {};
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCurrentUser(null);
        setLoading(false);
        return;
      }

      try {
        const liveUser = await loadLiveUserProfile(user);
        setCurrentUser(liveUser);
      } catch (error) {
        console.error('Failed to load Firebase user profile:', error);
        if (shouldFallbackToLocalAuth(error) && !isFirebaseOperationError(error)) {
          setUseLocalAuthFallback(true);
          setCurrentUser(readStoredUser());
        } else {
          setCurrentUser(attachBilling(attachRole(user, 'viewer')));
        }
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [isMockMode]);

  const value = {
    authMode: isMockMode ? 'demo' : 'firebase',
    currentUser,
    updateBilling,
    getToken,
    hasPermission,
    hasPlanFeature,
    login,
    loginWithGoogle,
    logout,
    signup,
    updateRole
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
