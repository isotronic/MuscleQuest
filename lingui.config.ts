import { defineConfig } from "@lingui/cli";

export default defineConfig({
  sourceLocale: "en",
  locales: ["en"],
  catalogs: [
    {
      path: "<rootDir>/locales/{locale}/messages",
      include: [
        "<rootDir>/app",
        "<rootDir>/components",
        "<rootDir>/hooks",
        "<rootDir>/context",
        "<rootDir>/store",
      ],
    },
  ],
});
