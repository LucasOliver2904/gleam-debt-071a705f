// @vitest-environment node
import {describe,expect,it} from "vitest";
import {base64url,decode64,derToRaw,shouldLockAfterBackground,validateClientData,validateAuthenticatorData,verifyAssertion,type LockCredential} from "@/lib/device-lock";
const utf8=new TextEncoder();
const rpId="example.test",origin="https://example.test";
function der(raw:Uint8Array){
 const ints=[raw.slice(0,32),raw.slice(32)].map(n=>{let i=0;while(i<n.length-1&&n[i]===0)i++;const v=[...n.slice(i)];if(v[0]!&128)v.unshift(0);return [2,v.length,...v];});
 const body=ints.flat();return Uint8Array.from([48,body.length,...body]).buffer;
}
describe("Proteção local WebAuthn",()=>{
 it("exige minuto completo ou relógio alterado",()=>{expect(shouldLockAfterBackground(1000,60999)).toBe(false);expect(shouldLockAfterBackground(1000,61000)).toBe(true);expect(shouldLockAfterBackground(1000,999)).toBe(true);expect(shouldLockAfterBackground(null,90000)).toBe(false);});
 it("valida base64url e DER estritos",()=>{const bytes=Uint8Array.from([255,1,2]);expect(decode64(base64url(bytes))).toEqual(bytes);expect(()=>decode64("x===")).toThrow();const raw=new Uint8Array(64);raw[0]=128;raw[63]=1;expect(derToRaw(der(raw))).toEqual(raw);expect(()=>derToRaw(new Uint8Array([1,2]).buffer)).toThrow();});
 it("valida desafio, origem, flags UV/UP e assinatura real",async()=>{
   const pair=await crypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
   const publicKey=await crypto.subtle.exportKey("spki",pair.publicKey);
   const challenge=crypto.getRandomValues(new Uint8Array(32));
   const credential:LockCredential={version:1,id:"AQ",publicKey:base64url(new Uint8Array(publicKey)),rpId,origin};
   const clientDataJSON=utf8.encode(JSON.stringify({type:"webauthn.get",challenge:base64url(challenge),origin,crossOrigin:false})).buffer;
   const auth=new Uint8Array(37);auth.set(new Uint8Array(await crypto.subtle.digest("SHA-256",utf8.encode(rpId))));auth[32]=5;
   const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",clientDataJSON));const signed=new Uint8Array(69);signed.set(auth);signed.set(digest,37);
   const signature=der(new Uint8Array(await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},pair.privateKey,signed)));
   const assertion={id:"AQ",clientDataJSON,authenticatorData:auth.buffer,signature};
   await expect(verifyAssertion(credential,assertion,challenge)).resolves.toBeUndefined();
   await expect(verifyAssertion(credential,assertion,new Uint8Array(32))).rejects.toThrow();
   await expect(verifyAssertion(credential,{...assertion,id:"Ag"},challenge)).rejects.toThrow();
   expect(()=>validateClientData(clientDataJSON,"webauthn.get",challenge,"https://other.test")).toThrow();
   auth[32]=1;await expect(validateAuthenticatorData(auth.buffer,rpId)).rejects.toThrow();
   auth[32]=5;auth[36]=1;await expect(verifyAssertion(credential,assertion,challenge)).rejects.toThrow();
 });
});
