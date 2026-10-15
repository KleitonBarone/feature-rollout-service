import { cp, mkdir, copyFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve, join } from "node:path";

if (!process.argv[2])
  throw new Error(
    "Usage: node examples/quickstart/copy.mjs NEW_APPLICATION_DIRECTORY",
  );
const destination = resolve(process.argv[2]);
// Require a new directory so running the tutorial cannot overwrite an existing app.
await mkdir(destination);
await mkdir(join(destination, "vendor"));
await cp(
  new URL("../../sdk/", import.meta.url),
  join(destination, "vendor/feature-rollout"),
  { recursive: true, force: false, errorOnExist: true },
);
await copyFile(
  new URL("app.mjs", import.meta.url),
  join(destination, "app.mjs"),
  constants.COPYFILE_EXCL,
);
await copyFile(
  new URL("application.env.example", import.meta.url),
  join(destination, ".env"),
  constants.COPYFILE_EXCL,
);
console.log(`Created ${destination}. Run node --env-file=.env app.mjs there.`);
