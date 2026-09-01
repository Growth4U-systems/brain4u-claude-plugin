---
name: brain4u-install
description: Planifica, instala, reanuda y verifica Brain4U y Hermes mediante un motor determinista, con MemSearch local opcional y sin aceptar secretos en el chat.
---

# Instalar Brain4U

Esta skill usa Claude Code como interfaz conversacional de un instalador determinista. El motor, no el modelo, define los pasos, el estado y las postcondiciones.

## Reglas de instalacion

1. No pedir ni aceptar tokens, claves o contrasenas en la conversacion.
2. Ejecutar siempre `plan` antes de `apply` y explicar el resultado en lenguaje no tecnico.
3. No ejecutar `apply` hasta que el usuario confirme el plan concreto.
4. No crear servidores, cuentas, apps de Slack ni clientes OAuth fuera de lo incluido y confirmado en ese plan.
5. Usar `resume` despues de una interrupcion. No improvisar comandos para saltarse un paso fallido.
6. Ejecutar `verify` antes de declarar que la instalacion termino.
7. Nunca editar el archivo de estado a mano.
8. Tratar MemSearch como una mejora opcional. Un fallo o conflicto suyo se advierte, pero nunca bloquea la creacion del Brain ni la instalacion de Hermes.

## Preflight

Ejecutar:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/preflight.sh"
```

El script solo inspecciona y devuelve JSON. No instala ni modifica nada.

Si Claude Code, Node 20 o superior, `gh`, `git`, `ssh` o `ssh-keygen` no estan disponibles, detenerse y explicar el requisito antes de continuar. `gh auth status` debe confirmar una sesion GitHub valida. Para MemSearch, `uv` o `curl` permiten preparar `uv` en la primera activacion. Si ambos aparecen como no disponibles, usar el modo `--skip-memsearch`, explicarlo y continuar con el Brain.

## Instalar MemSearch

Antes de crear el Brain, intentar instalar o verificar el plugin oficial de MemSearch en modo opcional:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/installer-engine.sh" install-memsearch --optional
```

Si el usuario pide una instalacion offline, indica que su equipo administra los plugins o solicita expresamente no instalar MemSearch, ejecutar en su lugar:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/installer-engine.sh" install-memsearch --skip-memsearch
```

El modo omitido no debe contactar marketplaces ni modificar plugins. En ambos casos, continuar despues con `init`.

En modo opcional, el motor solo acepta el marketplace oficial `zilliztech/memsearch`, instala o actualiza `memsearch@memsearch-plugins` con alcance de usuario, lo habilita y verifica la postcondicion mediante la salida JSON de Claude Code. Solo describir MemSearch como operativo cuando el resultado confirme `enabled: true`. Si ya esta activo en una version compatible, no modifica nada. La orquestacion es determinista, pero MemSearch no esta vendorizado: el marketplace oficial y su runtime se descargan desde sus fuentes upstream y pueden recibir versiones compatibles posteriores.

Si la instalacion devuelve una advertencia, falla la descarga, detecta un origen inesperado o no consigue dejar el plugin habilitado, explicar brevemente que la memoria episodica local no quedo disponible y continuar con la instalacion del Brain. No reintentar en bucle, no editar la configuracion de Claude Code a mano y no convertir ese fallo en un bloqueo del recorrido.

Si el motor detecta `claude-mem`, advertir que dos sistemas de memoria pueden duplicar captura y consumo. Nunca desinstalarlo, deshabilitarlo ni modificar su configuracion. Esa decision pertenece al usuario o al administrador del equipo y no afecta a la continuidad de Brain4U.

Explicar que MemSearch crea memoria episodica de las sesiones de Claude Code por proyecto. Sus diarios, embeddings e indice viven en el ordenador del usuario y nunca se versionan en el Brain, pero el contenido parseado de cada turno se procesa con Claude Haiku para producir el resumen y puede consumir cuota de Claude. En la primera activacion, MemSearch descarga un modelo local de embeddings de aproximadamente 558 MB. El conocimiento solo pasa a ser memoria canonica del Brain despues de destilarlo, revisar privacidad y aprobarlo mediante pull request.

La instalacion y verificacion de MemSearch debe permanecer en el motor local. No trasladarla a los hooks incluidos en `brain-template`: esos hooks gobiernan la frontera de captura del repositorio, pero no deben descargar software ni modificar marketplaces o plugins de Claude Code.

Continuar con la instalacion de Brain4U. Si el resultado confirma `componentOk: true` y `reloadRecommended: true`, recordar al final que el usuario debe reiniciar Claude Code o ejecutar `/reload-plugins` antes de usar los hooks. `restartRequired` indica si esta ejecucion modifico el plugin, mientras que `reloadRecommended` evita asumir que la sesion actual ya lo habia cargado.

Preparar la instalacion local mediante el motor:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/installer-engine.sh" init
```

Explicar antes que este paso crea una clave SSH dedicada solo si falta, detecta la IPv4 publica y guarda una configuracion privada bajo `~/.brain4u-installer/`. No reemplaza claves existentes, no contacta Hetzner y no crea recursos remotos. Tomar `configPath` de la salida JSON y usarlo en todos los comandos siguientes. No construir o editar esa configuracion mediante razonamiento libre.

Si la preparacion de la clave falla y hace falta diagnosticarla de forma aislada, se puede usar `scripts/prepare-local.sh` como herramienta de recuperacion. No es parte del recorrido normal.

## Crear el Brain privado

Despues de `init` y antes de conectar proveedores, crear el repositorio privado propiedad del usuario:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/installer-engine.sh" create-brain "/ruta/absoluta/config.json"
```

Este paso usa exclusivamente la sesion local ya autorizada mediante `gh auth login`. Crea `brain4u` como repositorio privado en la cuenta GitHub del usuario y publica la plantilla vacia incluida en el plugin: arquitectura LLM Wiki, `gbrain.yml`, reglas inspiradas en GStack, gobernanza, privacidad, contrato de aprendizaje, hooks, skills de memoria, lint y workflow de pull requests. Tambien crea una clave de despliegue aislada para la instalacion, la registra con acceso de escritura en ese repositorio y guarda la URL SSH validada. No copia doctrina, datos, clientes ni credenciales de Growth4U.

Si el repositorio ya existe y contiene el marcador valido de la plantilla Brain4U, verificarlo y continuar sin modificar su contenido. Si existe con el mismo nombre pero no es un Brain4U reconocido, detenerse. Nunca sobrescribir un repositorio existente ni convertirlo en publico.

## Motor

Usar la configuracion sin secretos creada por `init`. Las credenciales solo pueden entrar mediante una variable de entorno o el onboarding local privado. Nunca pedirlas en la conversacion ni escribirlas en el JSON.

Si OpenRouter todavia no esta conectado, no pedir la clave en el chat ni explicar variables de entorno. Abrir el onboarding local:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/installer-engine.sh" connect-openrouter "/ruta/absoluta/config.json"
```

El onboarding lleva al usuario a crear una cuenta y una clave API normal llamada `Brain4U`. Para la primera prueba usa `openrouter/free`, que no cobra inferencia pero tiene limites de uso. El usuario pega la clave en la pagina local. El motor la valida contra OpenRouter, rechaza claves de administracion y la guarda con permisos `0600`, separada de la configuracion y del estado. Una vez conectada, continuar automaticamente con Hetzner.

Si Hetzner todavia no esta conectado, no pedir el token en el chat ni explicar comandos. Abrir el onboarding local:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/installer-engine.sh" connect-hetzner "/ruta/absoluta/config.json"
```

El onboarding lleva al usuario por el registro oficial, la creacion del proyecto `Brain4U` y la generacion de un token `Read & Write`. El usuario pega el token en la pagina local. El motor lo valida y lo guarda en un archivo de credenciales privado con permisos `0600`, separado de la configuracion y del estado. Una vez conectado, continuar automaticamente con `plan`.

Ejecutar el plan:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/installer-engine.sh" plan "/ruta/absoluta/config.json"
```

Explicar objetivo, destino, pasos pendientes, permisos y coste mensual total antes de pedir confirmacion. Si el plan incluye infraestructura, mostrar tambien las acciones y el codigo `approvalCode`. No tratar una confirmacion anterior o generica como autorizacion para generar coste.

Solo despues de la confirmacion explicita:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/installer-engine.sh" apply "/ruta/absoluta/config.json" --approve-infrastructure "<approvalCode>"
```

Omitir `--approve-infrastructure` cuando el plan no incluya mutaciones de infraestructura. El codigo solo autoriza las acciones y el precio exactos del ultimo plan. Si deja de coincidir, ejecutar `plan` otra vez y pedir una nueva confirmacion.

Si falla o se interrumpe:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/installer-engine.sh" resume "/ruta/absoluta/config.json" --approve-infrastructure "<approvalCode-si-el-nuevo-plan-lo-exige>"
```

Para cerrar:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/installer-engine.sh" verify "/ruta/absoluta/config.json"
```

No declarar exito si `verify` devuelve `ok: false` o contiene fallos.

Durante `apply`, el motor clona el repositorio privado en `/opt/brain4u/brain`, monta ese directorio en Hermes como `/opt/brain` y configura ese path como directorio de trabajo. Hermes empieza por `INDEX.md`, sigue las reglas del repositorio y puede trabajar sobre la memoria durable. `verify` debe comprobar el marcador Brain4U, el origen Git, el montaje y el directorio de trabajo, ademas de la salud del runtime.

Al terminar, informar tambien la URL devuelta por `create-brain` y explicar que ese repositorio es la memoria durable propiedad del usuario. Hermes es el runtime del agente y la VPS es su entorno persistente.
