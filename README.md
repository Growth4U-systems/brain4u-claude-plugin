# Brain4U for Claude Code

Instala un Company Brain que aprende de tu contexto y conserva la experiencia que tus agentes necesitan para tomar mejores decisiones. Su agente predeterminado es un Chief of Staff con memoria privada propiedad de tu empresa.

Distribución piloto 0.4.0 como plugin de Claude Code. El repositorio del instalador y el Brain privado de cada usuario son independientes. Consulta [el alcance y las pruebas](docs/release-verification.md): las conexiones a proveedores, el despliegue en tu servidor y los canales se comprueban en tu propia instalación.

## Un comando y un wizard

Con los requisitos de abajo instalados, ejecuta en una terminal interactiva:

```bash
curl -fsSL https://raw.githubusercontent.com/Growth4U-systems/brain4u-claude-plugin/v0.4.0/install.sh | bash
```

`install.sh` registra el marketplace, instala y comprueba el plugin y abre `/brain4u-installer:brain4u-install`. Al recibir el script con `curl | bash`, conecta el wizard a la terminal interactiva. La entrada está fijada a la release 0.4.0; el marketplace instala la versión vigente del plugin. Si ya tienes Claude Code abierto, reinícialo para cargar el plugin.

Para comprobar un checkout de desarrollo sin abrir una conversación:

```bash
bash install.sh --source-directory "$PWD" --no-wizard
```

El wizard ofrece Brain y Hermes nuevos, solo Brain o conexión asistida con un Hermes existente. Solo Brain crea el repositorio privado sin registrar una clave para el runtime y se detiene antes de conectar OpenRouter o Hetzner. La conexión de un Hermes existente conserva su perfil y requiere comprobación asistida. [Opciones de instalación](docs/installation-options.md).

## Requisitos

- macOS, Linux o WSL; Windows nativo no está validado.
- Claude Code 2.1.169 o posterior, con una cuenta autorizada para usarlo.
- Node.js 20 o posterior, Git, GitHub CLI y OpenSSH.
- Sesión GitHub en la cuenta que será propietaria de la memoria privada: `gh auth login`.
- Para Hermes nuevo: cuentas propias de OpenRouter y Hetzner. El wizard consulta el precio vigente y exige confirmar el plan concreto antes de crear infraestructura.

No se necesita Docker en el ordenador del destinatario. El motor lo prepara en la VPS Ubuntu 24.04 x86_64. La imagen de Hermes se fija por digest; esta entrega usa la versión 0.20.5 comprobada, no un tag mutable `latest`.

## El Brain que aprende de tu negocio

La plantilla 3 reúne una wiki de conocimiento, reglas de privacidad y procedencia, skills para recordar y recuperar aprendizajes, hooks de sesión, un contrato de indexación GBrain de solo lectura, lint, revisión de cambios de comportamiento y el perfil Chief of Staff. Es una distribución portable de esa arquitectura. Los datos, servicios e integraciones particulares del Brain interno de Growth4U permanecen privados.

Hermes usa el Brain montado como `/opt/brain`, lee su índice y sus reglas y trabaja con archivos persistentes. Los aprendizajes y decisiones autorizados se destilan con fuente, fecha, responsable y privacidad; un helper publica solo el registro elegido y verifica el commit remoto. Los cambios de políticas, identidad, playbooks y comportamiento pasan por revisión humana. Un archivo local o un push fallido no se presenta como memoria canónica.

## Una memoria que mejora con el tiempo

Una tarea diaria en el Brain privado aplica la lógica de la última release estable pública. Valida rutas y checksums, conserva archivos personalizados y excluye el conocimiento del negocio. En la VPS nueva, una sincronización cada quince minutos solo trae cambios cuando el checkout está limpio y en `main`. No descarta trabajo ni elimina archivos. [Condiciones de actualización](docs/updates.md).

Cada mejora distribuible se publica como release estable. Una actualización del plugin o un commit al Brain interno no actualizan automáticamente todos los Brains de clientes. Hermes tiene su propio ciclo de compatibilidad.

## Habla con tu Chief of Staff

Slack y Google Chat son conexiones opcionales. Se configuran en las cuentas y el workspace del destinatario, después de verificar Hermes. No requieren pertenecer a Growth4U. Google Chat requiere Google Workspace y su configuración en Google Cloud. [Guía de canales](docs/messaging.md).

Sancho y Mission Control no forman parte del paquete.

## Memoria episódica opcional para Claude Code

El instalador intenta activar el plugin oficial MemSearch. Un conflicto, una descarga fallida o una política administrada no bloquean el Brain. También puede omitirse expresamente. Sus archivos `.memsearch/`, embeddings e índice permanecen fuera de GitHub. El resumen usa Claude Haiku y puede consumir cuota; la primera activación descarga el modelo ONNX bge-m3 de aproximadamente 558 MB. Un resumen solo sirve como candidato a aprendizaje hasta verificar sus fuentes y privacidad.

## Privacidad

Las credenciales entran en páginas locales privadas o en el asistente de Hermes, nunca en la conversación, la plantilla ni GitHub. Se guardan separadas de la configuración con permisos `0600`. El Brain del destinatario se crea privado. El instalador no ingiere automáticamente mensajes, correo ni datos de Growth4U.

La revisión de patrones e historial no detectó credenciales reales en el alcance examinado. No sustituye revisar cada release y sus archivos antes de publicarlos.

## Actualizar el instalador

```bash
claude plugin marketplace update brain4u
```

Reinicia Claude Code o ejecuta `/reload-plugins` para cargar el plugin actualizado.

## Licencia y fuentes

El código de esta distribución utiliza la licencia MIT. Los proyectos externos, incluidos Hermes y MemSearch, conservan sus propias licencias y no están incluidos en ese permiso. Consulta [las referencias y componentes](THIRD_PARTY.md).

Las contribuciones públicas se integran con los checks del instalador y aprobación explícita de un mantenedor. Las mejoras se distribuyen al publicar una release estable.
