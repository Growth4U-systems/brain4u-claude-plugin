# Tu contexto permanece privado y la lógica puede mejorar

El instalador y el Brain de cada usuario son repositorios distintos. El plugin instala una copia inicial; una actualización del marketplace por sí sola no cambia esa copia.

La plantilla incluye un workflow propio que comprueba una vez al día la última release estable pública de Brain4U. Descarga su manifiesto de lógica, valida rutas y checksums y actualiza únicamente archivos que siguen iguales a su versión oficial anterior. Los archivos personalizados se conservan y quedan identificados en `.brain4u-distribution.json` para reconciliación asistida.

El manifiesto excluye el conocimiento del negocio, clientes, decisiones, aprendizajes y credenciales. No exporta el Brain privado del usuario. El actualizador no elimina archivos ni utiliza `git reset`.

En la VPS nueva, un timer intenta traer los cambios del repositorio privado cada quince minutos. Solo hace fast-forward cuando el checkout está limpio y en `main`. Si hay trabajo local o una rama de propuesta, lo conserva y aplaza la sincronización.

Requisitos: GitHub Actions habilitado y permiso para escribir en `main`. Las políticas de la cuenta pueden exigir una revisión o impedir ese push; no se eluden. El usuario puede ejecutar el workflow manualmente desde Actions o deshabilitarlo.

Este mecanismo actualiza la lógica oficial del Brain. Las actualizaciones del runtime Hermes y del plugin instalador son operaciones separadas que necesitan sus propias pruebas de compatibilidad. No se promete que cada commit de desarrollo se instale inmediatamente en todos los usuarios.

El manifiesto tampoco modifica workflows ni permisos de GitHub. Un cambio del mecanismo de actualización se aplica de forma asistida, respetando los permisos de la cuenta. El runtime no solicita un token personal amplio para eludir esa limitación.
