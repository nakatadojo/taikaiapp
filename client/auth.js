/**
 * Auth Client Module
 * Shared authentication logic for admin and public pages.
 */
const Auth = (() => {
  let currentUser = null;
  let _onAuthChange = () => {};

  const API = '/api/auth';

  async function _fetch(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    const data = await res.json();
    if (!res.ok) throw { status: res.status, ...data };
    return data;
  }

  return {
    /** Current authenticated user (null if not logged in) */
    get currentUser() { return currentUser; },

    /** Override per page to react to auth changes */
    set onAuthChange(fn) { _onAuthChange = fn; },

    /** Check if user is logged in */
    isLoggedIn() { return !!currentUser; },

    /** Check if user has a specific role */
    hasRole(role) { return currentUser?.roles?.includes(role) || false; },

    /** Check if user email is verified */
    isVerified() { return currentUser?.emailVerified || false; },

    /**
     * Initialize auth state by calling GET /api/auth/me.
     * Fires onAuthChange callback.
     */
    async init() {
      try {
        const data = await _fetch(`${API}/me`);
        currentUser = data.user;
      } catch (err) {
        currentUser = null;
      }
      _onAuthChange(currentUser);
    },

    /**
     * Sign up a new user. Sets currentUser from response (auth cookie set server-side).
     */
    async signup({ email, password, firstName, lastName, phone, dateOfBirth, gender, roles, accountType, organizationName }) {
      const data = await _fetch(`${API}/signup`, {
        method: 'POST',
        body: JSON.stringify({ email, password, firstName, lastName, phone, dateOfBirth, gender, roles, accountType, organizationName }),
      });
      // Server sets auth cookie; populate local user state
      currentUser = data.user;
      _onAuthChange(currentUser);
      return data;
    },

    /**
     * Select role after account creation (new multi-step signup flow).
     */
    async selectRole(role) {
      const data = await _fetch(`${API}/select-role`, {
        method: 'POST',
        body: JSON.stringify({ role }),
      });
      if (data.user) {
        currentUser = { ...currentUser, ...data.user };
        _onAuthChange(currentUser);
      }
      return data;
    },

    /**
     * Complete profile after role selection (new multi-step signup flow).
     */
    async completeProfile(profileData) {
      const data = await _fetch(`${API}/complete-profile`, {
        method: 'PUT',
        body: JSON.stringify(profileData),
      });
      if (data.user) {
        currentUser = { ...currentUser, ...data.user };
        _onAuthChange(currentUser);
      }
      return data;
    },

    /**
     * Log in with email and password.
     */
    async login(email, password) {
      const data = await _fetch(`${API}/login`, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      currentUser = data.user;
      _onAuthChange(currentUser);
      return data;
    },

    /**
     * Log out (clears cookie).
     */
    async logout() {
      try {
        await _fetch(`${API}/logout`, { method: 'POST' });
      } catch (err) {
        // Ignore errors — clear local state regardless
      }
      currentUser = null;
      _onAuthChange(null);
    },

    /**
     * Request password reset email.
     */
    async forgotPassword(email) {
      return _fetch(`${API}/forgot-password`, {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    },

    /**
     * Reset password with token.
     */
    async resetPassword(token, password) {
      return _fetch(`${API}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
    },

    /**
     * Resend email verification link.
     */
    async resendVerification(email) {
      return _fetch(`${API}/resend-verification`, {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    },

    /**
     * Update current user profile.
     */
    async updateProfile({ firstName, lastName, phone, dateOfBirth }) {
      const data = await _fetch(`${API}/me`, {
        method: 'PUT',
        body: JSON.stringify({ firstName, lastName, phone, dateOfBirth }),
      });
      currentUser = data.user;
      _onAuthChange(currentUser);
      return data;
    },
  };
})();
