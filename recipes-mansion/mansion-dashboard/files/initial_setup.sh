#!/bin/bash
set -e

echo "=== STM32MP157C Full Initial Setup (Networking + WiFi + Drivers) ==="

# ------------------------------------------------------------
# 1. SYSTEM UPDATE + BASE PACKAGES
# ------------------------------------------------------------
echo "[1/7] Updating system and installing base tools..."

sudo apt update

sudo apt install -y \
    git \
    make \
    gcc \
    g++ \
    device-tree-compiler \
    wget \
    curl \
    iproute2 \
    net-tools \
    ethtool \
    dnsutils \
    linux-headers-$(uname -r)

# ------------------------------------------------------------
# 2. NETWORKING TOOLING (Ethernet + diagnostics)
# ------------------------------------------------------------
echo "[2/7] Installing networking tools..."

sudo apt install -y \
    dhcpcd5 \
    isc-dhcp-client \
    network-manager \
    traceroute \
    iputils-ping

# Enable NetworkManager if present
sudo systemctl enable NetworkManager || true
sudo systemctl start NetworkManager || true

# ------------------------------------------------------------
# 3. WIFI SETUP SUPPORT (wpa_supplicant fallback tools)
# ------------------------------------------------------------
echo "[3/7] Installing Wi-Fi tools..."

sudo apt install -y \
    wireless-tools \
    wpasupplicant \
    rfkill

# Unblock WiFi/BT if blocked
sudo rfkill unblock all || true

# ------------------------------------------------------------
# 4. SEEED DT OVERLAYS
# ------------------------------------------------------------
echo "[4/7] Cloning Seeed overlays..."

if [ ! -d "seeed-linux-dtverlays" ]; then
    git clone https://github.com/Seeed-Studio/seeed-linux-dtverlays
fi

cd seeed-linux-dtverlays

echo "[4.1] Building STM32MP1 overlays..."
make all_stm32mp1 CUSTOM_MOD_FILTER_OUT="jtsn-wm8960"

echo "[4.2] Installing overlays..."
sudo make install_stm32mp1 CUSTOM_MOD_FILTER_OUT="jtsn-wm8960"

cd ..

# ------------------------------------------------------------
# 5. ENABLE WIFI/BT DTBO
# ------------------------------------------------------------
echo "[5/7] Enabling WiFi/BT overlay..."

OVERLAY="uboot_overlay_addr0=/lib/firmware/stm32mp1-seeed-ap6236.dtbo"

sudo touch /boot/uEnv.txt

if ! grep -Fxq "$OVERLAY" /boot/uEnv.txt; then
    echo "$OVERLAY" | sudo tee -a /boot/uEnv.txt >/dev/null
fi

# ------------------------------------------------------------
# 6. OPTIONAL WIFI AUTO CONFIG (interactive fallback)
# ------------------------------------------------------------
echo "[6/7] Wi-Fi configuration helper..."

cat <<EOF

If you want to connect Wi-Fi now, run:

  nmcli dev wifi list
  nmcli dev wifi connect "SSID" password "PASSWORD"

OR fallback method:

  wpa_passphrase "SSID" "PASSWORD" > /etc/wpa_supplicant.conf
  wpa_supplicant -B -i wlan0 -c /etc/wpa_supplicant.conf
  dhclient wlan0

EOF

# ------------------------------------------------------------
# 7. BLUETOOTH + FINAL SETUP
# ------------------------------------------------------------
echo "[7/7] Enabling Bluetooth..."

sudo apt install -y bluetooth bluez bluez-tools
sudo systemctl enable bluetooth || true
sudo systemctl start bluetooth || true

echo ""
echo "=== SETUP COMPLETE ==="
echo ""
echo "Next steps:"
echo "1. Reboot board"
echo "2. Verify interfaces:"
echo "   ip a"
echo "3. Test networking:"
echo "   ping 8.8.8.8"
echo "4. Setup WiFi using nmcli"
echo ""

read -p "Reboot now? (y/n): " ans
if [ "$ans" = "y" ]; then
    sudo reboot
fi