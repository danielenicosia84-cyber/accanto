const enabled = process.env.NODE_ENV !== "production";

export const log = {
  warn: (...args) => { if (enabled) console.warn(...args); },
  error: (...args) => { if (enabled) console.error(...args); },
};
