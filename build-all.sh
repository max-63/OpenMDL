#!/usr/bin/env bash
# ==============================================================================
# OpenMDL - Multi-Platform Release Builder
# Génère les paquets pour Linux (AppImage, DEB/Mint, RPM/Fedora) et Windows (.exe)
# ==============================================================================

set -uo pipefail

# Assure la compatibilité glibc moderne pour AppImage et l'accès à cargo
export NO_STRIP=true
export PATH="$HOME/.cargo/bin:$PATH"

# Couleurs & Formats ANSI
BOLD="\033[1m"
DIM="\033[2m"
RESET="\033[0m"

RED="\033[1;31m"
GREEN="\033[1;32m"
YELLOW="\033[1;33m"
BLUE="\033[1;34m"
CYAN="\033[1;36m"
MAGENTA="\033[1;35m"

LOGS_DIR=".build_logs"
OUTPUT_DIR="dist-installers"
mkdir -p "$LOGS_DIR" "$OUTPUT_DIR"

# Liste des cibles
LABELS=(
  "Linux AppImage (Universel toutes distros)"
  "Linux DEB      (Ubuntu, Linux Mint, Debian)"
  "Linux RPM      (Fedora, RedHat, openSUSE)"
  "Windows (.exe) (Installateur NSIS Windows 10/11)"
)

COMMANDS=(
  "npx tauri build --bundles appimage"
  "npx tauri build --bundles deb"
  "npx tauri build --bundles rpm"
  "npx tauri build --target x86_64-pc-windows-gnu --bundles nsis"
)

LOG_FILES=(
  "$LOGS_DIR/build_appimage.log"
  "$LOGS_DIR/build_deb.log"
  "$LOGS_DIR/build_rpm.log"
  "$LOGS_DIR/build_windows.log"
)

# États initiaux : PENDING, RUNNING, SUCCESS, FAILED
STATUS=("PENDING" "PENDING" "PENDING" "PENDING")
DURATIONS=("-" "-" "-" "-")
ERROR_MSGS=("" "" "" "")

TOTAL_TARGETS=4
SPINNER_FRAMES=("⠋" "⠙" "⠹" "⠸" "⠼" "⠴" "⠦" "⠧" "⠇" "⠏")

# Nettoyage à l'interruption
trap 'tput cnorm 2>/dev/null; echo -e "\n${RED}Build annulé par l utilisateur.${RESET}"; exit 130' INT TERM

draw_dashboard() {
  local frame_idx="$1"
  local active_elapsed="$2"

  # Efface l'écran ou remonte pour réafficher proprement
  clear
  echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════════════════╗${RESET}"
  echo -e "${BOLD}${CYAN}║                    OpenMDL - Compilation Multi-Plateformes           ║${RESET}"
  echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════════════════╝${RESET}"
  echo -e "${DIM} Dossier de destination final : ${OUTPUT_DIR}/${RESET}"
  echo -e "${DIM} Logs détaillés : ${LOGS_DIR}/${RESET}\n"

  for i in $(seq 0 $((TOTAL_TARGETS - 1))); do
    local label="${LABELS[$i]}"
    local st="${STATUS[$i]}"
    local dur="${DURATIONS[$i]}"
    local status_badge=""

    case "$st" in
      "PENDING")
        status_badge="${DIM}⏳ EN ATTENTE  ${RESET} [ --- ]"
        ;;
      "RUNNING")
        local s_char="${SPINNER_FRAMES[$frame_idx]}"
        status_badge="${CYAN}${s_char} EN COURS... ${RESET} [ ${BOLD}${active_elapsed}s${RESET} ]"
        ;;
      "SUCCESS")
        status_badge="${GREEN}✔ SUCCÈS     ${RESET} [ ${dur}s ]"
        ;;
      "FAILED")
        status_badge="${RED}✖ ÉCHEC      ${RESET} [ ${dur}s ]"
        ;;
    esac

    printf "  ${BOLD}[%d]${RESET} %-48s %b\n" "$((i + 1))" "$label" "$status_badge"
    if [ "$st" = "FAILED" ] && [ -n "${ERROR_MSGS[$i]}" ]; then
      echo -e "      ${RED}↳ Erreur : ${ERROR_MSGS[$i]} (voir ${LOG_FILES[$i]})${RESET}"
    fi
  done
  echo ""
}

# Masque le curseur pour un rendu fluide
tput civis 2>/dev/null || true

# 1. Étape préliminaire : Build frontend Vite
echo -e "${BOLD}${BLUE}==> Préparation du frontend (TypeScript & Vite bundle)...${RESET}"
npm run build > "$LOGS_DIR/frontend_build.log" 2>&1
if [ $? -ne 0 ]; then
  echo -e "${RED}Erreur lors du build frontend. Consultez ${LOGS_DIR}/frontend_build.log${RESET}"
  tput cnorm 2>/dev/null || true
  exit 1
fi

# 2. Lancement séquentiel des builds avec Dashboard animé
START_TOTAL=$(date +%s)

for idx in $(seq 0 $((TOTAL_TARGETS - 1))); do
  STATUS[$idx]="RUNNING"
  cmd="${COMMANDS[$idx]}"
  logfile="${LOG_FILES[$idx]}"

  START_TIME=$(date +%s)

  # Lance la commande en tâche de fond
  eval "$cmd" > "$logfile" 2>&1 &
  CMD_PID=$!

  frame=0
  while kill -0 "$CMD_PID" 2>/dev/null; do
    NOW=$(date +%s)
    ELAPSED=$((NOW - START_TIME))
    draw_dashboard "$frame" "$ELAPSED"
    frame=$(( (frame + 1) % ${#SPINNER_FRAMES[@]} ))
    sleep 0.2
  done

  wait "$CMD_PID"
  EXIT_CODE=$?
  END_TIME=$(date +%s)
  DURATION=$((END_TIME - START_TIME))
  DURATIONS[$idx]="$DURATION"

  if [ $EXIT_CODE -eq 0 ]; then
    STATUS[$idx]="SUCCESS"
  else
    STATUS[$idx]="FAILED"
    # Extrait la dernière ligne d'erreur significative du log
    ERR_LINE=$(grep -iE "error:|erreur:|failed" "$logfile" | tail -n 1 | tr -d '\r\n' | cut -c1-60)
    [ -z "$ERR_LINE" ] && ERR_LINE="Code de sortie $EXIT_CODE"
    ERROR_MSGS[$idx]="$ERR_LINE"
  fi

  draw_dashboard 0 0
done

# Réactive le curseur
tput cnorm 2>/dev/null || true

# 3. Collecte des installateurs générés
echo -e "${BOLD}${CYAN}────────────────────────────────────────────────────────────────────────${RESET}"
echo -e "${BOLD}📁 Récupération et inventaire des paquets générés :${RESET}\n"

# Copie depuis les dossiers Tauri vers dist-installers/
find src-tauri/target/release/bundle -type f \( -name "*.AppImage" -o -name "*.deb" -o -name "*.rpm" \) -exec cp -f {} "$OUTPUT_DIR/" \; 2>/dev/null || true
find src-tauri/target/x86_64-pc-windows-gnu/release/bundle -type f \( -name "*.exe" -o -name "*.msi" \) -exec cp -f {} "$OUTPUT_DIR/" \; 2>/dev/null || true

FOUND_ANY=0
for file in "$OUTPUT_DIR"/*; do
  if [ -f "$file" ]; then
    FOUND_ANY=1
    SIZE=$(du -h "$file" | cut -f1)
    FILENAME=$(basename "$file")
    echo -e "  ${GREEN}📦 ${BOLD}${FILENAME}${RESET} (${SIZE})  -> ${DIM}${file}${RESET}"
  fi
done

if [ $FOUND_ANY -eq 0 ]; then
  echo -e "  ${YELLOW}Aucun installateur n'a pu être copié dans ${OUTPUT_DIR}/.${RESET}"
fi

TOTAL_ELAPSED=$(( $(date +%s) - START_TOTAL ))
echo -e "\n${BOLD}${GREEN}✔ Opération terminée en ${TOTAL_ELAPSED}s !${RESET}\n"
