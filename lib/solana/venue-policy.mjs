// Preconditions for the proposed DAMM v2 adapter; these do not enable trading.
export const DAMM_V2 = Object.freeze({
  program: "cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG",
  revision: "a85c926607433f23f0ea60f4ca7b1ae92f4156cb",
  protocolFeePercent: 20,
});
export const EACC_MINT = "CbcyNo7m1amFWqEQm2m4PLv1UNvpcL3C1Ujm6AkzpKoU";
const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
export function validateQuoteMint(mint, account) {
  if (
    mint !== EACC_MINT ||
    account?.owner !== TOKEN_2022 ||
    account.executable !== false
  )
    throw Error("Unexpected e/acc mint or token program.");
  const data = account.data?.parsed;
  const info = data?.info;
  if (
    data?.type !== "mint" ||
    !info ||
    info.isInitialized !== true ||
    info.decimals !== 6 ||
    info.mintAuthority !== null ||
    info.freezeAuthority !== null
  )
    throw Error(
      "Quote mint must be initialized with six decimals and revoked mint/freeze authorities.",
    );
  if (!Array.isArray(info.extensions))
    throw Error("Missing extension inspection.");
  const seen = new Set();
  for (const { extension, state } of info.extensions) {
    if (seen.has(extension)) throw Error("Duplicate mint extension.");
    seen.add(extension);
    if (extension === "metadataPointer") {
      if (state?.authority !== null || state.metadataAddress !== mint)
        throw Error("Mutable or external metadata pointer.");
    } else if (extension === "tokenMetadata") {
      if (state?.updateAuthority !== null || state.mint !== mint)
        throw Error("Mutable or mismatched token metadata.");
    } else throw Error(`Unreviewed quote extension: ${extension}`);
  }
  return {
    mint,
    decimals: info.decimals,
    extensions: [...seen].sort(),
    mintAuthority: null,
    freezeAuthority: null,
    venuePermissionlessMintCompatible: true,
    adapterEnabled: false,
  };
}
