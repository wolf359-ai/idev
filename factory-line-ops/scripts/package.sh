#!/usr/bin/env bash
# Build AppInspect-oriented .spl archives (ustar gzip, one top-level app folder).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="${ROOT}/dist"
STAGE="$(mktemp -d)"
trap 'rm -rf "${STAGE}"' EXIT

mkdir -p "${DIST}"

package_one() {
  local src_name="$1"
  local version="$2"
  local src="${ROOT}/packages/${src_name}"
  local staged="${STAGE}/${src_name}"

  if [[ ! -d "${src}" ]]; then
    echo "Missing package ${src}" >&2
    return 1
  fi

  mkdir -p "${staged}"
  tar -C "${src}" -cf - . | tar -C "${staged}" -xf -

  # Runtime and junk that AppInspect / Cloud reject
  rm -rf "${staged}/local" "${staged}/metadata/local.meta"
  find "${staged}" -name '.DS_Store' -delete
  find "${staged}" -name '._*' -delete
  find "${staged}" -name '.git*' -delete

  local out="${DIST}/${src_name}-${version}.spl"
  rm -f "${out}"
  COPYFILE_DISABLE=1 tar --format=ustar -C "${STAGE}" -czf "${out}" "${src_name}"
  echo "Wrote ${out}"
}

package_one TA-factory_line 0.1.0
package_one factory_line_ops 0.1.0
