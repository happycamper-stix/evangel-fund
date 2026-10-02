import test from "node:test";
import assert from "node:assert/strict";
import { EACC_MINT, validateQuoteMint } from "../lib/solana/venue-policy.mjs";
const account = () => ({
  owner: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
  executable: false,
  data: {
    parsed: {
      type: "mint",
      info: {
        isInitialized: true,
        decimals: 6,
        mintAuthority: null,
        freezeAuthority: null,
        extensions: [
          {
            extension: "metadataPointer",
            state: { authority: null, metadataAddress: EACC_MINT },
          },
          {
            extension: "tokenMetadata",
            state: { updateAuthority: null, mint: EACC_MINT },
          },
        ],
      },
    },
  },
});
test("e/acc metadata-only quote is compatible without enabling the adapter", () => {
  const r = validateQuoteMint(EACC_MINT, account());
  assert.equal(r.venuePermissionlessMintCompatible, true);
  assert.equal(r.adapterEnabled, false);
});
test("unreviewed extensions and mutable authorities fail closed", () => {
  for (const extension of [
    "transferFeeConfig",
    "transferHook",
    "permanentDelegate",
    "confidentialTransferMint",
    "unknown",
  ]) {
    const a = account();
    a.data.parsed.info.extensions.push({ extension });
    assert.throws(() => validateQuoteMint(EACC_MINT, a));
  }
  for (const patch of [
    { mintAuthority: EACC_MINT },
    { freezeAuthority: EACC_MINT },
    { decimals: 9 },
    { isInitialized: false },
    { extensions: null },
  ]) {
    const a = account();
    Object.assign(a.data.parsed.info, patch);
    assert.throws(() => validateQuoteMint(EACC_MINT, a));
  }
  const a = account();
  a.data.parsed.info.extensions[0].state.authority = EACC_MINT;
  assert.throws(() => validateQuoteMint(EACC_MINT, a));
  assert.throws(() => validateQuoteMint("wrong", account()));
  const b = account();
  b.owner = EACC_MINT;
  assert.throws(() => validateQuoteMint(EACC_MINT, b));
});
