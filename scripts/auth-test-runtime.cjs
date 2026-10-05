// Let the standalone database check load modules normally guarded by Next.js.
/* eslint-disable @typescript-eslint/no-require-imports */
const { registerHooks } = require("node:module");
registerHooks({
  resolve(specifier, context, nextResolve) {
    return specifier === "server-only" ? { url: "otp-test:server-only", shortCircuit: true } : nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    return url === "otp-test:server-only" ? { format: "commonjs", source: "", shortCircuit: true } : nextLoad(url, context);
  },
});
