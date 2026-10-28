/**
 * Sets the host PIN.
 *
 *   npm run set-host-pin -- --linked   # the Supabase project linked with `supabase link`
 *   npm run set-host-pin -- --local    # the local stack (`npx supabase start`)
 *
 * The PIN is typed into a hidden prompt, hashed here with bcrypt (cost 10,
 * `$2a$` prefix, the variant pgcrypto's crypt() verifies) and only the hash is
 * sent, through `supabase db query`. The plain PIN never leaves this machine
 * and is never written to disk or shell history.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import bcrypt from "bcryptjs";

const MIN_LENGTH = 6;

function readHidden(prompt: string): Promise<string> {
  const stdin = process.stdin;
  if (!stdin.isTTY) {
    // Piped input (automation only). Interactive use is preferred.
    return new Promise((resolve) => {
      let data = "";
      stdin.setEncoding("utf8");
      stdin.on("data", (chunk) => (data += chunk));
      stdin.on("end", () => resolve(data.split(/\r?\n/)[0] ?? ""));
    });
  }
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    let value = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\u0003") {
          process.stdout.write("\n");
          process.exit(130);
        } else if (ch === "\r" || ch === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          resolve(value);
          return;
        } else if (ch === "\u007f" || ch === "\b") {
          value = value.slice(0, -1);
        } else {
          value += ch;
        }
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const target = process.argv.includes("--local") ? "--local" : process.argv.includes("--linked") ? "--linked" : null;
  if (!target) {
    console.error("Choose a target: npm run set-host-pin -- --linked   (or --local)");
    process.exit(2);
  }

  const pin = await readHidden(`New host PIN (at least ${MIN_LENGTH} characters): `);
  if (pin.length < MIN_LENGTH) {
    console.error(`The PIN must be at least ${MIN_LENGTH} characters.`);
    process.exit(1);
  }
  if (process.stdin.isTTY) {
    const again = await readHidden("Repeat the PIN: ");
    if (again !== pin) {
      console.error("The two entries differ. Nothing was changed.");
      process.exit(1);
    }
  }

  const salt = bcrypt.genSaltSync(10).replace(/^\$2b\$/, "$2a$");
  const hash = bcrypt.hashSync(pin, salt);
  if (!/^\$2a\$10\$[./A-Za-z0-9]{53}$/.test(hash)) {
    console.error("Unexpected hash format. Nothing was changed.");
    process.exit(1);
  }

  const cli = join(process.cwd(), "node_modules", "supabase", "dist", "supabase.js");
  if (!existsSync(cli)) {
    console.error("Supabase CLI not found. Run `npm install` in the repository root first.");
    process.exit(1);
  }
  const sql = `select platform.set_host_pin_hash('${hash}');`;
  const result = spawnSync(process.execPath, [cli, "db", "query", target, sql], { stdio: ["ignore", "pipe", "inherit"] });
  if (result.status !== 0) {
    console.error("Setting the PIN failed. Check `supabase login` / `supabase link` and that migrations are applied.");
    process.exit(result.status ?? 1);
  }
  console.log(`Host PIN set (${target === "--local" ? "local stack" : "linked project"}). Store it in a password manager.`);
}

main();
