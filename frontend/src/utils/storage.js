// localStorage can throw (private mode, blocked storage) — never let that break the app.
export const TOKEN_KEY = 'campusbite_token';
export const USER_KEY = 'campusbite_user';

function read(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    if (value === null || value === undefined) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export const storage = {
  getToken: () => read(TOKEN_KEY),
  getUser: () => {
    try {
      return JSON.parse(read(USER_KEY) || 'null');
    } catch {
      return null;
    }
  },
  setAuth: (token, user) => {
    write(TOKEN_KEY, token);
    write(USER_KEY, JSON.stringify(user));
  },
  setUser: (user) => write(USER_KEY, JSON.stringify(user)),
  clearAuth: () => {
    write(TOKEN_KEY, null);
    write(USER_KEY, null);
  },
  getJSON: (key) => {
    try {
      return JSON.parse(read(key) || 'null');
    } catch {
      return null;
    }
  },
  setJSON: (key, value) => write(key, value === null ? null : JSON.stringify(value)),
};
