// User-selected existing Solana mainnet asset. Never deploy a replacement mint.
export const EACC = Object.freeze({
  mint: "CbcyNo7m1amFWqEQm2m4PLv1UNvpcL3C1Ujm6AkzpKoU",
  chain: "Solana mainnet",
  symbol: "e/acc",
  decimals: 6,
  tokenProgram: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
  explorer:
    "https://solscan.io/token/CbcyNo7m1amFWqEQm2m4PLv1UNvpcL3C1Ujm6AkzpKoU",
  strategy: "quote-asset",
  settlementEnabled: false,
});
