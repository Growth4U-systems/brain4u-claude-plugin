# Un enlace, un comando y el wizard

El destinatario recibe el recurso de Growth4U, copia un comando en su terminal y sigue el wizard de Claude Code. Su cuenta GitHub conserva el Brain privado. No necesita visitar ni clonar el instalador.

`install.sh` comprueba las herramientas, registra el marketplace previsto, instala y habilita el plugin y valida sus archivos. Abre `/brain4u-installer:brain4u-install` con una terminal interactiva aunque el script llegue por `curl | bash`.

La preparación del plugin no crea servidores ni conecta credenciales. El wizard ofrece las opciones de instalación, guía las autorizaciones propias, prepara un plan de coste, pide su confirmación concreta y ejecuta y verifica el motor reanudable.

## Entrada de la edición piloto

```bash
curl -fsSL https://raw.githubusercontent.com/Growth4U-systems/brain4u-claude-plugin/v0.4.0/install.sh | bash
```

Plugin 0.4.0, motor 0.8.0 y plantilla 3: Chief of Staff, guardado autorizado de aprendizajes, actualizaciones de lógica estable y opciones de instalación. La entrada fija la versión del bootstrap; el marketplace instala el plugin vigente. Revisa [la ficha de pruebas](release-verification.md) para distinguir la verificación del software de las conexiones que debes comprobar en tus propias cuentas.

## Probar el punto de entrada local

```bash
bash install.sh --source-directory "$PWD" --no-wizard
```

## Verificar la publicación

1. Descargar el script real y el marketplace sin autenticación de Growth4U, con una configuración nueva de Claude.
2. Abrir el wizard y autenticar la cuenta GitHub del destinatario.
3. Crear el Brain privado. Para Hermes nuevo, conectar proveedores y confirmar el coste concreto antes de provisionar.
4. Completar `apply`, `verify` y la inferencia. Guardar y recuperar un aprendizaje con fuentes y verificar la persistencia.
5. Comprobar la actualización estable conservando conocimientos y personalizaciones.
6. Si se incluye un canal, comprobar una respuesta real desde ese Slack o Google Chat antes de describirlo como conectado.

El formato del marketplace y el recorrido de prueba siguen la [documentación de Claude Code](https://code.claude.com/docs/en/plugin-marketplaces). El registro en un marketplace propio no implica estar publicado en el directorio oficial de Anthropic.
