// @vitest-environment node
import {describe,it,expect} from "vitest";
import {encryptBackup,decryptBackup} from "@/lib/encrypted-backup";
describe("Backup protegido",()=>{
 const secret="senha ficticia de teste";
 it("restaura conteúdo e rejeita senha incorreta",async()=>{const value=JSON.stringify({test:"dados fictícios"});const encrypted=await encryptBackup(value,secret);expect(encrypted).not.toContain("dados fictícios");expect(await decryptBackup(encrypted,secret)).toBe(value);await expect(decryptBackup(encrypted,"senha incorreta teste")).rejects.toThrow();},15000);
 it("rejeita senha fraca e formato inválido",async()=>{await expect(encryptBackup("{}", "curta")).rejects.toThrow();await expect(decryptBackup("{}",secret)).rejects.toThrow();});
});
