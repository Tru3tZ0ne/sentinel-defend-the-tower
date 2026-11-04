#!/bin/sh
# Run as root from an extracted, trusted release bundle. No network configuration changes.
set -eu
bundle=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
version=${1:?Usage: install.sh RELEASE_VERSION PRIVATE_IPV4}
address=${2:?Usage: install.sh RELEASE_VERSION PRIVATE_IPV4}
[ "$(id -u)" = 0 ] || { echo 'Run as root' >&2; exit 1; }
case "$version" in ''|*[!a-zA-Z0-9._-]*) echo 'Invalid release name' >&2; exit 1;; esac
python3 -c 'import ipaddress,sys; ipaddress.IPv4Address(sys.argv[1])' "$address"
[ -f "$bundle/game/stand.html" ] && [ -f "$bundle/server/app.py" ]
release="/srv/sentinel/releases/$version"
[ ! -e "$release" ] || { echo 'Release already exists; use a new version' >&2; exit 1; }
id sentinel >/dev/null 2>&1 || useradd --system --home-dir /var/lib/sentinel --shell /usr/sbin/nologin sentinel
install -d -m 755 /srv/sentinel/releases /etc/sentinel /opt
install -d -o sentinel -g sentinel -m 700 /var/lib/sentinel /var/backups/sentinel
install -d -o root -g sentinel -m 750 /etc/sentinel/tls
install -d -o root -g root -m 700 /root/sentinel-ca
umask 077
if [ ! -f /root/sentinel-ca/ca.key ]; then
  openssl req -x509 -newkey rsa:3072 -sha256 -nodes -days 3650 \
    -keyout /root/sentinel-ca/ca.key -out /root/sentinel-ca/ca.crt \
    -subj '/CN=Sentinel Intranet Root CA/O=Sentinel Internal' \
    -addext 'basicConstraints=critical,CA:TRUE,pathlen:0' \
    -addext 'keyUsage=critical,keyCertSign,cRLSign'
fi
if [ ! -f /etc/sentinel/tls/server.crt ]; then
  openssl req -new -newkey rsa:2048 -nodes -sha256 \
    -keyout /etc/sentinel/tls/server.key -out /etc/sentinel/tls/server.csr \
    -subj "/CN=$address/O=Sentinel Internal"
  cat > /etc/sentinel/tls/server.ext <<EOF
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=IP:$address,IP:127.0.0.1,DNS:localhost
EOF
  openssl x509 -req -sha256 -days 365 -in /etc/sentinel/tls/server.csr \
    -CA /root/sentinel-ca/ca.crt -CAkey /root/sentinel-ca/ca.key -CAcreateserial \
    -extfile /etc/sentinel/tls/server.ext -out /etc/sentinel/tls/server.crt
fi
openssl verify -CAfile /root/sentinel-ca/ca.crt -verify_ip "$address" /etc/sentinel/tls/server.crt
openssl x509 -checkend 604800 -noout -in /etc/sentinel/tls/server.crt
chown root:sentinel /etc/sentinel/tls/server.key /etc/sentinel/tls/server.crt
chmod 640 /etc/sentinel/tls/server.key
chmod 644 /etc/sentinel/tls/server.crt
install -m 644 /root/sentinel-ca/ca.crt /etc/sentinel/ca.crt
mkdir "$release"
cp -R "$bundle/game" "$bundle/server" "$release/"
chown -R root:root "$release"
find "$release" -type d -exec chmod 755 {} +
find "$release" -type f -exec chmod 644 {} +
ln -s "$release/game" /srv/sentinel/current.next
mv -Tf /srv/sentinel/current.next /srv/sentinel/current
ln -s "$release/server" /opt/sentinel-server.next
mv -Tf /opt/sentinel-server.next /opt/sentinel-server
install -m 644 "$release/server/sentinel.service" /etc/systemd/system/sentinel.service
install -m 644 "$release/server/sentinel-backup.service" /etc/systemd/system/sentinel-backup.service
install -m 644 "$release/server/sentinel-backup.timer" /etc/systemd/system/sentinel-backup.timer
systemctl daemon-reload
systemctl enable sentinel.service sentinel-backup.timer
systemctl restart sentinel.service
systemctl start sentinel-backup.timer
sleep 1
curl --fail --silent --show-error --cacert /etc/sentinel/ca.crt https://127.0.0.1/api/health
systemctl start sentinel-backup.service
printf '\nRelease %s is running. Public CA: /etc/sentinel/ca.crt\n' "$version"
