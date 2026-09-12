#!/usr/bin/env bash
# Script d'installation du raccourci bureau OpenMDL pour les PC du foyer
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="${HOME}/.local/share/openmdl"
ICON_DIR="${HOME}/.local/share/icons"
DESKTOP_DIR="${HOME}/.local/share/applications"

echo "📦 Préparation de l'installation de OpenMDL pour le foyer..."

mkdir -p "$APP_DIR"
mkdir -p "$ICON_DIR"
mkdir -p "$DESKTOP_DIR"

# Copie de l'icône
cp "${SCRIPT_DIR}/public/assets/logo_carre.png" "${ICON_DIR}/openmdl.png"

# Recherche du binaire ou de l'AppImage
EXEC_PATH=""
if [ -f "${SCRIPT_DIR}/src-tauri/target/release/openmdl" ]; then
  EXEC_PATH="${SCRIPT_DIR}/src-tauri/target/release/openmdl"
elif [ -f "${SCRIPT_DIR}/src-tauri/target/debug/openmdl" ]; then
  EXEC_PATH="${SCRIPT_DIR}/src-tauri/target/debug/openmdl"
fi

if [ -z "$EXEC_PATH" ]; then
  # Recherche d'un AppImage
  APPIMAGE_FILE=$(find "${SCRIPT_DIR}/src-tauri/target" -name "*.AppImage" 2>/dev/null | head -n 1)
  if [ -n "$APPIMAGE_FILE" ]; then
    EXEC_PATH="$APPIMAGE_FILE"
  fi
fi

if [ -z "$EXEC_PATH" ]; then
  echo "⚠️ Note: Le binaire compilé n'a pas encore été trouvé."
  echo "Pour créer l'exécutable, lancez d'abord : npm run build:app"
  EXEC_PATH="${APP_DIR}/openmdl"
fi

# Création du fichier .desktop pour le menu Linux
cat <<EOF > "${DESKTOP_DIR}/openmdl.desktop"
[Desktop Entry]
Version=1.0
Type=Application
Name=OpenMDL
GenericName=Logiciel de Caisse
Comment=Caisse & Foyer des Lycéens (MDL)
Exec=${EXEC_PATH}
Icon=openmdl
Terminal=false
Categories=Office;Finance;
Keywords=caisse;foyer;lycee;mdl;boisson;snack;
StartupWMClass=openmdl
EOF

chmod +x "${DESKTOP_DIR}/openmdl.desktop"

# Mise à jour de la base de données des applications du bureau
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "${DESKTOP_DIR}" || true
fi

echo "✅ OpenMDL a été ajouté au menu d'applications avec son icône de cannettes !"
echo "Vous pouvez maintenant le trouver en tapant 'OpenMDL' dans la barre de recherche des applications."
