// WebAuthn is an additional local screen lock, NOT a server authentication boundary.
export const BACKGROUND_LOCK_MS = 60_000;
export type LockCredential = { version: 1; id: string; publicKey: string; rpId: string; origin: string };
export type LockRecord = { status: "disabled" } | { status: "enabled"; credential: LockCredential } | { status: "unavailable" };
export const storageKey = (uid: string) => "prumo-device-lock-v1:" + uid;
export function base64url(bytes: Uint8Array) {
  let str = "";
  for (let i = 0; i < bytes.length; i += 8192) str += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function decode64(text: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) throw Error("Credencial inválida.");
  const bytes = Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), x => x.charCodeAt(0));
  if (base64url(bytes) !== text) throw Error("Credencial inválida.");
  return bytes;
}
export function readLock(uid: string): LockRecord {
  if (typeof window === "undefined") return { status: "disabled" };
  try {
    const raw = localStorage.getItem(storageKey(uid));
    if (raw === null) return { status: "disabled" };
    const c = JSON.parse(raw) as Partial<LockCredential>;
    if (c.version !== 1 || typeof c.id !== "string" || typeof c.publicKey !== "string" ||
        c.rpId !== location.hostname || c.origin !== location.origin ||
        c.id.length > 2048 || c.publicKey.length > 2048) return { status: "unavailable" };
    decode64(c.id); decode64(c.publicKey);
    return { status: "enabled", credential: c as LockCredential };
  } catch { return { status: "unavailable" }; }
}
export function storeLock(uid: string, credential: LockCredential | null) {
  if (credential) localStorage.setItem(storageKey(uid), JSON.stringify(credential));
  else localStorage.removeItem(storageKey(uid));
}
export async function platformAvailable() {
  try {
    return typeof window !== "undefined" && window.isSecureContext &&
      typeof PublicKeyCredential !== "undefined" && !!navigator.credentials &&
      !!crypto.subtle && typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function" &&
      typeof AuthenticatorAttestationResponse !== "undefined" &&
      typeof AuthenticatorAttestationResponse.prototype.getPublicKey === "function" &&
      typeof AuthenticatorAttestationResponse.prototype.getAuthenticatorData === "function" &&
      await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch { return false; }
}
const utf8 = new TextEncoder();
export function validateClientData(data: ArrayBuffer, type: "webauthn.create" | "webauthn.get", challenge: Uint8Array, origin: string) {
  const client = JSON.parse(new TextDecoder().decode(data)) as { type?: unknown; challenge?: unknown; origin?: unknown; crossOrigin?: unknown };
  if (client.type !== type || client.challenge !== base64url(challenge) || client.origin !== origin || client.crossOrigin === true)
    throw Error("Resposta de segurança inválida.");
}
export async function validateAuthenticatorData(data: ArrayBuffer, rpId: string) {
  const bytes = new Uint8Array(data);
  if (bytes.length < 37 || (bytes[32]! & 5) !== 5) throw Error("O dispositivo não confirmou a identidade.");
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", utf8.encode(rpId)));
  if (!hash.every((x, i) => x === bytes[i])) throw Error("Origem da credencial inválida.");
}
// WebAuthn ES256 signatures use ASN.1 DER; WebCrypto expects fixed-width r||s.
export function derToRaw(signature: ArrayBuffer): Uint8Array<ArrayBuffer> {
  const b = new Uint8Array(signature), raw = new Uint8Array(64);
  if (b.length < 8 || b.length > 72 || b[0] !== 0x30 || b[1] !== b.length - 2) throw Error("Assinatura inválida.");
  let at = 2;
  for (let i = 0; i < 2; i++) {
    if (b[at++] !== 2) throw Error("Assinatura inválida.");
    const length = b[at++];
    if (length === undefined || length < 1 || length > 33 || at + length > b.length) throw Error("Assinatura inválida.");
    let value = b.subarray(at, at + length); at += length;
    if (value[0]! & 0x80) throw Error("Assinatura inválida.");
    if (value.length > 1 && value[0] === 0) {
      if (!(value[1]! & 0x80)) throw Error("Assinatura inválida.");
      value = value.subarray(1);
    }
    if (value.length > 32) throw Error("Assinatura inválida.");
    raw.set(value, i * 32 + 32 - value.length);
  }
  if (at !== b.length) throw Error("Assinatura inválida.");
  return raw;
}
export async function verifyAssertion(credential: LockCredential, assertion: {
  id: string; clientDataJSON: ArrayBuffer; authenticatorData: ArrayBuffer; signature: ArrayBuffer;
}, challenge: Uint8Array) {
  if (assertion.id !== credential.id) throw Error("Credencial diferente da cadastrada.");
  validateClientData(assertion.clientDataJSON, "webauthn.get", challenge, credential.origin);
  await validateAuthenticatorData(assertion.authenticatorData, credential.rpId);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", assertion.clientDataJSON));
  const auth = new Uint8Array(assertion.authenticatorData);
  const signed = new Uint8Array(auth.length + digest.length);
  signed.set(auth); signed.set(digest, auth.length);
  const publicKey = await crypto.subtle.importKey("spki", decode64(credential.publicKey), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, derToRaw(assertion.signature), signed);
  if (!ok) throw Error("Assinatura de segurança inválida.");
}
export async function unlockWithDevice(credential: LockCredential, signal?: AbortSignal) {
  if (credential.rpId !== location.hostname || credential.origin !== location.origin) throw Error("Origem diferente da cadastrada.");
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const result = await navigator.credentials.get({
    publicKey: { challenge, rpId: credential.rpId, allowCredentials: [{ type: "public-key", id: decode64(credential.id), transports: ["internal"] }], userVerification: "required", timeout: 60_000 },
    ...(signal ? { signal } : {}),
  }) as PublicKeyCredential | null;
  if (!result || result.type !== "public-key") throw Error("Autenticação cancelada.");
  const response = result.response as AuthenticatorAssertionResponse;
  await verifyAssertion(credential, { id: result.id, clientDataJSON: response.clientDataJSON, authenticatorData: response.authenticatorData, signature: response.signature }, challenge);
}
export async function enrollDevice(uid: string, signal?: AbortSignal): Promise<LockCredential> {
  if (!await platformAvailable()) throw Error("Este navegador não oferece autenticação de dispositivo compatível.");
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const result = await navigator.credentials.create({
    publicKey: {
      challenge, rp: { name: "Prumo", id: location.hostname },
      user: { id: new Uint8Array(await crypto.subtle.digest("SHA-256", utf8.encode(uid))), name: "Prumo • conta pessoal", displayName: "Prumo" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      authenticatorSelection: { authenticatorAttachment: "platform", residentKey: "preferred", userVerification: "required" },
      timeout: 60_000, attestation: "none",
    },
    ...(signal ? { signal } : {}),
  }) as PublicKeyCredential | null;
  if (!result || result.type !== "public-key") throw Error("Cadastro cancelado.");
  const response = result.response as AuthenticatorAttestationResponse;
  const key = response.getPublicKey();
  if (!key || response.getPublicKeyAlgorithm() !== -7) throw Error("Credencial não compatível.");
  validateClientData(response.clientDataJSON, "webauthn.create", challenge, location.origin);
  await validateAuthenticatorData(response.getAuthenticatorData(), location.hostname);
  await crypto.subtle.importKey("spki", key, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  return { version: 1, id: base64url(new Uint8Array(result.rawId)), publicKey: base64url(new Uint8Array(key)), rpId: location.hostname, origin: location.origin };
}
export function shouldLockAfterBackground(hiddenAt: number | null, now: number) {
  return hiddenAt !== null && (now < hiddenAt || now - hiddenAt >= BACKGROUND_LOCK_MS);
}
