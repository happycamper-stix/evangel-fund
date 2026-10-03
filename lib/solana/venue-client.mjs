// Instruction construction only. Public launch remains gated by deployment review.
import {
  pda,
  pub,
  instruction,
  launchAddresses,
  feeDayAddresses,
  TOKEN,
  SYSTEM,
  LOADER,
} from "./program.mjs";
import { DAMM_V2 } from "./venue-policy.mjs";
import { planOneSidedLaunch, venueAddresses } from "./damm-plan.mjs";
export const venueComputeBudget = () => ({
  programAddress: "ComputeBudget111111111111111111111111111111",
  data: Uint8Array.of(2, 128, 26, 6, 0),
  accounts: [],
}); // 400,000 CU
export async function custodyVenueAccounts(program, project, mint, quoteMint) {
  const nft = await pda(program, "venue-nft", pub(project));
  const a = await venueAddresses(mint, quoteMint, nft);
  return [
    DAMM_V2.program,
    a.poolAuthority,
    a.pool,
    a.position,
    nft,
    a.positionNftAccount,
    a.baseVault,
    a.quoteVault,
    a.eventAuthority,
    await pda(LOADER, pub(DAMM_V2.program)),
  ];
}
function readonly(ix, addresses) {
  return {
    ...ix,
    accounts: ix.accounts.map((a) =>
      addresses.includes(a.address) ? { ...a, role: 0 } : a,
    ),
  };
}
export async function launchVenueInstruction({
  program,
  creator,
  count,
  quoteMint,
  sponsor,
  sponsorQuote,
  name,
  symbol,
  source,
  sqrtMin,
  sqrtMax,
}) {
  const keys = await launchAddresses(program, creator.address, count),
    plan = planOneSidedLaunch({ sqrtMin, sqrtMax });
  const venue = await custodyVenueAccounts(
    program,
    keys.project,
    keys.mint,
    quoteMint,
  );
  const ix = instruction(
    program,
    "launchVenue",
    { name, symbol, source, ...plan },
    [
      creator.address,
      keys.factory,
      keys.project,
      keys.mint,
      keys.pool,
      keys.reserve,
      SYSTEM,
      TOKEN,
      quoteMint,
      keys.quotePool,
      sponsor.address,
      sponsorQuote,
      ...venue,
    ],
    [creator, sponsor],
  );
  return {
    keys,
    plan,
    instruction: readonly(ix, [
      quoteMint,
      venue[0],
      venue[1],
      venue[8],
      venue[9],
    ]),
  };
}
export async function collectVenueInstruction({
  program,
  caller,
  project,
  mint,
  quoteMint,
  day,
}) {
  const factory = await pda(program, "factory"),
    base = await pda(program, "pool", pub(project)),
    quote = await pda(program, "quote-pool", pub(project));
  const { feeDay, feeVault } = await feeDayAddresses(program, project, day);
  const venue = await custodyVenueAccounts(program, project, mint, quoteMint);
  const ix = instruction(
    program,
    "collectVenue",
    {},
    [
      caller.address,
      factory,
      project,
      mint,
      base,
      quoteMint,
      quote,
      feeDay,
      feeVault,
      TOKEN,
      ...venue,
    ],
    [caller],
  );
  return readonly(ix, [
    factory,
    project,
    mint,
    quoteMint,
    venue[0],
    venue[1],
    venue[2],
    venue[4],
    venue[5],
    venue[8],
    venue[9],
  ]);
}
