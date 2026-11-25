import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Fingerprint, LockKeyhole, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BACKGROUND_LOCK_MS, enrollDevice, platformAvailable, readLock, shouldLockAfterBackground, storageKey, storeLock, unlockWithDevice } from "@/lib/device-lock";

type LockControls = { enabled: boolean; supported: boolean | null; busy: boolean; enable: () => Promise<void>; disable: () => Promise<void>; lockNow: () => void };
const DeviceLockContext = createContext<LockControls | null>(null);
const field = "mt-2 w-full rounded-xl border border-input bg-background p-3 text-sm";
const primary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50";
const secondary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-semibold disabled:opacity-50";

export function DeviceLockGate({userId,email,children}:{userId:string;email?:string|undefined;children:ReactNode}) {
  const [record,setRecord]=useState(()=>readLock(userId));
  const [locked,setLocked]=useState(()=>readLock(userId).status!=="disabled");
  const [supported,setSupported]=useState<boolean|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [recovery,setRecovery]=useState(false);
  const [password,setPassword]=useState("");
  const operation=useRef<AbortController|null>(null);
  const hiddenAt=useRef<number|null>(null);
  const generation=useRef(0);
  const alive=useRef(true);

  useEffect(()=>{
    alive.current=true;
    void platformAvailable().then(value=>{if(alive.current)setSupported(value);});
    return ()=>{alive.current=false;operation.current?.abort();operation.current=null;};
  },[]);
  function lockNow(){
    generation.current++;
    operation.current?.abort();
    setLocked(true);setRecovery(false);setPassword("");setError("");
  }
  useEffect(()=>{
    if(record.status==="disabled")return;
    let timer: ReturnType<typeof setTimeout>|undefined;
    function visibility(){
      if(document.hidden){
        hiddenAt.current=Date.now();
        clearTimeout(timer);
        timer=setTimeout(()=>{if(document.hidden)lockNow();},BACKGROUND_LOCK_MS);
      }else{
        clearTimeout(timer);
        if(shouldLockAfterBackground(hiddenAt.current,Date.now()))lockNow();
        hiddenAt.current=null;
      }
    }
    const pageHide=()=>lockNow();
    const pageShow=(event:PageTransitionEvent)=>{if(event.persisted)lockNow();};
    const storage=(event:StorageEvent)=>{
      if(event.key!==null&&event.key!==storageKey(userId))return;
      const next=readLock(userId);
      generation.current++;
      operation.current?.abort();
      setRecord(next);
      setLocked(next.status!=="disabled");
    };
    document.addEventListener("visibilitychange",visibility);
    window.addEventListener("pagehide",pageHide);
    window.addEventListener("pageshow",pageShow);
    window.addEventListener("storage",storage);
    visibility();
    return ()=>{clearTimeout(timer);hiddenAt.current=null;document.removeEventListener("visibilitychange",visibility);window.removeEventListener("pagehide",pageHide);window.removeEventListener("pageshow",pageShow);window.removeEventListener("storage",storage);};
  },[record.status,userId]);
  // Disabled devices must also learn when another tab enables the lock.
  useEffect(()=>{
    if(record.status!=="disabled")return;
    const storage=(event:StorageEvent)=>{if(event.key===null||event.key===storageKey(userId)){const next=readLock(userId);if(next.status!=="disabled"){generation.current++;operation.current?.abort();setRecord(next);setLocked(true);}}};
    window.addEventListener("storage",storage);
    return ()=>window.removeEventListener("storage",storage);
  },[record.status,userId]);

  async function run(action:(signal:AbortSignal,valid:()=>boolean)=>Promise<void>){
    if(operation.current)return;
    const controller=new AbortController(),revision=generation.current;
    operation.current=controller;setBusy(true);setError("");
    const valid=()=>alive.current&&!controller.signal.aborted&&generation.current===revision;
    try{await action(controller.signal,valid);}
    catch(e){if(valid()){const message=e instanceof Error&&e.name!=="NotAllowedError"&&e.name!=="AbortError"?e.message:"Autenticação cancelada ou indisponível. Tente novamente.";setError(message);if(!locked)toast.error(message);}}
    finally{if(operation.current===controller){operation.current=null;if(alive.current)setBusy(false);}}
  }
  const enable=()=>run(async(signal,valid)=>{
    if(record.status!=="disabled")return;
    const credential=await enrollDevice(userId,signal);
    if(!valid())return;
    // Confirm the newly registered credential actually works before enabling.
    await unlockWithDevice(credential,signal);
    if(!valid())return;
    storeLock(userId,credential);setRecord({status:"enabled",credential});setLocked(false);toast.success("Bloqueio do dispositivo ativado.");
  });
  const disable=()=>run(async(signal,valid)=>{
    if(record.status!=="enabled")return;
    await unlockWithDevice(record.credential,signal);
    if(!valid())return;
    storeLock(userId,null);setRecord({status:"disabled"});setLocked(false);toast.success("Bloqueio desativado neste navegador.");
  });
  const unlock=()=>run(async(signal,valid)=>{
    if(record.status!=="enabled")throw Error("Credencial local indisponível. Use a recuperação.");
    await unlockWithDevice(record.credential,signal);
    if(valid()){setLocked(false);setRecovery(false);setPassword("");}
  });
  const recover=(event:React.FormEvent)=>{
    event.preventDefault();
    void run(async(_signal,valid)=>{
      if(!email||!password)throw Error("Informe a senha da sua conta.");
      const {data,error}=await supabase.auth.signInWithPassword({email,password});
      if(error||data.user?.id!==userId)throw Error("Não foi possível confirmar sua senha.");
      if(!valid())return;
      storeLock(userId,null);setRecord({status:"disabled"});setLocked(false);setRecovery(false);setPassword("");toast.success("Bloqueio local redefinido. Você pode cadastrar novamente em Ajustes.");
    });
  };
  const signOut=()=>run(async()=>{
    const {error}=await supabase.auth.signOut({scope:"local"});
    if(error)throw Error("Não foi possível sair. Tente novamente.");
  });

  if(locked||record.status==="unavailable")return <main className="grid min-h-[100dvh] place-items-center bg-background p-5 text-foreground">
    <section className="finance-surface w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center sm:p-8">
      <div className="mx-auto grid size-20 place-items-center rounded-3xl border border-primary/20 bg-primary/10 text-primary"><Fingerprint aria-hidden="true" size={46}/></div>
      <p className="finance-kicker mt-6">PRUMO / ÁREA PRIVADA</p>
      <h1 className="mt-2 font-display text-2xl font-extrabold">Prumo bloqueado</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Use a segurança do seu dispositivo para acessar suas finanças.</p>
      {record.status==="enabled"&&<button type="button" className={primary+" mt-6 w-full"} disabled={busy} onClick={()=>void unlock()}><Fingerprint size={20}/>{busy?"Verificando...":"Desbloquear com biometria ou PIN"}</button>}
      {error&&<p role="alert" className="mt-4 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <button type="button" disabled={busy} className="mt-4 text-sm font-semibold text-primary" onClick={()=>{setRecovery(v=>!v);setPassword("");setError("");}}>{recovery?"Cancelar recuperação":"Não consigo desbloquear"}</button>
      {recovery&&<div className="mt-4 space-y-3 rounded-xl border border-border p-4 text-left">
        <p className="text-sm font-bold">Redefinir bloqueio local</p>
        {email&&<form onSubmit={recover} className="space-y-3"><label className="block text-sm">Senha da conta Prumo<input className={field} type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/></label><button type="submit" disabled={busy||!password} className={primary+" w-full"}>Confirmar senha e redefinir</button></form>}
        <p className="text-xs leading-relaxed text-muted-foreground">Se você entra somente com Google e não tem senha da conta, use a recuperação de acesso do provedor. Como último recurso, a limpeza dos dados do site neste navegador remove o bloqueio local, mas pode apagar alterações ainda não sincronizadas. Não limpe os dados se houver registros pendentes.</p>
      </div>}
      <button type="button" disabled={busy} className={secondary+" mt-4 w-full"} onClick={()=>void signOut()}><LogOut size={16}/> Sair da conta</button>
      <p className="mt-5 text-xs text-muted-foreground">A proteção usa a verificação do dispositivo. Nenhuma impressão digital é armazenada pelo Prumo.</p>
    </section>
  </main>;
  return <DeviceLockContext.Provider value={{enabled:record.status==="enabled",supported,busy,enable,disable,lockNow}}>{children}</DeviceLockContext.Provider>;
}

export function DeviceLockSettings(){
  const lock=useContext(DeviceLockContext);
  if(!lock)return null;
  return <section className="finance-surface rounded-2xl border border-border bg-card p-5" aria-label="Segurança e privacidade">
    <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary"><ShieldCheck size={23}/></span><div><h2 className="font-display text-lg font-bold">Segurança e privacidade</h2><p className="mt-1 text-sm text-muted-foreground">Bloqueio de tela com biometria ou PIN do dispositivo.</p></div></div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3"><div><p className="text-sm font-semibold">{lock.enabled?"Proteção ativa neste navegador":"Proteção desativada"}</p><p className="mt-1 text-xs text-muted-foreground">Bloqueia ao reabrir, recarregar ou ficar 1 minuto em segundo plano.</p></div><button type="button" className={primary} disabled={lock.busy||(!lock.enabled&&lock.supported!==true)} onClick={()=>void(lock.enabled?lock.disable():lock.enable())}><Fingerprint size={17}/>{lock.busy?"Verificando...":lock.enabled?"Desativar":"Ativar biometria"}</button></div>
    {lock.enabled?<button type="button" disabled={lock.busy} onClick={lock.lockNow} className={secondary+" mt-3"}><LockKeyhole size={16}/> Bloquear agora</button>:<p className="mt-3 text-xs text-muted-foreground">{lock.supported===null?"Verificando compatibilidade...":lock.supported?"O aparelho pode pedir duas confirmações no cadastro para testar o desbloqueio.":"O navegador não encontrou autenticação de dispositivo compatível. Use HTTPS e configure o bloqueio de tela no aparelho."}</p>}
    <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Camada adicional ao login, por navegador e conta. Não criptografa o armazenamento local, não impede acesso por ferramentas do desenvolvedor e não substitui o login do Prumo. O sistema decide entre impressão digital, face ou PIN.</p>
  </section>;
}
