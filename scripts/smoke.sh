#!/usr/bin/env bash
set -euo pipefail
base="${1:-http://localhost:8080}"
curl --fail --silent "$base/health"
curl --fail --silent "$base/ready"
curl --fail --silent "$base/api/auth/status"
printf '\nDeployment health checks passed.\n'
