#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# -ne 1 || ! "$1" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Usage: $0 <40-character-git-sha>" >&2
  exit 64
fi

readonly SHA="$1"
readonly BASE_DIR="/opt/dentalcloud"
readonly INCOMING_DIR="${BASE_DIR}/incoming"
readonly ARCHIVE="${INCOMING_DIR}/dentalcloud-${SHA}.tar.gz"
readonly COMPOSE_FILE="${BASE_DIR}/compose.production.yml"
readonly CURRENT_FILE="${BASE_DIR}/current-sha"
readonly PROJECT_NAME="dentalcloud-act2"
readonly IMAGE="dentalcloud-pro:${SHA}"
readonly HOST_PORT="18082"

mkdir -p "${INCOMING_DIR}"
exec 9>"${BASE_DIR}/deploy.lock"
flock -n 9 || { echo "Another DentalCloud deployment is running." >&2; exit 75; }

[[ -s "${ARCHIVE}" ]] || { echo "Missing image archive: ${ARCHIVE}" >&2; exit 66; }
[[ -s "${COMPOSE_FILE}" ]] || { echo "Missing root-owned Compose file: ${COMPOSE_FILE}" >&2; exit 66; }

previous_sha=""
if [[ -s "${CURRENT_FILE}" ]]; then
  previous_sha="$(tr -d '[:space:]' < "${CURRENT_FILE}")"
fi

echo "Loading ${IMAGE}..."
gzip -dc "${ARCHIVE}" | docker image load >/dev/null
docker image inspect "${IMAGE}" >/dev/null

start_release() {
  local release_sha="$1"
  local image="dentalcloud-pro:${release_sha}"

  docker image inspect "${image}" >/dev/null
  DENTALCLOUD_IMAGE="${image}" DENTALCLOUD_HOST_PORT="${HOST_PORT}" \
    docker compose --project-name "${PROJECT_NAME}" --file "${COMPOSE_FILE}" \
      config --quiet
  DENTALCLOUD_IMAGE="${image}" DENTALCLOUD_HOST_PORT="${HOST_PORT}" \
    docker compose --project-name "${PROJECT_NAME}" --file "${COMPOSE_FILE}" \
      up -d --no-build --no-deps web
}

healthy=false
if start_release "${SHA}"; then
  for _ in {1..30}; do
    if curl --silent --show-error --fail --max-time 3 \
      "http://127.0.0.1:${HOST_PORT}/health" | grep -qx 'ok'; then
      healthy=true
      break
    fi
    sleep 2
  done
fi

if [[ "${healthy}" != true ]]; then
  echo "Deployment ${SHA} failed its health check." >&2
  docker logs --tail 100 dentalcloud-web >&2 || true
  if [[ "${previous_sha}" =~ ^[0-9a-f]{40}$ ]]; then
    echo "Rolling back to ${previous_sha}..." >&2
    start_release "${previous_sha}"
  fi
  exit 1
fi

printf '%s\n' "${SHA}" > "${CURRENT_FILE}.tmp"
mv "${CURRENT_FILE}.tmp" "${CURRENT_FILE}"
rm -f "${ARCHIVE}"

echo "DentalCloud ${SHA} is healthy on 127.0.0.1:${HOST_PORT}."