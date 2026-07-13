#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
ROOT_DIR=$(cd -- "${SCRIPT_DIR}/../../.." && pwd)
IMAGE_NAME=${IMAGE_NAME:-admin-vue-local}
BUILD_ENV_FILE=${ADMIN_VUE_BUILD_ENV_FILE:-}
IMAGE_BASENAME=${IMAGE_NAME##*/}
DEFAULT_CONTAINER_NAME=${IMAGE_BASENAME%%@*}
DEFAULT_CONTAINER_NAME=${DEFAULT_CONTAINER_NAME%%:*}
CONTAINER_NAME=${CONTAINER_NAME:-${DEFAULT_CONTAINER_NAME}}

if [[ -z "${BUILD_ENV_FILE}" ]]; then
  printf 'ADMIN_VUE_BUILD_ENV_FILE is required for a production Docker build.\n' >&2
  exit 1
fi

if [[ ! -r "${BUILD_ENV_FILE}" ]]; then
  printf 'Build environment file is not readable: %s\n' "${BUILD_ENV_FILE}" >&2
  exit 1
fi

if [[ ! "${CONTAINER_NAME}" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]*$ ]]; then
  printf 'Invalid Docker container name: %s\n' "${CONTAINER_NAME}" >&2
  exit 1
fi

docker build \
  --file "${SCRIPT_DIR}/Dockerfile" \
  --secret "id=admin-vue-env,src=${BUILD_ENV_FILE}" \
  --tag "${IMAGE_NAME}" \
  "${ROOT_DIR}"

printf 'Docker image built: %s\n' "${IMAGE_NAME}"
printf 'Run with: docker run -d -p 8010:8080 --name %s %s\n' \
  "${CONTAINER_NAME}" \
  "${IMAGE_NAME}"
