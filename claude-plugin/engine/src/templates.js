export const PERSISTENCE_CANARY = 'brain4u-persistence-canary-v1\n';
export const PERSISTENCE_CANARY_SHA256 = '78d000b3297402588017b17f28ddaafd23884a6c76f53ad75361f9a7191b897a';

export function renderCompose(config) {
  const brainRuntime = config.brain?.sshUrl ? `    working_dir: /opt/brain
    environment:
      GIT_SSH_COMMAND: "ssh -i /opt/brain4u-ssh/brain-deploy-key -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=/opt/brain4u-ssh/known_hosts"
` : '';
  const brainVolumes = config.brain?.sshUrl ? `
      - /opt/brain4u/brain:/opt/brain
      - /opt/brain4u/secrets/ssh:/opt/brain4u-ssh:ro` : '';
  return `services:
  hermes:
    image: ${config.hermes.image}
    container_name: brain4u-hermes-spike
    restart: unless-stopped
    command:
      - gateway
      - run
${brainRuntime}    shm_size: 1gb
    ports:
      - "127.0.0.1:8642:8642"
    volumes:
      - /opt/brain4u/hermes/data:/opt/data${brainVolumes}
    logging:
      driver: json-file
      options:
        max-size: 10m
        max-file: "3"
`;
}

export function renderHermesConfig(config) {
  const brainInstructions = config.brain?.sshUrl ? `agent:
  system_prompt: |
    Your durable company memory is the private Brain4U repository mounted at /opt/brain.
    Start with /opt/brain/INDEX.md, then read only the relevant linked context.
    Follow CLAUDE.md, AGENTS.md and governance/memory-writeback-policy.md before writing.
    Keep the repository structured, lint changes, and route durable updates through the configured governance workflow.

terminal:
  cwd: /opt/brain

` : '';
  return `_config_version: 12

model:
  provider: ${JSON.stringify(config.provider.kind)}
  default: ${JSON.stringify(config.provider.model)}

${brainInstructions}tool_loop_guardrails:
  hard_stop_enabled: true
  hard_stop_after:
    exact_failure: 5
    idempotent_no_progress: 5
`;
}
