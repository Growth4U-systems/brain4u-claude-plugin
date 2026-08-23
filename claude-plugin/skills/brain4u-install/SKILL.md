---
name: brain4u-install
description: Planifica, instala, reanuda y verifica el MVP autoinstalable de Brain4U mediante un motor determinista, sin aceptar secretos en el chat.
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

## Preflight

Ejecutar:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/preflight.sh"
```

El script solo inspecciona y devuelve JSON. No instala ni modifica nada.

Si Node 20 o superior, `ssh` o `ssh-keygen` no estan disponibles, detenerse y explicar el requisito antes de continuar. No intentar crear infraestructura con un preflight incompleto.

Preparar la instalacion local mediante el motor:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/installer-engine.sh" init
```

Explicar antes que este paso crea una clave SSH dedicada solo si falta, detecta la IPv4 publica y guarda una configuracion privada bajo `~/.brain4u-installer/`. No reemplaza claves existentes, no contacta Hetzner y no crea recursos remotos. Tomar `configPath` de la salida JSON y usarlo en todos los comandos siguientes. No construir o editar esa configuracion mediante razonamiento libre.

Si la preparacion de la clave falla y hace falta diagnosticarla de forma aislada, se puede usar `scripts/prepare-local.sh` como herramienta de recuperacion. No es parte del recorrido normal.

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
