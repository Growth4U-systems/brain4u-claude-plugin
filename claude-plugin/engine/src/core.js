import { redact } from './redact.js';
import { newState } from './state-store.js';

export async function runSteps({ config, fingerprint, stateStore, steps, requireExisting = false, onEvent = () => {} }) {
  let state = await stateStore.load();
  if (!state && requireExisting) throw new Error('No installation state exists to resume');
  if (!state) {
    state = newState(config, fingerprint, steps);
    await stateStore.save(state);
  }
  if (state.configFingerprint !== fingerprint) {
    throw new Error('Configuration changed after installation state was created');
  }

  state.status = 'in_progress';
  state.updatedAt = new Date().toISOString();
  state.lastError = null;
  await stateStore.save(state);

  for (const step of steps) {
    const stepState = state.steps[step.id];
    if (!stepState) throw new Error(`State is missing step ${step.id}`);

    let alreadyApplied = false;
    try {
      alreadyApplied = await step.check();
    } catch {
      alreadyApplied = false;
    }
    if (alreadyApplied) {
      if (stepState.status !== 'completed') {
        stepState.status = 'completed';
        stepState.updatedAt = new Date().toISOString();
        state.updatedAt = stepState.updatedAt;
        await stateStore.save(state);
      }
      onEvent({ type: 'step_skipped', step: step.id });
      continue;
    }
    stepState.status = 'pending';

    stepState.status = 'in_progress';
    stepState.attempts += 1;
    stepState.updatedAt = new Date().toISOString();
    state.updatedAt = stepState.updatedAt;
    await stateStore.save(state);
    onEvent({ type: 'step_started', step: step.id, description: step.description });

    try {
      await step.run();
      if (!(await step.check())) throw new Error(`Postcondition failed for ${step.id}`);
      stepState.status = 'completed';
      stepState.updatedAt = new Date().toISOString();
      state.updatedAt = stepState.updatedAt;
      await stateStore.save(state);
      onEvent({ type: 'step_completed', step: step.id });
    } catch (error) {
      const secret = process.env[config.provider.keyEnv];
      const detail = redact(error.result?.stderr || error.message, [secret]).trim();
      stepState.status = 'failed';
      stepState.updatedAt = new Date().toISOString();
      state.status = 'failed';
      state.updatedAt = stepState.updatedAt;
      state.lastError = { step: step.id, message: detail };
      await stateStore.save(state);
      onEvent({ type: 'step_failed', step: step.id, message: detail });
      throw new Error(`${step.id}: ${detail}`);
    }
  }

  state.status = 'completed';
  state.completedAt = new Date().toISOString();
  state.updatedAt = state.completedAt;
  await stateStore.save(state);
  return state;
}
