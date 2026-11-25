import type { ReactNode } from "react";

export function PrumoBrand() {
  return (
    <span className="prumo-brand">
      <img src="/icons/icon.svg?v=6" width={40} height={40} alt="" />
      <span>Prumo</span>
    </span>
  );
}

function WalletArtwork() {
  return (
    <div className="prumo-art" aria-hidden="true">
      <span className="prumo-art-sheet" />
      <span className="prumo-art-note" />
      <span className="prumo-art-pocket"><i /></span>
    </div>
  );
}

export function AccessLayout({ labelledBy, children }: { labelledBy: string; children: ReactNode }) {
  return (
    <main className="prumo-login">
      <div className="prumo-login-layout">
        <header className="prumo-login-cover">
          <PrumoBrand />
          <WalletArtwork />
          <p>Finanças pessoais</p>
        </header>
        <section className="prumo-login-form" aria-labelledby={labelledBy}>{children}</section>
      </div>
    </main>
  );
}

export function AppOpening({
  message = "Abrindo seu painel…",
  needsAttention = false,
  children,
}: {
  message?: string;
  needsAttention?: boolean;
  children?: ReactNode;
}) {
  return (
    <main className="prumo-opening">
      <div className="prumo-opening-layout">
        <header><PrumoBrand /></header>
        <WalletArtwork />
        <div className="prumo-opening-status">
          <h1>Finanças pessoais</h1>
          <p role="status">{message}</p>
          {needsAttention ? children : <div className="prumo-progress" aria-hidden="true"><i /></div>}
        </div>
      </div>
    </main>
  );
}
