import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: false,
    testTimeout: 20_000,
    env: {
      NODE_ENV: "test",
      FRONTEND_URL: "http://localhost:5173",
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        "postgresql://unused:unused@localhost:5432/unused",
      JWT_ACCESS_SECRET: "test_secret_test_secret_test_secret_123456",
      OWNER_EMAIL: "owner@test.local",
      OWNER_PASSWORD: "OwnerPassword#12345",
      MP_WEBHOOK_SECRET: "whsec_test",
    },
  },
});
