const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const APP_DIR = path.join(__dirname, '..', 'public'); // serve frontend assets from public/
const DATA_FILE = path.join(__dirname, 'data.json');
const CONFIG_FILE = path.join(__dirname, 'server-config.json');

let config = { mode: 'mock', pollIntervalMs: 2000, port: 3000 };
try {
  const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
  config = Object.assign(config, JSON.parse(raw));
} catch (err) {
  console.warn('No server-config.json found, using defaults.');
}

function writeDataFile(obj) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2));
  } catch (err) {
    console.error('Failed to write data file:', err);
  }
}

function fetchFromSSH(sshCfg) {
  return new Promise((resolve, reject) => {
    if (!sshCfg.host || !sshCfg.command) return reject(new Error('SSH host/command not configured'));
    const cmd = `ssh ${sshCfg.host} "${sshCfg.command}"`;
    exec(cmd, { timeout: 15000 }, (err, stdout, stderr) => {
      if (err) return reject(err);
      try {
        const parsed = JSON.parse(stdout);
        resolve(parsed);
      } catch (e) {
        reject(e);
      }
    });
  });
}

function fetchFromCmd(cmd) {
  return new Promise((resolve, reject) => {
    if (!cmd) return reject(new Error('Command not configured'));
    exec(cmd, { timeout: 15000 }, (err, stdout, stderr) => {
      if (err) return reject(err);
      try {
        const parsed = JSON.parse(stdout);
        resolve(parsed);
      } catch (e) {
        reject(e);
      }
    });
  });
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
    } else {
      return fetchMock(config.mock || {});
    }
  } catch (err) {
    console.error('Hardware fetch failed:', err);
    return fetchMock(config.mock || {});
  }
}

// Ensure data file exists initially
if (!fs.existsSync(DATA_FILE)) {
  writeDataFile(config.mock || { status: 'Running' });
}

const app = express();
app.use(express.json());
app.use(express.static(APP_DIR));

app.get('/api/telemetry', (req, res) => {
  fs.readFile(DATA_FILE, 'utf8', (err, txt) => {
    if (err) return res.status(500).json({ error: 'failed to read data' });
    try {
      return res.json(JSON.parse(txt));
    } catch (e) {
      return res.status(500).json({ error: 'invalid data file' });
    }
  });
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
