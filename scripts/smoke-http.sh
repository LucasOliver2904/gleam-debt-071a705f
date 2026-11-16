#!/usr/bin/env bash
set -euo pipefail
bun x vite preview --host 127.0.0.1 --port 4173 --strictPort > /tmp/meu-caixa-preview.log 2>&1 &
PREVIEW_PID=$!
trap 'kill "$PREVIEW_PID" 2>/dev/null || true' EXIT
ok=0
for i in $(seq 1 40); do
  code=$(curl --max-time 4 --silent --output /tmp/meu-caixa-home.html --write-out '%{http_code}' http://127.0.0.1:4173/ || true)
  if [ "$code" = "200" ]; then
    ok=1
    break
  fi
  sleep 1
done
if [ "$ok" != "1" ]; then
  echo 'ERRO: painel não responde HTTP 200'
  tail -120 /tmp/meu-caixa-preview.log
  exit 1
fi
if grep -Eiq "This page didn't load|Something went wrong on our end|Não foi possível abrir o Meu Caixa" /tmp/meu-caixa-home.html; then
  echo 'ERRO: foi retornada a página de falha interna'
  tail -120 /tmp/meu-caixa-preview.log
  exit 1
fi
grep -qi '<html' /tmp/meu-caixa-home.html
for route in / /dividas /lancamentos /pix /extrato /ajustes; do
  code=$(curl --max-time 8 --silent --output /tmp/meu-caixa-route.html --write-out '%{http_code}' "http://127.0.0.1:4173$route" || true)
  if [ "$code" != "200" ] || ! grep -qi '<html' /tmp/meu-caixa-route.html; then
    echo "ERRO: rota $route respondeu $code"
    tail -120 /tmp/meu-caixa-preview.log
    exit 1
  fi
done
echo 'OK: painel e todas as rotas críticas abriram de verdade via HTTP'
