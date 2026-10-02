import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Reader } from "../../lib/solana/program.mjs";
import { SQUADS } from "../../lib/solana/squads.mjs";
export async function loadSquads(svm) {
  const binary = await readFile(".evangel/references/squads-v4.so");
  if (
    createHash("sha256").update(binary).digest("hex") !==
    "dec8d3e0fae58c7c8f2416e5f67c25e673f047afd6dd2bba4a47e0b29a01d34c"
  )
    throw Error("Unexpected Squads binary");
  svm.addProgram(SQUADS, new Uint8Array(binary));
  const config = JSON.parse(
    await readFile(
      new URL("../fixtures/squads-program-config.json", import.meta.url),
      "utf8",
    ),
  );
  const data = new Uint8Array(Buffer.from(config.data[0], "base64"));
  svm.setAccount({
    address: config.address,
    lamports: BigInt(config.lamports),
    programAddress: SQUADS,
    executable: false,
    data,
  });
  const r = new Reader(data);
  r.take(8);
  r.pub();
  r.u64();
  const treasury = r.pub();
  return { treasury };
}
