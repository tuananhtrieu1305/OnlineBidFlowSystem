#!/bin/sh
set -eu

ca_file=/etc/secrets/mysql-ca.pem
if [ -e "$ca_file" ]; then
    : "${SPRING_DATASOURCE_URL:?Set the MySQL JDBC URL before adding mysql-ca.pem}"
    trust_dir=$(mktemp -d)
    trust_store="$trust_dir/mysql-trust.p12"
    keytool -importcert -noprompt -alias provider-mysql-ca -file "$ca_file" \
        -keystore "$trust_store" -storetype PKCS12 -storepass changeit
    case "$SPRING_DATASOURCE_URL" in
        *\?*) separator='&' ;;
        *) separator='?' ;;
    esac
    export SPRING_DATASOURCE_URL="${SPRING_DATASOURCE_URL}${separator}trustCertificateKeyStoreUrl=file:${trust_store}&trustCertificateKeyStoreType=PKCS12&trustCertificateKeyStorePassword=changeit&fallbackToSystemTrustStore=false"
fi

exec java -jar /app/app.jar "$@"
