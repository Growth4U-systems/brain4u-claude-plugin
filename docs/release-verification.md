# Estado verificable de la distribución

Revisión del 9 de octubre de 2026. Rama `codex/company-brain-pilot`, plugin 0.4.0, motor 0.8.0, plantilla 3. Preparada en PR 2, sin publicación pública ni nuevo despliegue VPS acreditados.

## Comprobado

- Manifiestos del marketplace y del plugin válidos con Claude Code 2.1.278. La entrada local instaló realmente el plugin 0.4.0, habilitado y con alcance de usuario, en una configuración aislada de Claude; esa prueba no abrió la conversación ni usó un origen público.
- Pruebas del bootstrap, aislamiento de cuentas, guardado Git y actualizador correctas. El self-test del motor y el lint también pasan.
- La imagen oficial de Hermes 0.20.5 pudo leer y escribir el Brain al corregir propietario UID/GID 10000 y los límites de escritura. Antes podía leerlo, pero no guardar aprendizajes ni leer su clave dedicada.
- Hermes respondió realmente usando `openrouter/free` sobre una empresa ficticia. Identificó su rol Chief of Staff, escribió un archivo sintético en el Brain y lo recuperó después de reiniciar el contenedor.
- No aparecieron las claves de la prueba en los logs revisados. Las credenciales de prueba se conservaron fuera del checkout del instalador y no forman parte del paquete.
- La memoria autorizada se publicó en un remoto Git local y pudo recuperarse en un clon nuevo. El helper conservó cambios ajenos y bloqueó contenido sensible, falta de procedencia y commits ajenos pendientes.
- El actualizador conserva conocimientos del negocio y archivos personalizados; rechaza rutas de datos, checksums incorrectos, symlinks y downgrades. El manifiesto contiene únicamente lógica genérica.
- El código distribuido no contiene el remoto del Brain interno, sus rutas, endpoints de Sancho ni webhooks de Slack de Growth4U. El propietario se resuelve desde la cuenta GitHub del destinatario; una configuración de otra cuenta se rechaza antes de acceder a su repositorio.

## Pendiente antes de ofrecer instalación pública completada

- Publicar esta distribución y una release estable; probar el script y el marketplace sin acceso privado a Growth4U.
- Completar la conversación del wizard y un despliegue real Ubuntu/Hetzner con un plan de coste confirmado. Las pruebas Docker locales no validan cloud-init, SSH, firewall ni el timer de systemd en esa VPS.
- Ejecutar el workflow de actualización en un Brain privado real y comprobar el resultado remoto y su llegada al runtime.
- Conectar y comprobar una respuesta real desde un Slack o Google Chat propiedad del destinatario. La guía de configuración no acredita una conexión activa.
- Actualizar la guía PDF con el único comando público comprobado y el alcance final.

La instalación de un Hermes arbitrario existente sigue siendo asistida. El contrato `gbrain.yml` describe la frontera de indexación; no distribuye un servidor de búsqueda. MemSearch es opcional, se obtiene de upstream y tiene su propio ciclo de actualización.

El Brain privado interno conserva su contexto. La única fuente compartida para instalaciones externas será la release pública del [instalador](https://github.com/Growth4U-systems/brain4u-claude-plugin). No hay sincronización de conocimientos entre empresas, credenciales compartidas ni recepción de sus datos por Growth4U implementadas en este paquete.
