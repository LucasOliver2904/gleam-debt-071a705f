import { useEffect, useState } from "react";
import { Check, Palette, Sparkles } from "lucide-react";
import { toast } from "sonner";

type Accent = "emerald" | "ocean" | "violet";
const choices: { id: Accent; name: string; description: string; color: string; glow: string }[] = [
  { id: "emerald", name: "Prumo · Teal", description: "Combina com o novo ícone", color: "#2DD4BF", glow: "#0F4F4A" },
  { id: "ocean", name: "Azul executivo", description: "Clássico e tecnológico", color: "#4da6ff", glow: "#225a98" },
  { id: "violet", name: "Violeta", description: "Marcante e elegante", color: "#c4a0ff", glow: "#6e4dac" },
];

function currentAccent(): Accent {
  if (typeof window === "undefined") return "emerald";
  const stored = localStorage.getItem("meu-caixa-accent");
  return stored === "ocean" || stored === "violet" ? stored : "emerald";
}

export function AccentPicker() {
  const [accent, setAccent] = useState<Accent>("emerald");
  useEffect(() => { setAccent(currentAccent()); }, []);
  function choose(value: Accent) {
    setAccent(value);
    document.documentElement.dataset["accent"] = value;
    try { localStorage.setItem("meu-caixa-accent", value); }
    catch { toast("Visual aplicado nesta sessão. Não foi possível salvar a preferência no aparelho."); return; }
    toast.success("Visual atualizado para " + choices.find((item) => item.id === value)?.name + ".");
  }
  return (
    <section className="finance-surface rounded-2xl border border-border bg-card p-5">
      <header className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/12 text-primary"><Palette size={20}/></span>
        <div><h2 className="font-display text-lg font-extrabold">Sua identidade visual</h2><p className="mt-1 text-xs text-muted-foreground">O visual Prumo · Teal combina com o ícone. Os modos claro e escuro continuam disponíveis.</p></div>
      </header>
      <div className="mt-4 grid gap-3 sm:grid-cols-3" role="group" aria-label="Paleta de cores">
        {choices.map((choice) => (
          <button key={choice.id} type="button" onClick={() => choose(choice.id)} aria-pressed={accent === choice.id}
            className={"relative overflow-hidden rounded-2xl border p-3 text-left transition " +
              (accent === choice.id ? "border-primary bg-primary/7 ring-1 ring-primary/30" : "border-border bg-secondary/15 hover:border-primary/40")}>
            <div className="relative mb-3 h-16 overflow-hidden rounded-xl" style={{ background: "linear-gradient(115deg, " + choice.glow + ", #141f30)" }}>
              <div className="absolute left-3 top-3 h-3 w-16 rounded-full bg-white/25"/>
              <div className="absolute left-3 top-8 h-4 w-24 rounded-md bg-white/85"/>
              <div className="absolute bottom-2 right-3 h-6 w-6 rounded-lg" style={{ background: choice.color }}/>
              {accent === choice.id && <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-white text-slate-900"><Check size={15}/></span>}
            </div>
            <strong className="block text-xs font-extrabold">{choice.name}</strong>
            <span className="mt-1 block text-[11px] text-muted-foreground">{choice.description}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Sparkles size={15} className="text-accent"/> Sua preferência fica apenas neste aparelho e não altera dados financeiros.</p>
    </section>
  );
}
