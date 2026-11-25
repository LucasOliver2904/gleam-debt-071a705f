const ITERATIONS=600_000;
const MAX_TEXT=15_000_000;
export const MAX_ENCRYPTED_BACKUP_BYTES=21_000_000;
const utf8=new TextEncoder();
function encode(bytes:Uint8Array) {
  let binary="";
  for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(binary);
}
function decode(s:string):Uint8Array<ArrayBuffer> {
  const binary=atob(s), out=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);
  return out;
}
async function key(password:string,salt:Uint8Array<ArrayBuffer>,provider:Crypto) {
  const material=await provider.subtle.importKey("raw",utf8.encode(password),"PBKDF2",false,["deriveKey"]);
  return provider.subtle.deriveKey({name:"PBKDF2",salt,iterations:ITERATIONS,hash:"SHA-256"},material,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
}
export async function encryptBackup(text:string,password:string,provider=globalThis.crypto) {
  if(!provider?.subtle)throw Error("Criptografia indisponível neste navegador.");
  if(password.length<12||password.length>1024)throw Error("Use uma senha de 12 a 1024 caracteres.");
  const plain=utf8.encode(text);
  if(plain.length>MAX_TEXT)throw Error("Backup grande demais.");
  const salt=provider.getRandomValues(new Uint8Array(16)),iv=provider.getRandomValues(new Uint8Array(12));
  const encrypted=await provider.subtle.encrypt({name:"AES-GCM",iv},await key(password,salt,provider),plain);
  return JSON.stringify({format:"prumo-encrypted",version:1,salt:encode(salt),iv:encode(iv),ciphertext:encode(new Uint8Array(encrypted))});
}
export async function decryptBackup(text:string,password:string,provider=globalThis.crypto) {
  if(!provider?.subtle)throw Error("Criptografia indisponível neste navegador.");
  if(text.length>MAX_ENCRYPTED_BACKUP_BYTES||password.length>1024)throw Error("Arquivo ou senha inválidos.");
  try{
    const o=JSON.parse(text) as {format?:unknown;version?:unknown;salt?:unknown;iv?:unknown;ciphertext?:unknown};
    if(o.format!=="prumo-encrypted"||o.version!==1||typeof o.salt!=="string"||typeof o.iv!=="string"||typeof o.ciphertext!=="string")throw Error();
    const salt=decode(o.salt),iv=decode(o.iv),ciphertext=decode(o.ciphertext);
    if(salt.length!==16||iv.length!==12||ciphertext.length<16||ciphertext.length>MAX_TEXT+16)throw Error();
    const plain=await provider.subtle.decrypt({name:"AES-GCM",iv},await key(password,salt,provider),ciphertext);
    return new TextDecoder("utf-8",{fatal:true}).decode(plain);
  }catch{throw Error("Senha incorreta ou backup protegido inválido. Nenhum dado foi alterado.");}
}
