import { test, expect } from "@playwright/test";
import { setup } from "../support/solana-fixture.mjs";
import { FailedTransactionMetadata } from "litesvm";
import {
  getTransactionDecoder,
  signTransaction,
  getSignatureFromTransaction,
  getBase58Encoder,
  getAddressEncoder,
} from "@solana/kit";
import {
  getCreateAssociatedTokenIdempotentInstruction,
  getTransferCheckedInstruction,
} from "@solana-program/token-2022";
import { pda, pub, TOKEN, decodeAccount } from "../../lib/solana/program.mjs";
test("Wallet Standard signs an actual SBF launch and swap in isolated LiteSVM", async ({
  page,
}) => {
  const f = await setup(),
    config = {
      configured: true,
      launchEnabled: true,
      program: f.program,
      cluster: "devnet",
      chain: "solana:devnet",
    };
  const clock = f.svm.getClock();
  clock.unixTimestamp = BigInt(Math.floor(Date.now() / 1000));
  f.svm.setClock(clock);
  const ataProgram = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
  const quoteAccount = await pda(
    ataProgram,
    pub(f.owner.address),
    pub(TOKEN),
    pub(f.quoteMint),
  );
  await f.send([
    getCreateAssociatedTokenIdempotentInstruction(
      {
        payer: f.owner,
        ata: quoteAccount,
        owner: f.owner.address,
        mint: f.quoteMint,
      },
      { programAddress: ataProgram },
    ),
    getTransferCheckedInstruction({
      source: f.quoteToken,
      mint: f.quoteMint,
      destination: quoteAccount,
      authority: f.owner,
      amount: 100_000_000n,
      decimals: 6,
    }),
  ]);
  let transactions = 0;
  await page.route("**/api/solana/state", async (route) => {
    const all = f.svm
      .getProgramAccounts(f.program)
      .map((a) => ({ address: a.address, ...decodeAccount(a.data) }));
    await route.fulfill({
      json: {
        config,
        factory: all.find((a) => a.tag === 10),
        projects: all.filter((a) => a.tag === 2),
        feeDays: all.filter((a) => a.tag === 8),
        expenses: all.filter((a) => a.tag === 9),
        milestones: [],
        submissions: [],
        sponsorships: [],
      },
    });
  });
  await page.route("**/api/solana/rpc", async (route) => {
    const request = route.request().postDataJSON();
    if (request.method === "getLatestBlockhash")
      return route.fulfill({
        json: {
          result: {
            value: {
              blockhash: f.svm.latestBlockhash(),
              lastValidBlockHeight: 100000,
            },
          },
        },
      });
    if (request.method === "getSignatureStatuses")
      return route.fulfill({
        json: {
          result: { value: [{ confirmationStatus: "finalized", err: null }] },
        },
      });
    throw Error("Unexpected RPC");
  });
  await page.exposeFunction("signFixtureTransaction", async (bytes) => {
    const unsigned = getTransactionDecoder().decode(Uint8Array.from(bytes));
    const signed = await signTransaction([f.owner.keyPair], unsigned);
    const result = f.svm.sendTransaction(signed);
    if (result instanceof FailedTransactionMetadata)
      throw Error(result.meta().logs().join("\n"));
    transactions++;
    return Array.from(
      getBase58Encoder().encode(getSignatureFromTransaction(signed)),
    );
  });
  await page.addInitScript(
    ({ address, publicKey }) => {
      const account = {
        address,
        publicKey: Uint8Array.from(publicKey),
        chains: ["solana:devnet"],
        features: ["solana:signAndSendTransaction"],
      };
      const wallet = {
        version: "1.0.0",
        name: "Isolated test wallet",
        icon: "data:image/svg+xml;base64,PHN2Zy8+",
        chains: ["solana:devnet"],
        accounts: [account],
        features: {
          "standard:connect": {
            version: "1.0.0",
            connect: async () => ({ accounts: [account] }),
          },
          "solana:signAndSendTransaction": {
            version: "1.0.0",
            signAndSendTransaction: async (input) => [
              {
                signature: Uint8Array.from(
                  await window.signFixtureTransaction(
                    Array.from(input.transaction),
                  ),
                ),
              },
            ],
          },
        },
      };
      window.addEventListener("wallet-standard:app-ready", (event) =>
        event.detail.register(wallet),
      );
    },
    {
      address: f.owner.address,
      publicKey: Array.from(getAddressEncoder().encode(f.owner.address)),
    },
  );
  await page.goto("/launch");
  await page.getByRole("button", { name: "Connect Solana wallet" }).click();
  await page
    .getByRole("button", { name: "Isolated test wallet", exact: true })
    .click();
  await page.getByLabel("Project name", { exact: true }).fill("Browser launch");
  await page.getByLabel("Ticker (A–Z)").fill("BROWSER");
  await page
    .getByLabel("Repository, post or creator URL")
    .fill("https://github.com/example/browser");
  await page.getByRole("button", { name: "Create coin", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Finalized on Solana devnet.",
  );
  await expect(
    page.getByRole("heading", { name: "Browser launch / BROWSER" }),
  ).toBeVisible();
  await page.getByText("Trade BROWSER", { exact: true }).click();
  await page.getByLabel("e/acc to spend").fill("0.1");
  await page.getByRole("button", { name: "Confirm buy", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Finalized on Solana devnet.",
  );
  expect(transactions).toBe(2);
  const projects = f.svm
    .getProgramAccounts(f.program)
    .map((a) => decodeAccount(a.data))
    .filter((a) => a.tag === 2);
  expect(projects.find((p) => p.symbol === "BROWSER").quoteReserve).toBe(
    "95000",
  );
  // Exercise actual daily close and wallet ATA payout, not merely rendered balances.
  await f.adopt();
  await f.initDay();
  await f.send(
    f.call(
      "swap",
      {
        buy: true,
        amount: 100_000_000n,
        minOut: 1n,
        deadline: f.svm.getClock().unixTimestamp + 300n,
      },
      [
        f.keys.project,
        f.keys.mint,
        f.keys.pool,
        f.ownerToken,
        "11111111111111111111111111111111",
        TOKEN,
      ],
    ),
  );
  const day = { ...f.daily };
  f.advance(86400);
  await page.clock.install({
    time: new Date(Number(f.svm.getClock().unixTimestamp) * 1000),
  });
  await page.reload();
  await page.getByRole("button", { name: "Connect Solana wallet" }).click();
  await page
    .getByRole("button", { name: "Isolated test wallet", exact: true })
    .click();
  const card = page.locator("article.sol-milestone").filter({
    has: page.getByRole("heading", {
      name: new RegExp(
        "OSS work · " +
          new Date(Number(day.day) * 86400000).toISOString().slice(0, 10),
      ),
    }),
  });
  await card.getByRole("button", { name: "Settle daily surplus" }).click();
  await expect(
    card.getByRole("button", { name: "Settle daily surplus" }),
  ).toHaveCount(0);
  const before = f.tokenBalance(quoteAccount);
  await card
    .getByRole("button", { name: "Send development income to project owner" })
    .click();
  await expect(
    card.getByRole("button", {
      name: "Send development income to project owner",
    }),
  ).toBeDisabled();
  await expect
    .poll(() => f.tokenBalance(quoteAccount) - before)
    .toBe(4_350_000n);
  await page.getByRole("button", { name: /OSS work · \$WORK/ }).click();
  await page
    .getByText("Propose a milestone to the agent", { exact: true })
    .click();
  await page.getByLabel("Work recipient").selectOption("developer");
  await page.getByLabel("Reward asset").selectOption("quote");
  await expect(page.getByLabel("Work recipient")).toHaveValue("community");
  await expect(
    page.getByLabel("Work recipient").locator('option[value="developer"]'),
  ).toHaveAttribute("disabled", "");
});
