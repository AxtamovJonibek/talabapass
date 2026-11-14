#!/usr/bin/env bash
# Airnet VPS deploy: serverda /var/www/talabapass da ishlaydi (GitHub Actions SSH orqali yoki qo'lda).
# Hech qachon seed, `migrate dev` yoki `migrate reset` chaqirilmaydi. Batafsil: docs/server.md.
#
# Butun mantiq main() ichida: git reset shu faylni almashtirsa ham bash allaqachon o'qib bo'lgan bo'ladi.
# Shu sabab deploy.sh dagi o'zgarish keyingi deploy'dan kuchga kiradi.
set -euo pipefail

APP_DIR=/var/www/talabapass
ENV_FILE=/etc/talabapass/env
BACKUP_DIR=/var/backups/talabapass
BACKUP_KEEP=10
LOCK_FILE=/run/lock/talabapass-deploy.lock
HEALTH_URL=http://127.0.0.1:3000/
HEALTH_SECONDS=30

PREV=""
UPDATED=0
DONE=0

log() { printf '[%s] %s\n' "$(date '+%F %T')" "$*"; }
fail() { log "XATO: $*" >&2; exit 1; }

# pg_dump (libpq) Prisma'ning `schema=` parametrini tanimaydi — faqat shuni olib tashlaymiz.
pg_url() {
  local url="$1"
  [[ "$url" == *\?* ]] || { printf '%s' "$url"; return; }
  local query
  query=$(tr '&' '\n' <<<"${url#*\?}" | grep -v '^schema=' | paste -sd '&' || true)
  printf '%s%s' "${url%%\?*}" "${query:+?$query}"
}

healthy() {
  local code i
  for ((i = 0; i < HEALTH_SECONDS; i++)); do
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "$HEALTH_URL" || true)
    if [[ "$code" =~ ^[23][0-9][0-9]$ ]]; then
      log "Sayt javob berdi (HTTP $code)."
      return 0
    fi
    sleep 1
  done
  log "Sayt ${HEALTH_SECONDS} soniyada javob bermadi (oxirgi HTTP kodi: ${code:-000})." >&2
  return 1
}

install_deps() { npm ci --include=dev --no-audit --no-fund; }
build_app() { NODE_OPTIONS=--max-old-space-size=3072 npm run build; }

# Toza muhit: sirlar PM2 xotirasi/dump'iga tushmaydi, ilova ularni faqat --env-file dan oladi.
reload_app() {
  env -i HOME="$HOME" PATH="$PATH" pm2 startOrReload ecosystem.config.cjs --update-env
  env -i HOME="$HOME" PATH="$PATH" pm2 save >/dev/null
}

rollback() {
  log "ORQAGA QAYTARISH: ${PREV:0:12} commit'iga qaytilmoqda (migratsiyalar qaytarilmaydi)..."
  # Alohida buyruq sifatida: `&&`/`||` ichida subshell'dagi `set -e` o'chib qoladi.
  set +e
  (
    set -euo pipefail
    git reset --hard "$PREV"
    install_deps
    build_app
    reload_app
    healthy
  )
  local rc=$?
  set -e
  if ((rc == 0)); then
    log "Orqaga qaytarildi: ${PREV:0:12} ishlab turibdi."
  else
    log "XATO: orqaga qaytarish ham o'tmadi — qo'lda aralashing (docs/server.md)." >&2
  fi
}

on_exit() {
  local code=$?
  if ((DONE == 0 && UPDATED == 1)) && [[ -n "$PREV" ]]; then
    rollback
  fi
  ((DONE == 1)) || log "Deploy muvaffaqiyatsiz (kod $code)." >&2
  exit "$code"
}

main() {
  cd "$APP_DIR"

  exec 9>"$LOCK_FILE"
  log "Boshqa deploy tugashi kutilmoqda (agar bo'lsa)..."
  flock -w 900 9 || fail "15 daqiqada qulf bo'shamadi — boshqa deploy hali ishlayapti."

  [[ -r "$ENV_FILE" ]] || fail "$ENV_FILE topilmadi yoki o'qib bo'lmaydi."
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
  [[ -n "${DATABASE_URL:-}" ]] || fail "DATABASE_URL $ENV_FILE da yo'q."

  PREV=$(git rev-parse HEAD)
  log "1/8 Kod yangilanmoqda (joriy: ${PREV:0:12})..."
  git fetch origin main
  trap on_exit EXIT
  git reset --hard origin/main
  UPDATED=1
  local next
  next=$(git rev-parse HEAD)
  log "Yangi commit: ${next:0:12} — $(git log -1 --format=%s)"

  log "2/8 Paketlar o'rnatilmoqda (npm ci)..."
  install_deps

  log "3/8 Muhit tekshiruvi..."
  npx tsx scripts/check-env.mts

  log "4/8 Baza nusxasi olinmoqda..."
  mkdir -p "$BACKUP_DIR"
  local dump
  dump="$BACKUP_DIR/pre-deploy-$(date +%Y%m%d-%H%M%S).dump"
  pg_dump -Fc --dbname="$(pg_url "$DATABASE_URL")" -f "$dump.part"
  mv "$dump.part" "$dump"
  log "Nusxa: $dump ($(du -h "$dump" | cut -f1))"
  ls -1t "$BACKUP_DIR"/pre-deploy-*.dump | tail -n +$((BACKUP_KEEP + 1)) | xargs -r rm -f --

  log "5/8 Migratsiyalar (prisma migrate deploy)..."
  npx prisma migrate deploy

  log "6/8 Universitetlar ro'yxati sinxronlanmoqda..."
  npx tsx scripts/universities.mts

  log "7/8 Build (next build)..."
  build_app

  log "8/8 PM2: ilova yangilanmoqda..."
  reload_app

  log "Sog'lik tekshiruvi: $HEALTH_URL"
  healthy || fail "Yangi versiya javob bermadi."

  DONE=1
  log "Deploy tugadi: ${next:0:12}."
}

main "$@"
