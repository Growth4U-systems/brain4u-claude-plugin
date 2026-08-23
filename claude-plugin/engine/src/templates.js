export const PERSISTENCE_CANARY = 'brain4u-persistence-canary-v1\n';
export const PERSISTENCE_CANARY_SHA256 = '78d000b3297402588017b17f28ddaafd23884a6c76f53ad75361f9a7191b897a';

export function renderCompose(config) {
  return `services:
  hermes:
    image: ${config.hermes.image}
    container_name: brain4u-hermes-spike
    restart: unless-stopped
    command:
      - gateway
      - run
    shm_size: 1gb
    ports:
      - "127.0.0.1:8642:8642"
    volumes:
      - /opt/brain4u/hermes/data:/opt/data
    logging:
      driver: json-file
      options:
        max-size: 10m
        max-file: "3"
`;
}

export function renderHermesConfig(config) {
  return `_config_version: 12

model:
  provider: ${JSON.stringify(config.provider.kind)}
  default: ${JSON.stringify(config.provider.model)}

tool_loop_guardrails:
  hard_stop_enabled: true
  hard_stop_after:
    exact_failure: 5
    idempotent_no_progress: 5
`;
}
