SUMMARY = "DHT11 Web Server"
LICENSE = "CLOSED"

SRC_URI += "file://server.py"
SRC_URI += "file://index.html"
SRC_URI += "file://dht-web.service"

S = "${WORKDIR}"

inherit systemd

SYSTEMD_SERVICE:${PN} = "dht-web.service"

do_install() {

    install -d ${D}/opt/dht-web
    install -m 0755 ${WORKDIR}/server.py ${D}/opt/dht-web/
    install -m 0644 ${WORKDIR}/index.html ${D}/opt/dht-web/

    install -d ${D}${systemd_system_unitdir}
    install -m 0644 ${WORKDIR}/dht-web.service \
        ${D}${systemd_system_unitdir}/
}

FILES:${PN} += " \
    /opt/dht-web \
    ${systemd_system_unitdir}/dht-web.service \
"