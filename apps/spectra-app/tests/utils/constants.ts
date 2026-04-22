/**
 * Centralized constants for API and Integration tests.
 * These values are used to mock environment variables and external service responses.
 */

export const TEST_JWT_SECRET = "test-secret-32-chars-long-enough!!";

export const VALID_INFRA_ENVS = {
  NEXT_PUBLIC_SUPABASE_URL: "https://supabase.example",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  UPSTASH_REDIS_REST_URL: "https://redis.example",
  UPSTASH_REDIS_REST_TOKEN: "redis-token",
};

export const TEST_USER_ID = "user-uuid-0000-0000-000000000001";
export const TEST_USER_EMAIL = "demo@spectra.app";
