#!/usr/bin/env bash

set -Eeuo pipefail

env_file=/opt/brain4u/hermes/data/.env
api_key="$(sed -n 's/^API_SERVER_KEY=//p' "$env_file")"

if [[ -z "$api_key" ]]; then
  printf 'API_SERVER_KEY is missing.\n' >&2
  exit 1
fi

response="$({
  curl --fail-with-body -sS --max-time 120 \
    -H "Authorization: Bearer $api_key" \
    -H 'Content-Type: application/json' \
    --data-binary @- \
    http://127.0.0.1:8642/v1/chat/completions <<'JSON'
{
  "model": "openrouter/free",
  "messages": [
    {
      "role": "user",
      "content": "Reply with exactly BRAIN4U_OK and do not use tools."
    }
  ],
  "stream": false
}
JSON
})"

unset api_key

jq '{
  model,
  content: .choices[0].message.content,
  finish_reason: .choices[0].finish_reason,
  error
}' <<<"$response"
