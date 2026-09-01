# Brain4U for Claude Code

Marketplace privado de Growth4U para instalar Brain4U desde Claude Code.

## Requisitos

- Acceso a este repositorio privado de GitHub.
- Claude Code 2.1.169 o posterior.
- Node.js 20 o posterior.
- OpenSSH con `ssh-keygen`.
- `uv` o `curl` para preparar el runtime local de MemSearch en su primera activacion, solo si se habilita esta capa opcional.
- GitHub CLI (`gh`) autenticado en la cuenta donde se creara el Brain.
- Una cuenta de OpenRouter.
- Una cuenta de Hetzner con facturacion habilitada.

No se necesita Docker en el ordenador del usuario. El instalador lo configura en la VPS.

## Instalar

Primero autentica GitHub en el ordenador donde se ejecuta Claude Code:

```bash
gh auth login
```

Despues instala el marketplace y el plugin:

```bash
claude plugin marketplace add Growth4U-systems/brain4u-claude-plugin --scope user
claude plugin install brain4u-installer@brain4u --scope user
```

Abre Claude Code y escribe:

```text
Instala Brain4U
```

## Que hace esta version

Durante el recorrido, el plugin intenta instalar automaticamente MemSearch como memoria episodica local de Claude Code y verifica que quede habilitado. Esta capa es opcional: si la instalacion falla, hay un conflicto, falta acceso a internet o el equipo aplica una politica administrada, Brain4U muestra la advertencia y continua con la creacion del Brain. MemSearch guarda sus archivos por proyecto en `.memsearch/` y ejecuta embeddings e indice semantico en el ordenador del usuario. Para crear el resumen, el contenido parseado de cada turno se procesa con Claude Haiku y puede consumir cuota de Claude. En la primera activacion descarga el modelo local ONNX bge-m3, de aproximadamente 558 MB. No necesita una clave adicional para generar embeddings.

Despues crea en la cuenta GitHub del usuario un repositorio privado `brain4u` a partir de la plantilla vacia incluida: LLM Wiki, configuracion GBrain read-only, reglas y workflows inspirados en GStack, gobernanza, privacidad, hooks, skills de memoria, lint y escritura por pull request. Registra una clave de despliegue dedicada, clona ese Brain en la VPS y lo monta en Hermes como `/opt/brain`, su memoria y directorio de trabajo. Tambien guia al usuario para conectar sus propias cuentas de OpenRouter y Hetzner, consulta el precio vigente, exige confirmacion antes de crear recursos, provisiona la VPS e instala y verifica Hermes.

El repositorio GitHub es la fuente de verdad privada propiedad del usuario. La VPS conserva su clon y ejecuta Hermes, que arranca desde el indice del Brain, aplica sus reglas y puede trabajar sobre sus archivos de forma persistente.

MemSearch y Brain4U cumplen funciones distintas. MemSearch conserva memoria episodica local para que Claude Code recuerde conversaciones anteriores. Esa memoria y su indice no se suben a GitHub. Solo un aprendizaje destilado, revisado y aprobado puede entrar al Brain mediante un pull request. Hermes lee el Brain montado en la VPS, no el indice local de MemSearch.

Si ya existe `claude-mem`, el instalador lo detecta y avisa de que puede haber captura duplicada, pero no lo desinstala ni lo deshabilita. En entornos offline o administrados se puede omitir MemSearch expresamente sin reducir las funciones del repositorio Brain ni de Hermes.

## Privacidad y seguridad

- No pegues tokens ni claves en la conversacion.
- Las credenciales entran mediante paginas locales y se guardan con permisos `0600`.
- El plan no crea infraestructura.
- La VPS solo se crea tras una confirmacion explicita vinculada al precio vigente.
- El repositorio no contiene credenciales de Hetzner, OpenRouter ni instalaciones reales.
- `.memsearch/` permanece fuera de git y nunca se publica como parte del Brain.
- Un resumen generado por Claude Haiku no se considera conocimiento canonico hasta que se destila, revisa y aprueba mediante un pull request.
- MemSearch se obtiene de su marketplace oficial y prepara su runtime desde fuentes upstream. No esta vendorizado ni fijado a un commit dentro de Brain4U.

## Actualizar

```bash
claude plugin marketplace update brain4u
```

Reinicia Claude Code o ejecuta `/reload-plugins` para cargar la version actualizada.
