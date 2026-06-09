SUMMARY = "Systemd-networkd configuration for eth0"
DESCRIPTION = "Installs a simple systemd-networkd .network file for the eth0 interface."
LICENSE = "CLOSED"
PR = "r0"

SRC_URI = "file://10-eth0.network"

inherit allarch

S = "${WORKDIR}"

do_install() {
    install -d ${D}${libdir}/systemd/network
    install -m 0644 ${WORKDIR}/10-eth0.network ${D}${libdir}/systemd/network/
}

FILES_${PN} += "${libdir}/systemd/network"
