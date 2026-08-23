import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

test('bootstrap installs every command required by verification', async () => {
  const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
  const bootstrap = await readFile(path.resolve(currentDirectory, '../../vps/bootstrap-docker.sh'), 'utf8');
  assert.match(bootstrap, /apt-get install -y ca-certificates curl jq/);
});
