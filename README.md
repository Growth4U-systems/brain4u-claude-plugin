# Brain4U for Claude Code

Marketplace privado de Growth4U para instalar Brain4U desde Claude Code.

## Requisitos

- Acceso a este repositorio privado de GitHub.
- Claude Code 2.1.169 o posterior.
- Node.js 20 o posterior.
- OpenSSH con `ssh-keygen`.
- GitHub CLI (`gh`) autenticado en la cuenta donde se creara el Brain.
- Una cuenta de OpenRouter.
- Una cuenta de Hetzner con facturacion habilitada.

No se necesita Docker en el ordenador del usuario. El instalador lo configura en la VPS.

## Instalar

Primero autentica GitHub en el ordenador donde se ejecuta Claude Code:

```bash
gh auth login
```

Despues instala el marketplace y el plugin:

```bash
claude plugin marketplace add Growth4U-systems/brain4u-claude-plugin --scope user
claude plugin install brain4u-installer@brain4u --scope user
```

Abre Claude Code y escribe:

```text
Instala Brain4U
```

## Que hace esta version

El plugin crea en la cuenta GitHub del usuario un repositorio privado `brain4u` a partir de la plantilla vacia incluida: LLM Wiki, configuracion GBrain read-only, reglas y workflows inspirados en GStack, gobernanza, privacidad, hooks, skills de memoria, lint y escritura por pull request. Registra una clave de despliegue dedicada, clona ese Brain en la VPS y lo monta en Hermes como `/opt/brain`, su memoria y directorio de trabajo. Tambien guia al usuario para conectar sus propias cuentas de OpenRouter y Hetzner, consulta el precio vigente, exige confirmacion antes de crear recursos, provisiona la VPS e instala y verifica Hermes.

El repositorio GitHub es la fuente de verdad privada propiedad del usuario. La VPS conserva su clon y ejecuta Hermes, que arranca desde el indice del Brain, aplica sus reglas y puede trabajar sobre sus archivos de forma persistente.

## Privacidad y seguridad

- No pegues tokens ni claves en la conversacion.
- Las credenciales entran mediante paginas locales y se guardan con permisos `0600`.
- El plan no crea infraestructura.
- La VPS solo se crea tras una confirmacion explicita vinculada al precio vigente.
- El repositorio no contiene credenciales de Hetzner, OpenRouter ni instalaciones reales.

## Actualizar

```bash
claude plugin marketplace update brain4u
```

Reinicia Claude Code o ejecuta `/reload-plugins` para cargar la version actualizada.
