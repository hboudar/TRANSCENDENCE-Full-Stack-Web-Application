#!/bin/sh
set -e

envsubst < /etc/alertmanager/alertmanager.yml > /tmp/alertmanager.yml

exec /bin/alertmanager \
  --web.external-url=${EXTERNAL_URL} \
  --config.file=/tmp/alertmanager.yml \
  --storage.path=/alertmanager