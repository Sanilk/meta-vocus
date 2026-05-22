Server for STM32 Dashboard

This simple Node.js server polls hardware (or runs a mock) and updates `data.json` used by the frontend. It also serves the frontend files and exposes an API.

Quick start

1. Install dependencies

```bash
cd frontend
npm install
```

2. Start the server

```bash
npm start
```

3. Open the dashboard in your browser

Navigate to http://localhost:3000 (change port in `server-config.json` if needed).

Configuration

Edit `server-config.json` to change behavior:

- `mode`: `local` (fetch local system telemetry), `mock`, `cmd` (run local shell command), `ssh` (ssh to remote and run command) or `push` (no polling)
- `pollIntervalMs`: polling interval in milliseconds
- `mock`: base telemetry values used for mock mode and for local mode fallback where sensor fields remain simulated
- `cmd`: set `cmd` to a shell command that prints JSON telemetry
- `ssh`: set `ssh.host` and `ssh.command` to fetch JSON via ssh

Example `cmd` usage

If your STM32 board can be queried via an SSH command that outputs JSON, set `mode` to `cmd` and `cmd` to something like:

```json
"cmd": "ssh root@192.168.1.120 'cat /path/to/telemetry.json'"
```

Security

- When using `ssh` or `cmd`, ensure your environment is secure and commands are trusted.
- This server is intentionally simple and not hardened for production.

Extending

- Replace `fetchMock()` with a serial-port reader (e.g., using `serialport`) if your board connects via a serial console.
- Add authentication to the HTTP endpoints if exposing remotely.

Automatic startup on system boot

To launch the dashboard server automatically when Linux starts, install the systemd unit file:

```bash
sudo cp stm32-dashboard.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable stm32-dashboard.service
sudo systemctl start stm32-dashboard.service
```

Verify status:

```bash
sudo systemctl status stm32-dashboard.service
```

If your installation uses a different node path or a non-root user, update `ExecStart` and optionally add `User=` in `/etc/systemd/system/stm32-dashboard.service`.

Alternative startup script

A helper script is included at `start-dashboard.sh`.
Make it executable and run it from the repository root:

```bash
cd /home/slazar/Documents/study_materials/frontend
chmod +x start-dashboard.sh
./start-dashboard.sh
```

This is useful for manual startup or for use in a custom boot wrapper.
