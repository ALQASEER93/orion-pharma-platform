#!/usr/bin/env sh
set -eu

timestamp="$(date -u +"%Y%m%dT%H%M%SZ")"
backup_dir="${ORION_BACKUP_DIR:-./backups}"
mkdir -p "$backup_dir"

if [ -z "${ORION_DB_URL:-}" ]; then
  echo "ORION_DB_URL is required for backup." >&2
  exit 1
fi

archive_path="$backup_dir/orion_db_${timestamp}.dump"

pg_dump --format=custom --file="$archive_path" "$ORION_DB_URL"

if [ -n "${ORION_BACKUP_S3_BUCKET:-}" ]; then
  if ! command -v aws >/dev/null 2>&1; then
    echo "aws CLI is required for S3-compatible backup uploads." >&2
    exit 1
  fi

  if [ -n "${ORION_BACKUP_S3_ENDPOINT:-}" ]; then
    aws --endpoint-url "$ORION_BACKUP_S3_ENDPOINT" \
      s3 cp "$archive_path" "s3://${ORION_BACKUP_S3_BUCKET}/$(basename "$archive_path")"
  else
    aws s3 cp "$archive_path" "s3://${ORION_BACKUP_S3_BUCKET}/$(basename "$archive_path")"
  fi
fi

if [ -n "${ORION_BACKUP_SFTP_HOST:-}" ]; then
  if ! command -v sftp >/dev/null 2>&1; then
    echo "sftp client is required for SFTP backup uploads." >&2
    exit 1
  fi

  remote_dir="${ORION_BACKUP_SFTP_PATH:-.}"
  remote_user="${ORION_BACKUP_SFTP_USER:-}"

  if [ -z "$remote_user" ]; then
    echo "ORION_BACKUP_SFTP_USER is required when ORION_BACKUP_SFTP_HOST is set." >&2
    exit 1
  fi

  sftp "${remote_user}@${ORION_BACKUP_SFTP_HOST}" <<EOF
put ${archive_path} ${remote_dir}/$(basename "$archive_path")
bye
EOF
fi

echo "Backup created: $archive_path"
