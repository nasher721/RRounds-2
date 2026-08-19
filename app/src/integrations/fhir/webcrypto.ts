const webcrypto = globalThis.crypto;

if (!webcrypto) {
  throw new Error("This browser does not support the Web Crypto API required for secure EHR import.");
}

export default webcrypto;
