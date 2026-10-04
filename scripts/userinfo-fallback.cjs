/* eslint-disable @typescript-eslint/no-require-imports */
// Some restricted Windows environments report ENOMEM for os.userInfo().
// Drizzle Kit and tsx use it only to name temporary files. Leave normal behavior intact.
const os = require("node:os");
const original = os.userInfo;
os.userInfo = (...args) => {
  try { return original(...args); }
  catch (error) {
    if (error?.code !== "ERR_SYSTEM_ERROR" || error?.info?.syscall !== "uv_os_get_passwd") throw error;
    return { username: process.env.USERNAME || "user", homedir: os.homedir(), uid: -1, gid: -1, shell: null };
  }
};
