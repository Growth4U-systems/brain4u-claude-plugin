import { randomBytes } from 'node:crypto';
import http from 'node:http';

import {
  saveOpenRouterCredential,
  validateOpenRouterKey,
} from './credentials.js';
import { runProcess } from './process.js';

const KEYS_URL = 'https://openrouter.ai/settings/keys';
const CURRENT_KEY_URL = 'https://openrouter.ai/api/v1/key';

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character]);
}

function renderPage({ installationId, session, scriptNonce, error = null, success = false }) {
  const title = success ? 'OpenRouter conectado' : 'Enciende Brain4U';
  const status = success ? 'Clave verificada' : '3 minutos, una sola vez';
  const safeError = error ? escapeHtml(error) : '';
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="referrer" content="no-referrer">
  <title>${title}</title>
  <style>
    :root {
      color-scheme: light;
      --paper: oklch(96% 0.018 82);
      --paper-deep: oklch(91% 0.032 70);
      --ink: oklch(22% 0.025 66);
      --ink-soft: oklch(43% 0.025 66);
      --line: oklch(79% 0.032 76);
      --signal: oklch(57% 0.14 49);
      --signal-dark: oklch(40% 0.105 49);
      --danger: oklch(48% 0.17 28);
      --focus: oklch(49% 0.16 252);
      --space-xs: .5rem;
      --space-sm: .75rem;
      --space-md: 1rem;
      --space-lg: 1.5rem;
      --space-xl: 2rem;
      --space-2xl: 3rem;
      --ease-out: cubic-bezier(.25, 1, .5, 1);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100svh;
      padding: max(var(--space-md), env(safe-area-inset-top)) max(var(--space-md), env(safe-area-inset-right)) max(var(--space-md), env(safe-area-inset-bottom)) max(var(--space-md), env(safe-area-inset-left));
      color: var(--ink);
      background: var(--paper);
      font-family: "Avenir Next", Avenir, "Helvetica Neue", sans-serif;
      font-size: 1rem;
      line-height: 1.5;
    }
    body::before {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      background-image: linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px);
      background-size: 48px 48px;
      opacity: .18;
    }
    a { color: inherit; }
    .skip-link {
      position: fixed;
      top: .5rem;
      left: .5rem;
      z-index: 10;
      transform: translateY(-160%);
      padding: .75rem 1rem;
      color: var(--paper);
      background: var(--ink);
    }
    .skip-link:focus { transform: translateY(0); }
    .shell {
      position: relative;
      display: grid;
      grid-template-rows: auto 1fr auto;
      gap: clamp(2rem, 6vw, 5rem);
      width: min(100%, 70rem);
      min-height: calc(100svh - 2rem);
      margin: 0 auto;
    }
    header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-lg);
      padding-bottom: var(--space-sm);
      border-bottom: 1px solid var(--ink);
    }
    .wordmark { font-weight: 750; letter-spacing: -.035em; }
    .status { color: var(--ink-soft); font-size: .875rem; }
    main { display: grid; align-items: start; gap: var(--space-2xl); }
    .intro { max-width: 48rem; }
    .eyebrow {
      margin: 0 0 var(--space-sm);
      color: var(--signal-dark);
      font-size: .75rem;
      font-weight: 750;
      letter-spacing: .11em;
      text-transform: uppercase;
    }
    h1 {
      max-width: 12ch;
      margin: 0 0 0 -.04em;
      font-family: "Iowan Old Style", "Palatino Linotype", Palatino, serif;
      font-size: clamp(2.7rem, 8vw, 6.2rem);
      font-weight: 500;
      line-height: .94;
      letter-spacing: -.055em;
    }
    .lede {
      max-width: 56ch;
      margin: var(--space-lg) 0 0;
      color: var(--ink-soft);
      font-size: clamp(1rem, 2.4vw, 1.25rem);
    }
    .success-mark {
      display: grid;
      place-items: center;
      width: clamp(4rem, 10vw, 7rem);
      aspect-ratio: 1;
      margin-bottom: var(--space-xl);
      border-radius: 50%;
      color: var(--paper);
      background: var(--signal-dark);
      font-size: clamp(2rem, 6vw, 4rem);
    }
    .steps { counter-reset: step; border-top: 1px solid var(--line); }
    .step {
      counter-increment: step;
      display: grid;
      grid-template-columns: 3rem 1fr;
      gap: var(--space-md);
      padding: var(--space-lg) 0;
      border-bottom: 1px solid var(--line);
      animation: reveal 560ms var(--ease-out) both;
      animation-delay: calc(var(--i) * 70ms);
    }
    .step::before {
      content: "0" counter(step);
      color: var(--signal-dark);
      font-size: .875rem;
      font-variant-numeric: tabular-nums;
      font-weight: 750;
    }
    .step h2 { margin: 0; font-size: 1.25rem; letter-spacing: -.025em; }
    .step p { max-width: 60ch; margin: var(--space-xs) 0 0; color: var(--ink-soft); }
    .action-link {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      margin-top: var(--space-md);
      color: var(--signal-dark);
      font-weight: 700;
      text-underline-offset: .2em;
    }
    .connection {
      margin-top: var(--space-lg);
      padding: clamp(1.25rem, 4vw, 2rem);
      background: var(--paper-deep);
      border: 1px solid var(--line);
    }
    label { display: block; font-weight: 700; }
    .hint { display: block; margin: .25rem 0 var(--space-sm); color: var(--ink-soft); font-size: .875rem; }
    input[type="password"] {
      width: 100%;
      min-height: 3.25rem;
      padding: .75rem 1rem;
      color: var(--ink);
      background: var(--paper);
      border: 1px solid var(--ink-soft);
      border-radius: 0;
      font: inherit;
    }
    input[type="password"]:focus-visible, a:focus-visible, button:focus-visible {
      outline: 3px solid var(--focus);
      outline-offset: 3px;
    }
    .error { margin: var(--space-sm) 0 0; color: var(--danger); font-weight: 650; }
    button {
      width: 100%;
      min-height: 3.25rem;
      margin-top: var(--space-md);
      border: 0;
      border-radius: 0;
      color: var(--paper);
      background: var(--signal-dark);
      font: inherit;
      font-weight: 750;
      cursor: pointer;
      transition: transform 120ms var(--ease-out), background-color 120ms var(--ease-out);
    }
    @media (hover: hover) { button:hover { background: var(--signal); transform: translateY(-1px); } }
    button:active { transform: translateY(1px); }
    button[aria-busy="true"] { cursor: wait; opacity: .72; }
    footer {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: var(--space-sm) var(--space-lg);
      color: var(--ink-soft);
      font-size: .75rem;
    }
    @keyframes reveal {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @media (min-width: 48rem) {
      main:not(.complete) { grid-template-columns: minmax(18rem, .8fr) minmax(26rem, 1.2fr); gap: clamp(3rem, 8vw, 8rem); }
      .intro { position: sticky; top: 2rem; }
      .step { grid-template-columns: 4rem 1fr; }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
    }
  </style>
</head>
<body>
  <a class="skip-link" href="#content">Ir al contenido</a>
  <div class="shell">
    <header><span class="wordmark">brain4u</span><span class="status">${status}</span></header>
    ${success ? `
    <main id="content" class="complete">
      <section class="intro">
        <div class="success-mark" aria-hidden="true">✓</div>
        <p class="eyebrow">Listo</p>
        <h1>${title}</h1>
        <p class="lede">La clave quedó guardada de forma privada en este ordenador. Ya puedes cerrar esta pestaña y volver a Claude Code para conectar la VPS.</p>
      </section>
    </main>` : `
    <main id="content">
      <section class="intro">
        <p class="eyebrow">El motor de Brain4U</p>
        <h1>${title}</h1>
        <p class="lede">OpenRouter permite que tu asistente use modelos de inteligencia artificial. Para esta primera prueba usaremos su modo gratuito.</p>
      </section>
      <section class="steps" aria-label="Pasos para conectar OpenRouter">
        <article class="step" style="--i:0">
          <div>
            <h2>Abre tu cuenta</h2>
            <p>Entra en OpenRouter con tu correo. Para esta prueba no necesitas comprar créditos. El modo gratuito tiene límites de uso.</p>
            <a class="action-link" href="${KEYS_URL}" target="_blank" rel="noreferrer">Abrir OpenRouter ↗</a>
          </div>
        </article>
        <article class="step" style="--i:1">
          <div>
            <h2>Crea una clave Brain4U</h2>
            <p>En <strong>API Keys</strong>, crea una clave normal llamada <strong>Brain4U</strong>. No elijas una clave de administración.</p>
          </div>
        </article>
        <article class="step" style="--i:2">
          <div>
            <h2>Conecta la clave</h2>
            <p>Pega aquí la clave que empieza por <strong>sk-or-v1-</strong>. La verificaremos sin enviarla al chat.</p>
            <form class="connection" method="post" action="/connect" id="connection-form">
              <input type="hidden" name="session" value="${escapeHtml(session)}">
              <label for="key">Clave de OpenRouter</label>
              <span class="hint" id="key-hint">Se enviará únicamente desde este instalador local a OpenRouter y se guardará con permisos privados.</span>
              <input id="key" name="key" type="password" autocomplete="off" spellcheck="false" required minlength="29" pattern="sk-or-v1-[A-Za-z0-9_-]{20,256}" aria-describedby="key-hint${error ? ' key-error' : ''}">
              ${error ? `<p class="error" id="key-error" role="alert">${safeError}</p>` : ''}
              <button type="submit" id="connect-button">Verificar clave</button>
            </form>
          </div>
        </article>
      </section>
    </main>`}
    <footer><span>Instalación ${escapeHtml(installationId)}</span><span>Este paso no compra créditos ni crea una VPS.</span></footer>
  </div>
  ${success ? '' : `<script nonce="${scriptNonce}">
    const form = document.getElementById('connection-form');
    const button = document.getElementById('connect-button');
    form.addEventListener('submit', () => {
      button.setAttribute('aria-busy', 'true');
      button.textContent = 'Verificando la clave…';
    });
  </script>`}
</body>
</html>`;
}

async function openBrowser(url) {
  if (process.platform === 'darwin') return await runProcess('open', [url], { timeoutMs: 10_000 });
  if (process.platform === 'win32') return await runProcess('cmd', ['/c', 'start', '', url], { timeoutMs: 10_000 });
  return await runProcess('xdg-open', [url], { timeoutMs: 10_000 });
}

async function readRequestBody(request, limit = 8_192) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error('Request body is too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function verifyOpenRouterKey(key, { fetchImpl = globalThis.fetch } = {}) {
  const validatedKey = validateOpenRouterKey(key);
  let response;
  try {
    response = await fetchImpl(CURRENT_KEY_URL, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${validatedKey}`,
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    const safeMessage = String(error.message ?? error).replaceAll(validatedKey, '[REDACTED]');
    throw new Error(`Could not reach OpenRouter: ${safeMessage}`);
  }
  if (!response.ok) throw new Error(`OpenRouter rejected the key with HTTP ${response.status}`);
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error('OpenRouter returned an invalid verification response');
  }
  if (!payload?.data || typeof payload.data !== 'object') {
    throw new Error('OpenRouter did not return key information');
  }
  if (payload.data.is_management_key === true || payload.data.is_provisioning_key === true) {
    throw new Error('This is an administration key. Create a normal API key for Brain4U.');
  }
  if (payload.data.disabled === true) throw new Error('This OpenRouter key is disabled');
  return {
    freeTier: payload.data.is_free_tier === true,
    limit: typeof payload.data.limit === 'number' ? payload.data.limit : null,
    limitRemaining: typeof payload.data.limit_remaining === 'number' ? payload.data.limit_remaining : null,
  };
}

export async function startOpenRouterOnboarding({ config, stateRoot, openBrowserImpl = openBrowser, fetchImpl = globalThis.fetch, timeoutMs = 20 * 60_000 }) {
  const session = randomBytes(24).toString('base64url');
  const scriptNonce = randomBytes(18).toString('base64');
  let completed = false;
  let completionResolve;
  let completionReject;
  const completion = new Promise((resolve, reject) => {
    completionResolve = resolve;
    completionReject = reject;
  });

  const server = http.createServer(async (request, response) => {
    const host = request.headers.host ?? '';
    if (!/^127\.0\.0\.1:\d+$/.test(host)) {
      response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Invalid host');
      return;
    }
    const pageHeaders = {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${scriptNonce}'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`,
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    };

    if (request.method === 'GET' && request.url === `/?session=${session}`) {
      response.writeHead(200, pageHeaders);
      response.end(renderPage({ installationId: config.installationId, session, scriptNonce }));
      return;
    }
    if (request.method === 'POST' && request.url === '/connect') {
      let key;
      try {
        const body = new URLSearchParams(await readRequestBody(request));
        if (body.get('session') !== session) throw new Error('La sesión local venció. Vuelve a iniciar el asistente desde Claude Code.');
        key = body.get('key')?.trim() ?? '';
        const keyInfo = await verifyOpenRouterKey(key, { fetchImpl });
        const credentialPath = await saveOpenRouterCredential(stateRoot, config.installationId, key);
        key = null;
        completed = true;
        response.writeHead(200, pageHeaders);
        response.end(renderPage({ installationId: config.installationId, session, scriptNonce, success: true }));
        completionResolve({
          ok: true,
          command: 'connect-openrouter',
          installationId: config.installationId,
          connected: true,
          credentialPath,
          keyInfo,
          keysUrl: KEYS_URL,
        });
      } catch (error) {
        let safeMessage = String(error.message ?? error);
        if (key) safeMessage = safeMessage.replaceAll(key, '[REDACTED]');
        key = null;
        response.writeHead(400, pageHeaders);
        response.end(renderPage({
          installationId: config.installationId,
          session,
          scriptNonce,
          error: `No pudimos validar esa clave. ${safeMessage}`,
        }));
      }
      return;
    }
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  });

  server.on('error', completionReject);
  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}/?session=${session}`;
  try {
    await openBrowserImpl(url);
    const timeout = setTimeout(() => {
      if (!completed) completionReject(new Error('OpenRouter onboarding timed out before a key was connected'));
    }, timeoutMs);
    const result = await completion;
    clearTimeout(timeout);
    return result;
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

export async function connectOpenRouterCommand({ config, stateRoot, openBrowserImpl, fetchImpl = globalThis.fetch }) {
  const key = process.env[config.provider.keyEnv];
  if (key) {
    const keyInfo = await verifyOpenRouterKey(key, { fetchImpl });
    return {
      ok: true,
      command: 'connect-openrouter',
      installationId: config.installationId,
      connected: true,
      alreadyConnected: true,
      keyInfo,
      keysUrl: KEYS_URL,
    };
  }
  return await startOpenRouterOnboarding({ config, stateRoot, openBrowserImpl, fetchImpl });
}

export const openRouterOnboardingLinks = { keys: KEYS_URL };
