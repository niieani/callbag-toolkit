import type { ScaffoldConfig } from "@niieani/scaffold";

const config: ScaffoldConfig = {
  module: "@niieani/scaffold",
  drivers: ["babel", "eslint", "jest", "prettier", "typescript"],
  settings: {
    node: true,
    codeTarget: "es6",
  },
};

export default config;
