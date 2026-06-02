SUMMARY = "STM32 Dashboard server and web frontend"
DESCRIPTION = "A simple Node.js dashboard server and browser UI for STM32 telemetry, packaged for Yocto."
LICENSE = "MIT"
LIC_FILES_CHKSUM = "file://COPYING.MIT;md5=3da9cfbcb788c80a0384361b4de20420"

PR = "r0"

FILESEXTRAPATHS_prepend := "${LAYERDIR}:"
SRC_URI = "file://frontend \
           file://initial_setup.sh"
S = "${WORKDIR}/frontend"

DEPENDS = "nodejs-native"
RDEPENDS_${PN} = "nodejs"

inherit allarch
inherit systemd

SYSTEMD_SERVICE_${PN} = "stm32-dashboard.service"
SYSTEMD_AUTO_ENABLE = "enable"

do_compile() {
    cd ${S}/server
    npm install --production --no-audit --no-fund
}

do_install() {
    install -d ${D}${datadir}/mansion-dashboard/server
    install -d ${D}${datadir}/mansion-dashboard/public
    install -d ${D}${systemd_unitdir}/system
    install -d ${D}${bindir}

    cp -a ${S}/server/. ${D}${datadir}/mansion-dashboard/server/
    cp -a ${S}/public/. ${D}${datadir}/mansion-dashboard/public/
    install -m 0644 ${S}/server/stm32-dashboard.service ${D}${systemd_unitdir}/system/
    install -m 0755 ${WORKDIR}/initial_setup.sh ${D}${bindir}initial_setup
}

FILES_${PN} += "${datadir}/mansion-dashboard ${systemd_unitdir}/system/stm32-dashboard.service"
