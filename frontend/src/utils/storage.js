const readStoredValue = (key, fallback) => {
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
};

export const readStoredArray = (key) => {
  const value = readStoredValue(key, []);
  return Array.isArray(value) ? value : [];
};

export const readStoredObject = (key) => {
      const value = readStoredValue(key, {});
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
};

export const writeStoredValue = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A full or unavailable browser storage must not interrupt checkout or browsing.
  }
};
