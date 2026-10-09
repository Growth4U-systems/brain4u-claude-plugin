# Estado verificable de la distribución

Revisión del 9 de octubre de 2026. Distribución pública estable: plugin 0.4.0, motor 0.8.0 y plantilla 3. La [PR 2](https://github.com/Growth4U-systems/brain4u-claude-plugin/pull/2) está integrada y la [release v0.4.0](https://github.com/Growth4U-systems/brain4u-claude-plugin/releases/tag/v0.4.0) está publicada.

## Comprobado con la distribución publicada

- El comando público y su marketplace se descargaron sin credenciales de Growth4U. El plugin 0.4.0 se instaló y habilitó con alcance de usuario en una configuración aislada de Claude Code 2.1.278. Esta prueba usó `--no-wizard`; no recorrió la conversación del asistente.
- El motor creó un Brain privado en una cuenta personal GitHub y configuró una clave de despliegue limitada a ese repositorio. El destinatario utiliza su propia cuenta.
- Se ejecutaron `plan`, `apply` y `verify --smoke-inference` sobre una VPS Ubuntu existente y dedicada a pruebas. El motor conectó el repositorio, preparó los archivos de Hermes y recreó su servicio después de verificar una copia de seguridad. No creó otro servidor ni incrementó el coste de infraestructura.
- Hermes 0.20.5, fijado por digest de la imagen oficial, respondió mediante `openrouter/free` como Chief of Staff. Su usuario UID/GID 10000 pudo leer y escribir el Brain y utilizar su clave dedicada. El gateway quedó enlazado solo a localhost.
- El agente escribió un aprendizaje ficticio con fuente, lo publicó mediante el helper en GitHub y verificó el commit remoto. Tras reiniciar Hermes, una conversación nueva recuperó el código exacto y el criterio de negocio. El primer registro tenía una cabecera inválida: el publicador lo rechazó y el agente lo corrigió antes de publicarlo.
- El workflow de actualización se ejecutó correctamente en ese Brain privado. Comprobó la release pública 0.4.0 sin cambiar archivos porque ya estaba instalada. El aprendizaje permaneció intacto. El salto entre versiones se verifica en las pruebas locales.
- El servicio de sincronización de la VPS recibió por fast-forward un nuevo commit del repositorio privado, conservando el aprendizaje anterior y dejando la copia limpia. El timer de 15 minutos está activo. Se activó manualmente el servicio para comprobar la recepción sin esperar al siguiente intervalo.
- No aparecieron las claves de prueba en los logs revisados. Las credenciales quedaron fuera del checkout del instalador y no forman parte de la distribución.

## Pruebas del paquete y aislamiento

Pasan las 21 pruebas del bootstrap, aislamiento, publicación de memoria y actualizador, además de los 77 casos del self-test del motor y el lint. El [CI de la versión publicada](https://github.com/Growth4U-systems/brain4u-claude-plugin/actions/runs/37954478411) terminó correctamente.

El escaneo previo a publicar incluyó nueve commits, 220 blobs históricos y 134 archivos del instalador. No detectó candidatos de credenciales ni nombres de archivo sensibles. Es una revisión de patrones y entropía, con los límites propios de ese método.

La plantilla y el runtime distribuido no contienen el remoto del Brain interno, sus rutas, endpoints de Sancho ni webhooks de Slack de Growth4U. El propietario se resuelve desde la cuenta GitHub del destinatario; una configuración de otra cuenta se rechaza antes de acceder a su repositorio.

Las actualizaciones consultan únicamente releases estables públicas del instalador. El manifiesto contiene lógica genérica y excluye conocimiento de empresa, clientes, decisiones, aprendizajes, credenciales y workflows. Conserva personalizaciones y trabajo pendiente. No implementa sincronización de conocimientos entre empresas ni recepción de sus datos por Growth4U.

## Alcance que todavía requiere comprobación

- Crear una VPS nueva desde cero, incluyendo cloud-init y el recorrido completo de la conversación del wizard. En esta revisión se reutilizaron Ubuntu, Docker y credenciales de una VPS de prueba.
- Recibir y contestar mensajes reales mediante Slack o Google Chat en las cuentas del destinatario. Las guías y configuraciones están incluidas; no se conectó un workspace ni se creó una app de Chat para esta prueba.
- Una actualización futura entre releases en el workflow real. La comprobación actual fue sin cambios, con 0.4.0 ya instalada. Las protecciones de datos, personalizaciones, checksums, rutas, symlinks y downgrades sí tienen pruebas locales.
- Windows nativo y un runtime Hermes arbitrario existente. La entrada contempla macOS, Linux y WSL; la conexión con un Hermes existente sigue siendo asistida.

El contrato `gbrain.yml` describe la frontera de indexación; no distribuye un servidor de búsqueda. MemSearch es opcional y tiene su propio ciclo de actualización. Sancho y Mission Control quedan fuera de este paquete.

La [guía de instalación, ficha técnica y FAQ](https://drive.google.com/file/d/1p6WoJyIkdaqE_qS72QW3fN5X7KDLSdEn/view) conserva un único enlace con acceso de lectura para cualquiera que lo tenga. Incluye un comando público, las cuentas propias que requiere cada opción y el alcance de las comprobaciones.
