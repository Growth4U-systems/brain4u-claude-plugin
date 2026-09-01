# Brain4U installer engine

Motor determinista separado de Claude Code. Su estado no contiene credenciales y cada paso define una postcondicion verificable antes de considerarse completo.

## Comandos

```bash
node ./bin/brain4u-installer.js init
node ./bin/brain4u-installer.js install-memsearch
node ./bin/brain4u-installer.js create-brain --config /ruta/absoluta/config.json
node ./bin/brain4u-installer.js plan --config /ruta/absoluta/config.json
node ./bin/brain4u-installer.js apply --config /ruta/absoluta/config.json
node ./bin/brain4u-installer.js resume --config /ruta/absoluta/config.json
node ./bin/brain4u-installer.js verify --config /ruta/absoluta/config.json
node ./bin/brain4u-installer.js connect-openrouter --config /ruta/absoluta/config.json
```

`init` crea la configuracion privada y una clave SSH dedicada en el ordenador del usuario. Detecta la IPv4 publica mediante `api.ipify.org` para limitar el acceso SSH a ese origen. No contacta Hetzner ni crea recursos remotos.

`install-memsearch` valida el marketplace oficial `zilliztech/memsearch`, instala o actualiza `memsearch@memsearch-plugins` con alcance de usuario, lo habilita y comprueba el resultado. Es idempotente y no necesita la configuracion de una instalacion. Cuando modifica el plugin, Claude Code debe recargar plugins o reiniciarse para activar sus hooks.

`plan` y `verify` no modifican la instalacion. `apply` reconcilia las postcondiciones y `resume` exige que exista un estado previo. La clave de OpenRouter se lee de la credencial privada local o de la variable indicada por `provider.keyEnv` solo cuando falta en la VPS.

`create-brain` crea o valida el repositorio privado, registra una clave de despliegue dedicada y guarda su URL SSH en la configuracion. `apply` instala esa clave en la VPS, clona el Brain en `/opt/brain4u/brain` y lo monta en Hermes como `/opt/brain`. `verify` comprueba marcador, origen Git, montaje y directorio de trabajo.

El estado se guarda con permisos `0600` bajo `~/.brain4u-installer/<installationId>/state.json`.

## Conexion de OpenRouter

El onboarding local lleva al usuario a crear una clave normal de OpenRouter y permite pegarla en una pagina servida por `127.0.0.1`:

```bash
node ./bin/brain4u-installer.js connect-openrouter \
  --config /ruta/absoluta/config.json
```

La clave se valida con el endpoint oficial `/api/v1/key`. Las claves de administracion o provision se rechazan porque no sirven para inferencia. La clave queda con permisos `0600` bajo `~/.brain4u-installer/<installationId>/credentials/`, separada de configuracion y estado. Tambien se puede usar `OPENROUTER_API_KEY` en entornos automatizados.

## Provision administrada de Hetzner

La configuracion administrada de Hetzner describe una instalacion en la que el proyecto, token, clave SSH y coste pertenecen al usuario. El token se lee desde `infrastructure.tokenEnv` o desde la credencial local del onboarding y nunca se admite dentro del JSON.

Para una persona que aun no tiene configuracion, Claude Code ejecuta primero:

```bash
node ./bin/brain4u-installer.js init
```

La salida incluye `configPath`, que se usa en todos los pasos siguientes. Claude Code conecta primero OpenRouter y, para una persona que aun no tiene cuenta o token de Hetzner, abre despues el onboarding local:

```bash
node ./bin/brain4u-installer.js connect-hetzner \
  --config /ruta/absoluta/config.json
```

La pagina lleva al registro oficial de Hetzner, la creacion del proyecto `Brain4U` y la pantalla de tokens. El token se pega en un campo privado servido por `127.0.0.1`, se valida contra la API y se guarda con permisos `0600` bajo `~/.brain4u-installer/<installationId>/credentials/`. No se envia al chat ni aparece en configuracion, estado o salida del comando.

```bash
node ./bin/brain4u-installer.js plan \
  --config /ruta/absoluta/config.json
```

Tambien se puede seguir usando `HCLOUD_TOKEN` como alternativa para entornos automatizados.

El plan consulta el catalogo y los precios de la cuenta, incluyendo el servidor y la Primary IPv4. No crea recursos ni estado. Si hacen falta mutaciones devuelve un `approvalCode`. Solo el codigo del plan vigente habilita `apply`:

```bash
HCLOUD_TOKEN="..." node ./bin/brain4u-installer.js apply \
  --config /ruta/absoluta/config.json \
  --approve-infrastructure "<approvalCode>"
```

El motor no adopta recursos del mismo nombre si no tienen las etiquetas de propiedad esperadas. La VPS se crea con IPv4 e IPv6 declaradas, firewall SSH limitado al CIDR configurado y protecciones de borrado y reconstruccion. No existe rollback destructivo automatico.
