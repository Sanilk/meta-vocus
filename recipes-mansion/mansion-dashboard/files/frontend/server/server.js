const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');

const APP_DIR = path.join(__dirname, '..', 'public'); // serve frontend assets from public/
const DATA_FILE = path.join(__dirname, 'data.json');
const CONFIG_FILE = path.join(__dirname, 'server-config.json');

let config = { mode: 'local', pollIntervalMs: 2000, port: 3000 };
try {
  const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
  config = Object.assign(config, JSON.parse(raw));
} catch (err) {
  console.warn('No server-config.json found, using defaults.');
}

let prevNetworkStats = null;

function formatUptime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hrs}h ${mins}m`;
}

function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const iface of Object.values(nets)) {
    if (!iface) continue;
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) {
        return addr.address;
      }
    }
  }
  return '127.0.0.1';
}

function getFirmwareVersion() {
  try {
    const release = fs.readFileSync('/etc/os-release', 'utf8');
    const match = release.match(/^VERSION="?(.+?)"?$/m);
    if (match) return match[1];
  } catch (err) {
    // fallback
  }
  return os.release();
}

function getCpuLoadPercent() {
  const loadAvg = os.loadavg()[0] || 0;
  const cores = Math.max(os.cpus().length, 1);
  return Math.round((loadAvg / cores) * 100);
}

function getMemoryUsage() {
  const total = os.totalmem();
  const free = os.freemem();
  return {
    used: Math.round((total - free) / 1024 / 1024),
    total: Math.round(total / 1024 / 1024)
  };
}

function getActiveInterfaceName() {
  const nets = os.networkInterfaces();
  for (const [name, iface] of Object.entries(nets)) {
    if (!iface) continue;
    if (iface.some(addr => addr.family === 'IPv4' && !addr.internal)) {
      return name;
    }
  }
  return null;
}

function readInterfaceBytes(ifName) {
  const base = `/sys/class/net/${ifName}/statistics`;
  const rx = Number(fs.readFileSync(path.join(base, 'rx_bytes'), 'utf8').trim());
  const tx = Number(fs.readFileSync(path.join(base, 'tx_bytes'), 'utf8').trim());
  return { rx, tx };
}

function getNetworkRate() {
  const ifName = getActiveInterfaceName();
  if (!ifName) return { rx: 0, tx: 0 };

  try {
    const now = Date.now();
    const current = readInterfaceBytes(ifName);
    if (!prevNetworkStats || prevNetworkStats.ifName !== ifName) {
      prevNetworkStats = { ifName, rx: current.rx, tx: current.tx, ts: now };
      return { rx: 0, tx: 0 };
    }

    const seconds = Math.max((now - prevNetworkStats.ts) / 1000, 1);
    const rxRate = Math.max((current.rx - prevNetworkStats.rx) / 1024 / 1024 / seconds, 0);
    const txRate = Math.max((current.tx - prevNetworkStats.tx) / 1024 / 1024 / seconds, 0);

    prevNetworkStats = { ifName, rx: current.rx, tx: current.tx, ts: now };
    return { rx: +rxRate.toFixed(2), tx: +txRate.toFixed(2) };
  } catch (err) {
    return { rx: 0, tx: 0 };
  }
}

function fetchSystemData(base) {
  const network = getNetworkRate();
  return {
    status: 'Running',
    uptime: formatUptime(os.uptime()),
    ip: getLocalIp(),
    firmware: getFirmwareVersion(),
    temperature: typeof base.temperature === 'number' ? base.temperature : 0,
    humidity: typeof base.humidity === 'number' ? base.humidity : 0,
    tvoc: typeof base.tvoc === 'number' ? base.tvoc : 0,
    voltage: typeof base.voltage === 'number' ? base.voltage : 0,
    cpuLoad: getCpuLoadPercent(),
    memory: getMemoryUsage(),
    network,
    ledState: typeof base.ledState === 'boolean' ? base.ledState : false,
    bootMode: base.bootMode || 'Normal'
  };
}

function fetchMock(base) {
  // make small variations
  const jitter = (v, pct) => Math.max(0, +(v + (Math.random() - 0.5) * v * pct).toFixed(2));
  const now = new Date();
  const uptimeHours = Math.floor((Date.now() / 1000 / 3600) % 1000);
  const uptime = `${uptimeHours}h ${Math.floor((Date.now() / 1000 / 60) % 60)}m`;
  return Object.assign({}, base, {
    uptime,
    temperature: jitter(base.temperature, 0.03),
    humidity: jitter(base.humidity, 0.04),
    tvoc: Math.round(jitter(base.tvoc, 0.08)),
    cpuLoad: Math.round(jitter(base.cpuLoad, 0.15)),
    network: {
      rx: +(base.network.rx + (Math.random() - 0.5) * base.network.rx * 0.2).toFixed(2),
      tx: +(base.network.tx + (Math.random() - 0.5) * base.network.tx * 0.2).toFixed(2)
    }
  });
}

async function fetchTelemetry() {
  try {
    if (config.mode === 'ssh') {
      const resp = await fetchFromSSH(config.ssh);
      return resp;
    } else if (config.mode === 'cmd') {
      const resp = await fetchFromCmd(config.cmd);
      return resp;
    } else if (config.mode === 'local') {
      return fetchSystemData(config.mock || {});
    } else {
      return fetchMock(config.mock || {});
    }
  } catch (err) {
    console.error('Hardware fetch failed:', err);
    if (config.mode === 'local') {
      return fetchSystemData(config.mock || {});
    }
    return fetchMock(config.mock || {});
  }
}

function writeDataFile(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write telemetry data file:', err);
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch (err) {
    return null;
  }
}

function fetchFromCmd(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { encoding: 'utf8', shell: '/bin/sh' }, (err, stdout, stderr) => {
      if (err) return reject(err);
      const parsed = parseJson(stdout);
      if (!parsed) return reject(new Error(`Invalid JSON from cmd: ${stderr || stdout}`));
      resolve(parsed);
    });
  });
}

function fetchFromSSH(ssh) {
  if (!ssh || !ssh.host || !ssh.command) {
    return Promise.reject(new Error('Invalid SSH config')); 
  }
  const escapedCommand = ssh.command.replace(/'/g, "'\\''");
  return fetchFromCmd(`ssh ${ssh.host} '${escapedCommand}'`);
}

// Ensure data file exists initially
if (!fs.existsSync(DATA_FILE)) {
  if (config.mode === 'local') {
    writeDataFile(fetchSystemData(config.mock || {}));
  } else {
    writeDataFile(config.mock || { status: 'Running' });
  }
}

const app = express();
app.use(express.json());
app.use(express.static(APP_DIR));

app.get('/api/telemetry', async (req, res) => {
  try {
    const telemetry = await fetchTelemetry();
    writeDataFile(telemetry);
    return res.json(telemetry);
  } catch (err) {
    console.error('Failed to fetch telemetry:', err);
    return res.status(500).json({ error: 'failed to fetch telemetry', details: err.message });
  }
});

app.post('/api/telemetry', (req, res) => {
  const payload = req.body;
  if (!payload) return res.status(400).json({ error: 'no payload' });
  writeDataFile(payload);
  return res.json({ ok: true });
});

app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
});

// Poll hardware and update data.json periodically
if (config.mode !== 'push') {
  setInterval(async () => {
    const t = await fetchTelemetry();
    writeDataFile(t);
  }, config.pollIntervalMs || 2000);
}

console.log('Telemetry poller started (mode=' + config.mode + ').');
