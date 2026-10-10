#!/usr/bin/env bash
# iOS duman testi: Release simülatör derlemesi → kur → aç → ekran boş değil mi → derin bağlantılar.
# iOS tarafı (ios/, src/platform, capacitor.config.ts, index.html) değişince çalıştır.
# Kullanım: bash scripts/ios-smoke.sh ["iPhone 18 Pro"]   — hata olursa 1 ile çıkar.
set -euo pipefail

DEVICE="${1:-iPhone 18 Pro}"
APP_ID=com.mirzayildiran.kartlimitlerim
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT

fail() { echo "✗ $1"; exit 1; }

UDID=$(xcrun simctl list devices available -j | python3 -c "
import json, sys
name = sys.argv[1]
for devs in json.load(sys.stdin)['devices'].values():
    for d in devs:
        if d['name'] == name: print(d['udid']); sys.exit()
" "$DEVICE")
[ -n "$UDID" ] || fail "simülatör bulunamadı: $DEVICE"
xcrun simctl boot "$UDID" 2>/dev/null || true
xcrun simctl bootstatus "$UDID" -b >/dev/null

echo "→ derleme (Release, simülatör)"
CAP_NATIVE=1 npm run build >/dev/null
npx cap sync ios >/dev/null
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -destination "id=$UDID" -derivedDataPath "$OUT/dd" build >"$OUT/build.log" 2>&1 \
  || { tail -20 "$OUT/build.log"; fail "derleme başarısız"; }

xcrun simctl uninstall "$UDID" "$APP_ID" 2>/dev/null || true
xcrun simctl install "$UDID" "$OUT/dd/Build/Products/Release-iphonesimulator/App.app"

# Ekranın orta bandında içerik (metin, kart) var mı: tek renkli boş ya da beyaz ekran değil.
# 10 sn'ye kadar yoklar; kurulumdan sonraki ilk açılış en yavaşıdır.
check() {
  local label="$1" shot="$OUT/$2.png"
  for _ in $(seq 1 20); do
    xcrun simctl io "$UDID" screenshot "$shot" >/dev/null 2>&1
    if python3 - "$shot" <<'PY'
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('L').resize((60, 130))
px = list(im.crop((5, 20, 55, 110)).getdata())
sys.exit(0 if max(px) - min(px) > 60 else 1)
PY
    then echo "✓ $label"; return; fi
    sleep 0.5
  done
  fail "$label: ekran 10 sn boş kaldı"
}

echo "→ açılış"
xcrun simctl launch "$UDID" "$APP_ID" >/dev/null
check "açılış" launch

# Yalnız ekranın boş kalmadığını denetler; bağlantının doğru yere gitmesi birim testlerde
# (src/platform/deeplinks.test.ts). Bağlantı uygulamayı çökertirse ya da boş bırakırsa burada yakalanır.
for link in takvim harcama-ekle; do
  xcrun simctl openurl "$UDID" "kartlimitlerim://$link"
  sleep 2
  check "kartlimitlerim://$link" "$link"
done

echo "duman testi geçti ($DEVICE)"
