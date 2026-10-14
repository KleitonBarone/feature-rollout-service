import { spawn } from "node:child_process";

export async function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, ...options });
    let output = "";
    child.stdout?.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      output += chunk;
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve(output)
        : reject(new Error(`${command} exited ${code}\n${output}`)),
    );
  });
}

export function pnpm(args, options = {}) {
  const entry = process.env.npm_execpath;
  if (!entry) throw new Error("Run this command through pnpm.");
  return entry.endsWith(".exe")
    ? run(entry, args, options)
    : run(process.execPath, [entry, ...args], options);
}
