"use client";
import { Show, SignInButton, UserButton, UserProfile } from "@clerk/nextjs";
import { useState } from "react";
export default function Verification() {
  const [result, setResult] = useState(null),
    [busy, setBusy] = useState(false);
  return (
    <section className="ev-stack identity-verification">
      <Show when="signed-out">
        <p>
          Sign in, connect GitHub, and verify your Solana wallet to establish
          who you are.
        </p>
        <SignInButton mode="modal">
          <button className="ev-button">Sign in to verify</button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <UserButton />
        <h2>1. Connect your accounts</h2>
        <p>
          In your account, connect GitHub and add your Solana wallet. Wallet
          verification proves control without sending funds.
        </p>
        <UserProfile routing="hash" />
        <h2>2. Verify your repository role</h2>
        <form
          className="ev-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setResult(null);
            const data = Object.fromEntries(new FormData(e.currentTarget));
            try {
              const response = await fetch("/api/identity/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
              });
              const value = await response.json();
              setResult(response.ok ? value : { error: value.error });
            } catch {
              setResult({
                error: "Verification is unavailable. Please retry.",
              });
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            GitHub repository
            <input
              name="repository"
              placeholder="https://github.com/owner/repository"
              required
              maxLength={200}
            />
          </label>
          <label>
            Verified Solana wallet
            <input name="wallet" required minLength={32} maxLength={44} />
          </label>
          <label>
            Your merged pull request number (for contributor verification)
            <input name="pullRequest" type="number" min="1" step="1" />
          </label>
          <button className="ev-button" disabled={busy}>
            {busy ? "Verifying…" : "Verify repository role"}
          </button>
        </form>
        <div role="status">
          {result?.error ? (
            <p>{result.error}</p>
          ) : (
            result && (
              <>
                <h3>
                  {result.role === "identity"
                    ? "GitHub identity verified; repository role not established"
                    : `Verified repository ${result.role}`}
                </h3>
                <p>
                  {result.login} · {result.repository}
                </p>
                <p>Wallet: {result.wallet}</p>
                <p>
                  This check does not approve adoption or payment. Governance
                  rechecks identity before approval.
                </p>
                <details>
                  <summary>Governance identity reference</summary>
                  <pre>{JSON.stringify(result, null, 2)}</pre>
                </details>
              </>
            )
          )}
        </div>
      </Show>
    </section>
  );
}
