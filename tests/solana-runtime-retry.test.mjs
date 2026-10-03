import test from "node:test";
import assert from "node:assert/strict";
import { rpc } from "../scripts/solana/runtime.mjs";
test("development RPC retries rate limits using the identical wire payload and stops at its bound", async () => {
  const bodies = [],
    delays = [];
  const result = await rpc("sendTransaction", ["signed-wire"], {
    fetcher: async (_, options) => {
      bodies.push(options.body);
      return bodies.length < 3
        ? new Response(null, { status: 429 })
        : Response.json({ result: "signature" });
    },
    sleep: async (ms) => delays.push(ms),
  });
  assert.equal(result, "signature");
  assert.equal(new Set(bodies).size, 1);
  assert.deepEqual(delays, [1000, 2000]);
  let attempts = 0;
  await assert.rejects(
    rpc("getBalance", [], {
      fetcher: async () => {
        attempts++;
        return new Response(null, { status: 429 });
      },
      sleep: async () => {},
    }),
    /HTTP 429/,
  );
  assert.equal(attempts, 5);
  attempts = 0;
  await assert.rejects(
    rpc("sendTransaction", [], {
      fetcher: async () => {
        attempts++;
        return Response.json({
          error: { code: -32002, message: "private provider details" },
        });
      },
      sleep: async () => {},
    }),
    (e) =>
      e.message.includes("-32002") && !e.message.includes("private provider"),
  );
  assert.equal(attempts, 1);
});
