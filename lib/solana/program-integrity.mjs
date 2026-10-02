import { createHash } from "node:crypto";
export function verifyProgramBytes(bytes, baseline) {
  if (
    !Number.isSafeInteger(baseline?.binaryLength) ||
    baseline.binaryLength < 1 ||
    !/^[a-f0-9]{64}$/.test(baseline.binarySha256 || "")
  )
    throw Error("Missing reviewed binary length/hash baseline.");
  if (
    bytes.length < baseline.binaryLength ||
    bytes.subarray(baseline.binaryLength).some((b) => b !== 0)
  )
    throw Error("Program allocation contains unexpected executable bytes.");
  if (
    createHash("sha256")
      .update(bytes.subarray(0, baseline.binaryLength))
      .digest("hex") !== baseline.binarySha256
  )
    throw Error("Deployed program differs from reviewed binary.");
  return true;
}
