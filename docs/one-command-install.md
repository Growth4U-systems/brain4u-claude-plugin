# Un enlace, un comando y el wizard

El destinatario abre el recurso de Growth4U, copia un comando `curl` en su terminal y sigue el wizard de Claude Code. GitHub es parte de la infraestructura: el usuario inicia sesión en su propia cuenta para crear su memoria privada. No necesita visitar ni clonar el repositorio del instalador.

## Entrada preparada

`install.sh` comprueba las herramientas, registra el marketplace, instala y habilita el plugin, verifica sus archivos y abre `/brain4u-installer:brain4u-install`. Funciona también con `curl | bash`: conecta el wizard a la terminal para que no herede la entrada consumida por la descarga.

La preparación no crea una VPS ni conecta credenciales. El wizard existente gobierna el alta de proveedores, el plan de costes y su confirmación, la ejecución reanudable y la verificación del runtime.

Para verificar el punto de entrada local sin abrir el wizard:

```bash
bash install.sh --source-directory "$PWD" --no-wizard
```

## Publicación pendiente

El repositorio `Growth4U-systems/brain4u-claude-plugin` sigue privado. El comando público debe apuntar al `install.sh` de una distribución accesible sin la cuenta de Growth4U. La URL de descarga y el origen del marketplace tienen que ser públicos. Publicar solo el script mientras el marketplace siga privado no completa la instalación.

Antes de poner un comando en el recurso público, probar la URL final con una configuración nueva de Claude Code y sin credenciales que permitan leer repositorios privados de Growth4U. La prueba local y una prueba autenticada de GitHub no demuestran ese acceso.

## Qué distribuye hoy

Este punto de entrada instala el plugin 0.3.2 y su motor 0.7.0. La plantilla privada está en versión 2. Incluye una estructura de memoria, políticas y skills, y el despliegue de Hermes. Todavía no activa un perfil Chief of Staff ni replica automáticamente las mejoras del Brain interno en instalaciones existentes. No presentar esta entrega como esa versión completa.

La VPS de prueba anterior no respondió por SSH el 9 de octubre de 2026. La instalación del plugin y las pruebas del motor están verificadas; el despliegue completo vigente necesita una nueva prueba real con cuentas y un plan de coste confirmado.

## Pruebas de publicación

1. Descargar y ejecutar el comando real desde el enlace público, sin acceso al repo privado de Growth4U.
2. Confirmar que el wizard aparece y que se autentica con la cuenta del destinatario.
3. Crear el Brain privado, conectar proveedores y confirmar el coste concreto.
4. Completar `apply`, `verify` y la prueba de inferencia.
5. Guardar una decisión de ejemplo, recuperarla con su fuente en una sesión nueva y verificar que persiste tras un reinicio.
6. Para la versión completa, comprobar también el Chief of Staff predeterminado y una actualización de lógica que conserva la memoria propia.

Referencia: [marketplaces de Claude Code](https://code.claude.com/docs/en/plugin-marketplaces).
