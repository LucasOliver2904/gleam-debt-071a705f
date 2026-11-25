import { useRef,useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { exportBackup,getFinanceUser } from "@/lib/finance";
import { encryptBackup,decryptBackup,MAX_ENCRYPTED_BACKUP_BYTES } from "@/lib/encrypted-backup";
export function EncryptedBackupPanel({onPreview}:{onPreview:(text:string,source:string,owner:string|null)=>void}) {
 const [mode,setMode]=useState<"export"|"import">("export");
 const [password,setPassword]=useState("");
 const [confirm,setConfirm]=useState("");
 const [file,setFile]=useState<File|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const fileInput=useRef<HTMLInputElement>(null);
 function reset(next:"export"|"import"){setMode(next);setPassword("");setConfirm("");setFile(null);setError("");if(fileInput.current)fileInput.current.value="";}
 async function run(event:React.FormEvent){
  event.preventDefault();setError("");
  if(busy)return;
  const owner=getFinanceUser();if(!owner)return;
  if(mode==="export"&&(password.length<12||password!==confirm)){setError("Use pelo menos 12 caracteres e confirme a mesma senha.");return;}
  if(mode==="import"&&(!file||file.size>MAX_ENCRYPTED_BACKUP_BYTES)){setError("Selecione um arquivo protegido de até 21 MB.");return;}
  setBusy(true);
  try{
   if(mode==="export"){
    const encrypted=await encryptBackup(exportBackup(),password);
    if(owner!==getFinanceUser())throw Error("A conta mudou.");
    const url=URL.createObjectURL(new Blob([encrypted],{type:"application/json"}));
    const a=document.createElement("a");a.href=url;a.download="prumo-backup-protegido.json";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast.success("Backup protegido exportado.");
   }else if(file){
    const clear=await decryptBackup(await file.text(),password);
    if(owner!==getFinanceUser())throw Error("A conta mudou.");
    onPreview(clear,file.name,owner);
   }
   reset(mode);
  }catch(e){setError(e instanceof Error?e.message:"Não foi possível processar o backup.");}
  finally{setBusy(false);}
 }
 return <details className="rounded-xl border border-primary/25 bg-primary/5 p-3 sm:col-span-2"><summary className="cursor-pointer text-sm font-bold text-primary"><ShieldCheck size={18} className="mr-2 inline"/> Backup protegido por senha</summary><p className="mt-2 text-xs text-muted-foreground">AES-GCM de 256 bits e derivação PBKDF2. O arquivo é criptografado neste aparelho. Não há recuperação da senha; isso não criptografa os dados que já estão salvos no app.</p><div className="mt-3 flex gap-2"><button type="button" disabled={busy} aria-pressed={mode==="export"} onClick={()=>reset("export")} className="rounded-lg border border-border px-3 py-2 text-sm">Exportar protegido</button><button type="button" disabled={busy} aria-pressed={mode==="import"} onClick={()=>reset("import")} className="rounded-lg border border-border px-3 py-2 text-sm">Restaurar protegido</button></div><form onSubmit={run} className="mt-3 space-y-3">{mode==="import"&&<label className="block text-sm">Arquivo protegido<input ref={fileInput} type="file" accept=".json,application/json" className="mt-1 block w-full text-sm" disabled={busy} onChange={e=>setFile(e.target.files?.[0]??null)}/></label>}<label className="block text-sm">Senha do backup<input type="password" autoComplete={mode==="export"?"new-password":"off"} required maxLength={1024} disabled={busy} className="mt-1 w-full rounded-xl border border-input bg-background p-3" value={password} onChange={e=>setPassword(e.target.value)}/></label>{mode==="export"&&<label className="block text-sm">Confirmar senha do backup<input type="password" autoComplete="new-password" required maxLength={1024} disabled={busy} className="mt-1 w-full rounded-xl border border-input bg-background p-3" value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>}{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}<button type="submit" disabled={busy} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">{busy?"Processando...":mode==="export"?"Baixar backup criptografado":"Descriptografar e conferir"}</button></form></details>;
}
