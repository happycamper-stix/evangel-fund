import { test, expect } from "@playwright/test";
import release from "../../docs/DAO_RELEASE_CANDIDATE.json" with { type: "json" };
import { getAddressEncoder } from "@solana/kit";
test("reviewer page clearly separates message proof from transactions", async ({
  page,
}) => {
  await page.goto("/governor/rehearsal");
  await page.getByText("Wallet-control proof tools", { exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Devnet governance rehearsal." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Reviewer wallet verification" })
      .getByRole("status"),
  ).toContainText("No compatible wallet found");
  await expect(
    page.getByRole("button", { name: "Sign wallet-control message" }),
  ).toHaveCount(0);
});
test("configured address alone cannot produce a verified proof", async ({
  page,
}) => {
  await page.addInitScript(
    ({ walletAddress, publicKey }) => {
      const account = {
        address: walletAddress,
        publicKey: Uint8Array.from(publicKey),
        chains: ["solana:devnet"],
        features: ["solana:signMessage"],
      };
      const wallet = {
        version: "1.0.0",
        name: "Invalid-signature test wallet",
        icon: "data:image/svg+xml;base64,PHN2Zy8+",
        chains: ["solana:devnet"],
        accounts: [account],
        features: {
          "standard:connect": {
            version: "1.0.0",
            connect: async () => ({ accounts: [account] }),
          },
          "solana:signMessage": {
            version: "1.0.0",
            signMessage: async (input) => [
              { signedMessage: input.message, signature: new Uint8Array(64) },
            ],
          },
        },
      };
      window.addEventListener("wallet-standard:app-ready", (event) =>
        event.detail.register(wallet),
      );
    },
    {
      walletAddress: release.reviewers[0],
      publicKey: Array.from(getAddressEncoder().encode(release.reviewers[0])),
    },
  );
  await page.goto("/governor/rehearsal");
  await page.getByText("Wallet-control proof tools", { exact: true }).click();
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Invalid-signature test wallet", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Message to sign" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Sign wallet-control message" })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Reviewer wallet verification" })
      .getByRole("status"),
  ).toContainText("Wallet signature is invalid");
  await expect(
    page.getByRole("button", { name: "Download verification proof" }),
  ).toHaveCount(0);
});
