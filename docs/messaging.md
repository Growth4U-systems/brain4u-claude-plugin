# Habla con tu Chief of Staff desde Slack o Google Chat

El Brain conserva el contexto; Hermes ejecuta el agente. Slack y Google Chat son canales opcionales del mismo Hermes. Puedes conectar uno, ambos o hacerlo después. No necesitas pertenecer a Growth4U: usas tu propio workspace, proyecto y credenciales.

La conexión no equivale a importar un inbox completo. No concede por sí sola acceso a Gmail, Drive o Calendar. El contrato `contracts/google-scopes.json` corresponde a esos servicios, no a Google Chat.

## Desde la instalación nueva de Brain4U

Una vez verificados el Brain y Hermes, Claude Code explica los requisitos del canal elegido. Las pantallas de autorización y la introducción de credenciales pertenecen al usuario. No pegues tokens en Claude ni en el Brain.

En la terminal de la VPS, abre el asistente nativo de Hermes:

```bash
docker exec -it brain4u-hermes-spike hermes gateway setup
```

Selecciona el canal que preparaste. Este comando configura Hermes; no crea por ti el workspace de Slack, el proyecto Google Cloud ni sus permisos. Después reinicia el gateway del contenedor:

```bash
docker restart brain4u-hermes-spike
```

No uses `hermes gateway install` dentro de Docker: el contenedor ya ejecuta el gateway con su política de reinicio.

## Slack

Necesitas permiso para instalar una app en tu propio workspace. Genera el manifiesto compatible con el Hermes instalado:

```bash
docker exec brain4u-hermes-spike hermes slack manifest --agent-view --name "Chief of Staff" --write
docker exec brain4u-hermes-spike cat /opt/data/slack-manifest.json
```

Ese JSON contiene configuración de la app, no tokens. Crea la app desde ese manifiesto en https://api.slack.com/apps. Autoriza su instalación, genera el token de Socket Mode y obtén el token del bot. El asistente de Hermes recibe esos valores en la terminal privada y los guarda en `/opt/data/.env`, fuera del Brain.

Configura `SLACK_ALLOWED_USERS` con tus Member IDs e invita al bot a los canales elegidos. Socket Mode no requiere exponer una URL de tu VPS. Mantén restringidos los usuarios autorizados.

Prueba un DM y una mención en un canal autorizado. No declares la conexión terminada hasta recibir respuesta en ambos casos.

[Pasos y permisos oficiales de Slack en Hermes](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/slack).

## Google Chat

Requiere Google Workspace y permiso para publicar una app privada, además de un proyecto Google Cloud propio. Una cuenta que solo usa Gmail no cubre estos requisitos.

Para el recorrido VPS, usa Pub/Sub con suscripción pull: evita abrir un endpoint público. Sigue la guía oficial para habilitar las APIs, crear la cuenta de servicio, preparar el topic y la suscripción y configurar la app de Chat. Asigna los permisos sobre los recursos concretos que indica Google, no acceso amplio a todo el proyecto.

Copia el JSON de la cuenta de servicio al almacenamiento privado de Hermes, por ejemplo `/opt/brain4u/hermes/data/google-chat-sa.json`, con acceso para el usuario `hermes` y permisos `0600`. Dentro del contenedor la ruta es `/opt/data/google-chat-sa.json`. No lo guardes en GitHub ni lo pegues en la conversación.

Prepara `GOOGLE_CHAT_PROJECT_ID`, `GOOGLE_CHAT_SUBSCRIPTION_NAME`, `GOOGLE_CHAT_SERVICE_ACCOUNT_JSON` y `GOOGLE_CHAT_ALLOWED_USERS` en el asistente privado. Añade la app al espacio elegido y prueba una respuesta real. El envío nativo de adjuntos requiere la autorización adicional `/setup-files` que documenta Hermes; es opcional.

[Pasos oficiales de Google Chat en Hermes](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/google_chat).

## Si ya tienes Hermes

No reinstales Hermes ni reutilices ciegamente los comandos del contenedor Brain4U. Conecta el Brain a tu instalación existente conservando el proveedor, el perfil y sus secretos. En una instalación nativa el asistente es `hermes gateway setup`; en Docker, ejecuta ese comando dentro de tu contenedor real.

El motor incluido no reconcilia todavía una instalación externa arbitraria. Claude debe inspeccionar su entorno, confirmar el cambio del perfil y comprobar el montaje y la escritura del Brain antes de darla por conectada.

## Qué significa que funciona

Conectar credenciales es un paso de configuración. La aceptación requiere respuesta en el canal, una decisión sintética recordada en una sesión nueva, acceso de escritura al Brain y persistencia después de reiniciar Hermes. No se sustituye esa prueba por un HTTP 200 de salud.
