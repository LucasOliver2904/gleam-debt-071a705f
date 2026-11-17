#!/usr/bin/env bash
set -euo pipefail
bun x wrangler@4 dev --config .output/server/wrangler.json --local --port 4173 --ip 127.0.0.1 > /tmp/meu-caixa-preview.log 2>&1 &
PREVIEW_PID=$!
trap 'kill "$PREVIEW_PID" 2>/dev/null || true' EXIT
ok=0
for i in $(seq 1 65); do
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
if grep -Eiq "This page didn't load|Something went wrong on our end|Não foi possível abrir o Prumo" /tmp/meu-caixa-home.html; then
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
for asset in /favicon.png /favicon.ico /icons/icon.svg /icons/icon-192.png /icons/icon-512.png /icons/icon-maskable-512.png /apple-touch-icon.png /manifest.webmanifest; do
  code=$(curl --max-time 8 --silent --output /tmp/meu-caixa-asset.dat --write-out '%{http_code}' "http://127.0.0.1:4173$asset" || true)
  if [ "$code" != "200" ] || [ ! -s /tmp/meu-caixa-asset.dat ]; then
    echo "ERRO: o ícone/recurso $asset não está acessível (HTTP $code)"
    exit 1
  fi
done
curl --max-time 8 --fail --silent http://127.0.0.1:4173/manifest.webmanifest?v=4 > /tmp/prumo-manifest.json
if ! grep -q '"short_name": "Prumo"' /tmp/prumo-manifest.json ||
   ! grep -q 'icon-maskable-512.png?v=4' /tmp/prumo-manifest.json; then
  echo 'ERRO: o manifest do Prumo está com nome ou versão de ícone antigos'
  exit 1
fi
echo 'OK: painel, rotas, ícones e identidade PWA Prumo versão 4 verificados pelo servidor real'
