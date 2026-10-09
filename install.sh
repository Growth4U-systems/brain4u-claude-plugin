#!/usr/bin/env bash
# Entry point for a public HTTPS link. It installs the Claude Code plugin;
# the existing wizard owns provider onboarding, the cost plan and verification.
set -Eeuo pipefail

main() {
  local source='Growth4U-systems/brain4u-claude-plugin'
  local source_kind='github'
  local launch_wizard=true
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --no-wizard) launch_wizard=false; shift ;;
      --source-directory)
        [[ $# -ge 2 ]] || { printf 'Falta el directorio del marketplace.\n' >&2; return 2; }
        source="$(cd "$2" && pwd -P)"; source_kind='directory'; shift 2 ;;
      --help)
        printf 'Uso: bash install.sh [--no-wizard] [--source-directory <directorio>]\n'
        return 0 ;;
      *) printf 'Opción desconocida: %s\n' "$1" >&2; return 2 ;;
    esac
  done

  case "$(uname -s)" in
    Darwin|Linux) ;;
    *) printf 'Usa macOS, Linux o WSL. Windows nativo todavía no está validado.\n' >&2; return 1 ;;
  esac
  local command_name
  for command_name in node claude git gh ssh ssh-keygen; do
    command -v "$command_name" >/dev/null 2>&1 || {
      printf 'Falta %s. Instala las herramientas indicadas en la guía y vuelve a ejecutar este comando.\n' "$command_name" >&2
      return 1
    }
  done
  node -e 'if (Number(process.versions.node.split(".")[0]) < 20) process.exit(1)' || {
    printf 'Brain4U necesita Node.js 20 o posterior.\n' >&2; return 1;
  }
  local claude_version
  claude_version="$(claude --version)"
  node -e '
    const version = process.argv[1].match(/\b(\d+)\.(\d+)\.(\d+)\b/);
    if (!version) process.exit(1);
    const current = version.slice(1).map(Number), minimum = [2,1,169];
    for (let i=0; i<3; i++) {
      if (current[i] > minimum[i]) process.exit(0);
      if (current[i] < minimum[i]) process.exit(1);
    }
  ' "$claude_version" || {
    printf 'Actualiza Claude Code a la versión 2.1.169 o posterior.\n' >&2; return 1;
  }

  printf 'Brain4U: preparando el wizard en Claude Code.\n'
  local marketplaces source_state
  marketplaces="$(claude plugin marketplace list --json)"
  source_state="$(printf '%s' "$marketplaces" | node -e '
    const fs = require("fs");
    const entries = JSON.parse(fs.readFileSync(0,"utf8"));
    if (!Array.isArray(entries)) throw new Error("Respuesta de marketplaces inválida");
    const existing = entries.find(x => x.name === "brain4u");
    if (!existing) { process.stdout.write("missing"); process.exit(0); }
    const [kind, source] = process.argv.slice(1);
    const directory = existing.path || existing.installLocation;
    const trusted = kind === "github"
      ? existing.source === "github" && existing.repo === source
      : existing.source === "directory" && directory && fs.existsSync(directory) && fs.realpathSync(directory) === source;
    process.stdout.write(trusted ? "trusted" : "conflict");
  ' "$source_kind" "$source")"
  case "$source_state" in
    missing)
      if ! claude plugin marketplace add "$source" --scope user; then
        printf 'No se pudo acceder al marketplace. Comprueba la conexión y que el enlace de distribución sea público.\n' >&2
        return 1
      fi ;;
    trusted) claude plugin marketplace update brain4u ;;
    *)
      printf 'Ya hay un marketplace llamado brain4u con otro origen. Revisa /plugin antes de continuar; no se reemplazó.\n' >&2
      return 1 ;;
  esac
  claude plugin install brain4u-installer@brain4u --scope user
  local plugins plugin_state
  plugins="$(claude plugin list --json)"
  plugin_state="$(printf '%s' "$plugins" | node -e '
    const fs = require("fs");
    const entries = JSON.parse(fs.readFileSync(0,"utf8"));
    const plugin = entries.find(x => x.id === "brain4u-installer@brain4u" && x.scope === "user");
    process.stdout.write(!plugin ? "missing" : plugin.enabled ? "enabled" : "disabled");
  ')"
  if [[ "$plugin_state" == disabled ]]; then
    claude plugin enable brain4u-installer@brain4u --scope user
    plugins="$(claude plugin list --json)"
  fi
  printf '%s' "$plugins" | node -e '
    const fs = require("fs"), path = require("path");
    const entries = JSON.parse(fs.readFileSync(0,"utf8"));
    const plugin = entries.find(x => x.id === "brain4u-installer@brain4u" && x.scope === "user");
    if (!plugin?.enabled || !plugin.installPath) process.exit(1);
    for (const file of [".claude-plugin/plugin.json", "skills/brain4u-install/SKILL.md", "engine/bin/brain4u-installer.js"])
      if (!fs.existsSync(path.join(plugin.installPath,file))) process.exit(1);
    console.log("Plugin instalado y habilitado: " + plugin.version);
  ' || { printf 'La comprobación del plugin no pasó. El wizard no se inició.\n' >&2; return 1; }

  printf 'El wizard conectará tus cuentas y pedirá confirmar el coste antes de crear el servidor.\n'
  if ! gh auth status >/dev/null 2>&1; then
    printf 'Durante el wizard tendrás que iniciar sesión en tu propia cuenta GitHub para crear tu Brain privado.\n'
  fi
  if [[ "$launch_wizard" == false ]]; then
    printf 'Para continuar, abre Claude Code y ejecuta /brain4u-installer:brain4u-install\n'
    return 0
  fi
  # curl | bash consumes stdin. Give the interactive wizard its own terminal.
  if ! ( : </dev/tty ) 2>/dev/null; then
    printf 'Abre una terminal interactiva y ejecuta: claude /brain4u-installer:brain4u-install\n' >&2
    return 1
  fi
  exec claude '/brain4u-installer:brain4u-install' </dev/tty
}

main "$@"
