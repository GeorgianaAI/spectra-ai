// Test utility — set and restore env vars per test without polluting other tests.

export function useEnvTestHarness() {
  const originalValues: Record<string, string | undefined> = {};

  function setEnv(vars: Record<string, string>) {
    for (const [key, value] of Object.entries(vars)) {
      originalValues[key] = process.env[key];
      process.env[key] = value;
    }
  }

  function unsetEnv(...keys: string[]) {
    for (const key of keys) {
      originalValues[key] = process.env[key];
      delete process.env[key];
    }
  }

  function restoreEnv() {
    for (const [key, value] of Object.entries(originalValues)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }

  return { setEnv, unsetEnv, restoreEnv };
}
