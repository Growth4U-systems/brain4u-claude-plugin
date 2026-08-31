# Brain4U installer for Claude Code

Plugin autocontenido para instalar Brain4U en una VPS de Hetzner propiedad del usuario.

## Probar localmente

```bash
claude --plugin-dir /ruta/absoluta/brain4u-installer
```

Dentro de Claude Code, pedir: `Instala Brain4U`.

## Instalar desde el marketplace local

Mientras el marketplace no este publicado, puede registrarse desde el directorio que contiene `.claude-plugin/marketplace.json`:

```bash
claude plugin marketplace add /ruta/absoluta/brain4u-autoinstaller --scope user
claude plugin install brain4u-installer@brain4u --scope user
```

Cuando se publique el repositorio, la primera ruta se sustituira por su URL. No hace falta cambiar el plugin.

El plugin crea primero un repositorio privado `brain4u` en la cuenta GitHub del usuario y carga la plantilla vacia incluida: LLM Wiki, configuracion GBrain read-only, reglas y workflows inspirados en GStack, gobernanza, privacidad, hooks, skills de memoria, lint y escritura por pull request. Registra una clave de despliegue dedicada para ese repositorio. Despues prepara la configuracion, abre paginas locales para conectar OpenRouter y Hetzner, consulta el precio vigente y exige una confirmacion concreta antes de crear infraestructura. Una vez confirmado, provisiona la VPS, clona el Brain, lo monta en Hermes como `/opt/brain`, instala el runtime y verifica la conexion completa.

## Dependencias del cliente

- Claude Code.
- GitHub CLI (`gh`) con una sesion autenticada.
- Node.js 20 o superior.
- OpenSSH con `ssh-keygen`.
- Una cuenta de OpenRouter, que puede crearse durante el recorrido.
- Una cuenta de Hetzner con facturacion habilitada, que puede crearse durante el recorrido.

No se necesita Docker en el ordenador del usuario. Docker se instala en la VPS.
El plugin crea una clave SSH dedicada bajo `~/.ssh/brain4u_installer_ed25519` para administrar la VPS y otra clave aislada bajo `~/.brain4u-installer/<installationId>/credentials/` para conectar esa instalacion con su repositorio Brain. Solo las crea cuando faltan y nunca reemplaza otras claves. La configuracion privada se genera bajo `~/.brain4u-installer/`, sin tokens ni claves de proveedor.

## Verificar el paquete

```bash
bash ./scripts/self-test.sh
claude plugin validate --strict .
```

## Seguridad

- No pegar tokens o claves en la conversacion.
- La preparacion local no contacta Hetzner ni crea recursos remotos.
- La clave de OpenRouter entra por una pagina local, se valida directamente y se guarda con permisos `0600`.
- El token de Hetzner entra por una pagina local y se guarda con permisos `0600`.
- El plan no modifica infraestructura.
- La creacion de la VPS requiere el codigo del plan vigente.
- El plugin no contiene rollback destructivo automatico.
