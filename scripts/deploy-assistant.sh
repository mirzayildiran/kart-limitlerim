#!/usr/bin/env bash
# Bütçe asistanı aracı sunucusunu (worker/assistant-proxy) Cloudflare Workers'a kurar,
# yapay zekâ anahtarlarını Worker'a gizli değer olarak yükler ve adresini yazar.
# GitHub Actions'ta deploy.yml çalıştırır. Gerekenler (depo "Actions secrets"):
#   CLOUDFLARE_API_TOKEN  "Edit Cloudflare Workers" şablonuyla oluşturulmuş token
#   GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY  en az biri
# Token yoksa hiçbir şey yapmaz; uygulama sohbetsiz derlenir.
set -euo pipefail
export WRANGLER_SEND_METRICS=false

WRANGLER="npx --yes wrangler@4.149.0"
API="https://api.cloudflare.com/client/v4"
ORIGIN="https://mirzayildiran.github.io"

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "CLOUDFLARE_API_TOKEN tanımlı değil; asistan aracısı kurulmadan geçiliyor."
  exit 0
fi

cf() { curl -sS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "content-type: application/json" "$@"; }

if [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  CLOUDFLARE_ACCOUNT_ID=$(cf "$API/accounts?per_page=5" | jq -r '.result[0].id // empty')
fi
if [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
  echo "::error::Cloudflare hesabı bulunamadı. Token'ın 'Account' erişimi olmalı."
  exit 1
fi
export CLOUDFLARE_ACCOUNT_ID

# Yeni hesaplarda workers.dev alt alanı yoktur ve wrangler deploy bunu soramaz; bir kez oluştur.
SUB=$(cf "$API/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/subdomain" | jq -r '.result.subdomain // empty')
if [ -z "$SUB" ]; then
  SUB="kart-limitlerim-${CLOUDFLARE_ACCOUNT_ID:0:6}"
  echo "workers.dev alt alanı oluşturuluyor: $SUB"
  cf -X PUT --data "{\"subdomain\":\"$SUB\"}" "$API/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/subdomain" \
    | jq -e '.success' >/dev/null
fi

cd worker/assistant-proxy
$WRANGLER deploy

SECRETS_FILE="${RUNNER_TEMP:-/tmp}/assistant-secrets.json"
trap 'rm -f "$SECRETS_FILE"' EXIT
jq -n \
  --arg g "${GEMINI_API_KEY:-}" \
  --arg q "${GROQ_API_KEY:-}" \
  --arg o "${OPENROUTER_API_KEY:-}" \
  '{GEMINI_API_KEY: $g, GROQ_API_KEY: $q, OPENROUTER_API_KEY: $o} | with_entries(select(.value != ""))' \
  > "$SECRETS_FILE"
if [ "$(jq 'length' "$SECRETS_FILE")" = "0" ]; then
  echo "::warning::Hiç yapay zekâ anahtarı yok; aracı 'not_configured' yanıtı verecek."
else
  $WRANGLER secret bulk "$SECRETS_FILE"
fi

URL="https://kart-limitlerim-asistan.$SUB.workers.dev"
echo "Aracı adresi: $URL"

# Duman testi: yalnızca durum kodu yazılır, yanıt metni günlüğe girmez.
sleep 5
STATUS=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$URL/" \
  -H "Origin: $ORIGIN" -H 'content-type: application/json' \
  --data '{"v":1,"summary":{"date":"2026-01-01","power":{},"outlook":{},"accounts":[],"categories":[],"insights":[]},"messages":[{"role":"user","text":"Merhaba"}]}' \
  || echo "000")
echo "Duman testi durum kodu: $STATUS"
[ "$STATUS" = "200" ] || echo "::warning::Aracı duman testinde $STATUS döndü."

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "url=$URL" >> "$GITHUB_OUTPUT"
fi
