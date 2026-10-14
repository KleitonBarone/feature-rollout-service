import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
const files = [
  "README.md",
  "ROADMAP.md",
  "CONTRIBUTING.md",
  "AGENTS.md",
  "CHANGELOG.md",
  "sdk/README.md",
];
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collect(path);
    else if (entry.name.endsWith(".md")) files.push(path);
  }
}
await collect("docs");
for (const file of files) {
  const body = await readFile(file, "utf8");
  for (const match of body.matchAll(/\[[^\]]*\]\(([^)]*)\)/g)) {
    const target = match[1];
    if (!target || /^https?:/.test(target)) continue;
    const [relative, anchor] = target.split("#");
    const path = relative ? resolve(dirname(file), relative) : resolve(file);
    if (!existsSync(path)) throw new Error(`Broken link in ${file}: ${target}`);
    if (anchor) {
      const headings = (await readFile(path, "utf8"))
        .split(/\r?\n/)
        .filter((line) => line.startsWith("#"))
        .map((line) =>
          line
            .replace(/^#+\s+/, "")
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s_-]/gu, "")
            .replace(/\s+/g, "-"),
        );
      if (!headings.includes(anchor))
        throw new Error(`Broken heading in ${file}: ${target}`);
    }
  }
}
console.log(`Checked links in ${files.length} documents.`);
