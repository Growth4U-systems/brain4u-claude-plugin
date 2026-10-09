# Una instalación guiada, tres decisiones

Claude Code es la interfaz de instalación. Hermes es el agente que funciona después, sin mantener Claude abierto. El Brain es la memoria privada propiedad del usuario.

| Camino | Qué se instala o cambia | Estado del recorrido |
| --- | --- | --- |
| Brain + Hermes nuevo | Brain privado, VPS propia, Hermes y Chief of Staff | Motor determinista incluido; exige plan y aprobación del coste |
| Solo Brain | Repositorio privado con estructura, reglas, skills y perfil | `create-brain --brain-only`; no registra acceso de runtime ni instala Hermes |
| Brain + Hermes existente | Se conecta la memoria al agente que ya tiene el usuario | Conexión asistida; la reconciliación automática de instalaciones externas sigue pendiente |

Slack y Google Chat son elecciones opcionales posteriores. MemSearch es una mejora opcional para la memoria local de Claude Code. Sancho y Mission Control no forman parte del paquete.

La preparación común de `init` mantiene los requisitos locales del instalador y puede preparar su clave SSH. Elegir solo Brain detiene el recorrido antes del onboarding de proveedores, del plan de VPS y de `apply`; no hace llamadas a Hetzner ni crea servidores.

Un usuario externo no necesita una cuenta de Growth4U ni acceso al Brain interno. La distribución del plugin debe ser pública; el repositorio que se crea con su contexto permanece privado. Esta condición todavía depende de publicar este instalador y verificar la descarga anónima.

Antes de compartir como instalación completada, comprobar el camino concreto de extremo a extremo. Los tests del motor y los permisos del contenedor no acreditan por sí solos una autorización real de Slack o Google Chat.
