import { spawn } from 'node:child_process';

export async function runProcess(command, args, options = {}) {
  const { input, timeoutMs = 600_000, env = process.env } = options;

  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const stdout = [];
    const stderr = [];
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);

    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', (code, signal) => {
      clearTimeout(timeout);
      const result = {
        code,
        signal,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      };
      if (code === 0 && !timedOut) return resolve(result);

      const error = new Error(timedOut
        ? `${command} timed out after ${timeoutMs}ms`
        : `${command} exited with code ${code}`);
      error.result = result;
      reject(error);
    });

    if (input !== undefined) child.stdin.end(input);
    else child.stdin.end();
  });
}
