import net from 'node:net';

import { runProcess } from './process.js';

export function sshArgs(config) {
  const args = [
    '-i', config.target.identityFile,
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=8',
    '-o', `StrictHostKeyChecking=${config.target.strictHostKeyChecking}`,
  ];
  if (config.target.userKnownHostsFile) {
    args.push('-o', `UserKnownHostsFile=${config.target.userKnownHostsFile}`);
  }
  args.push(`${config.target.user}@${config.target.host}`);
  return args;
}

export async function runSsh(config, remoteCommand, options = {}) {
  return await runProcess('ssh', [...sshArgs(config), remoteCommand], options);
}

export async function uploadText(config, remotePath, content, mode) {
  const command = `set -e; install -d -m 0750 /opt/brain4u/hermes /opt/brain4u/hermes/data; umask 077; tee ${remotePath} >/dev/null; chmod ${mode} ${remotePath}`;
  await runSsh(config, command, { input: content });
}

export async function isTcpPortOpen(host, port, timeoutMs = 2500) {
  return await new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const finish = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}
