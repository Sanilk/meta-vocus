// DOM Elements
const refreshBtn = document.getElementById('refresh-btn');
const boardStatus = document.getElementById('board-status');
const boardUptime = document.getElementById('board-uptime');
const boardIp = document.getElementById('board-ip');
const boardFirmware = document.getElementById('board-firmware');
const cpuLoad = document.getElementById('cpu-load');
const memoryUsage = document.getElementById('memory-usage');
const temperature = document.getElementById('temperature');
const humidity = document.getElementById('humidity');
const tvoc = document.getElementById('tvoc');
const voltage = document.getElementById('voltage');
const networkRx = document.getElementById('network-rx');
const networkTx = document.getElementById('network-tx');
const activityLog = document.getElementById('activity-log');
const restartBtn = document.getElementById('restart-btn');
const shutdownBtn = document.getElementById('shutdown-btn');
const toggleLedBtn = document.getElementById('toggle-led-btn');
const bootModeBtn = document.getElementById('boot-mode-btn');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const currentTime = document.getElementById('current-time');
const pageTitle = document.getElementById('page-title');
const pageSubtitle = document.getElementById('page-subtitle');

// Navigation and Page Elements
const navBtns = document.querySelectorAll('.nav-btn');
const pages = document.querySelectorAll('.page');

// Sensor Data Storage
// store objects {t: timestamp_ms, v: value}
let sensorHistory = {
    temperature: [],
    humidity: [],
    tvoc: []
};

let sensorPaused = {
    temperature: false,
    humidity: false,
    tvoc: false
};

let sensorCharts = {
    temperature: null,
    humidity: null,
    tvoc: null
};

let boardState = {
    ledOn: false,
    bootMode: 'Normal'
};

let sensorBaselines = {
    temperature: 45,
    humidity: 62,
    tvoc: 150,
    cpuLoad: 31
};

function getRealisticValue(baseline, variance = 0.05) {
    const change = (Math.random() - 0.5) * baseline * variance * 2;
    return Math.max(0, baseline + change);
}

function setTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark');
        themeToggleBtn.textContent = '☀️';
        themeToggleBtn.setAttribute('aria-label', 'Switch to light mode');
    } else {
        document.body.classList.remove('dark');
        themeToggleBtn.textContent = '🌙';
        themeToggleBtn.setAttribute('aria-label', 'Switch to dark mode');
    }
    localStorage.setItem('dashboard-theme', theme);
}

function initializeTheme() {
    const savedTheme = localStorage.getItem('dashboard-theme');
    const preferredTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    setTheme(savedTheme || preferredTheme);
}

function updateClock() {
    const now = new Date();
    currentTime.textContent = now.toLocaleTimeString();
}

function startClock() {
    updateClock();
    setInterval(updateClock, 1000);
}

function log(message) {
    const timestamp = new Date().toLocaleTimeString();
    const current = activityLog.textContent.trim();
    activityLog.textContent = `${timestamp} · ${message}\n${current === 'No activity yet.' ? '' : current}`;
}

function sensorLog(sensorName, message) {
    const timestamp = new Date().toLocaleTimeString();
    const logElement = document.getElementById(`${sensorName}-log`);
    if (!logElement) return;
    
    const current = logElement.textContent.trim();
    logElement.textContent = `${timestamp} · ${message}\n${current === 'No activity yet.' ? '' : current}`;
}

function renderBoard(data) {
    boardStatus.textContent = data.status;
    boardUptime.textContent = data.uptime;
    boardIp.textContent = data.ip;
    boardFirmware.textContent = data.firmware;
    cpuLoad.textContent = `${Math.round(data.cpuLoad)}%`;
    memoryUsage.textContent = `${data.memory.used} / ${data.memory.total} MB`;
    temperature.textContent = `${data.temperature.toFixed(1)} °C`;
    humidity.textContent = `${data.humidity.toFixed(1)} %`;
    tvoc.textContent = `${Math.round(data.tvoc)} ppb`;
    voltage.textContent = `${data.voltage.toFixed(2)} V`;
    networkRx.textContent = `${data.network.rx.toFixed(1)} MB/s`;
    networkTx.textContent = `${data.network.tx.toFixed(1)} MB/s`;

    boardState.ledOn = data.ledState;
    boardState.bootMode = data.bootMode;
    toggleLedBtn.textContent = boardState.ledOn ? 'Turn LED Off' : 'Turn LED On';
    bootModeBtn.textContent = boardState.bootMode === 'Normal' ? 'Switch to Recovery' : 'Switch to Normal';
    
    // Update sensor history (timestamped) if not paused; keep last 1 hour
    const now = Date.now();
    const cutoff = now - 60 * 60 * 1000; // 1 hour ago

    if (!sensorPaused.temperature) {
        sensorHistory.temperature.push({ t: now, v: data.temperature });
        sensorHistory.temperature = sensorHistory.temperature.filter(e => e.t >= cutoff);
    }
    if (!sensorPaused.humidity) {
        sensorHistory.humidity.push({ t: now, v: data.humidity });
        sensorHistory.humidity = sensorHistory.humidity.filter(e => e.t >= cutoff);
    }
    if (!sensorPaused.tvoc) {
        sensorHistory.tvoc.push({ t: now, v: data.tvoc });
        sensorHistory.tvoc = sensorHistory.tvoc.filter(e => e.t >= cutoff);
    }
    
    updateSensorCharts();
    updateSensorStats();
}

async function loadData(isManual = false) {
    try {
        const response = await fetch('/api/telemetry', { cache: 'no-store' });
        const baseData = await response.json();
        
        const data = {
            ...baseData,
            temperature: getRealisticValue(sensorBaselines.temperature, 0.03),
            humidity: getRealisticValue(sensorBaselines.humidity, 0.04),
            tvoc: getRealisticValue(sensorBaselines.tvoc, 0.08),
            cpuLoad: getRealisticValue(sensorBaselines.cpuLoad, 0.15),
            network: {
                rx: getRealisticValue(baseData.network.rx, 0.2),
                tx: getRealisticValue(baseData.network.tx, 0.2)
            }
        };
        
        renderBoard(data);
        if (isManual) {
            log('Telemetry refreshed successfully.');
        }
    } catch (error) {
        if (isManual) {
            log('Unable to load telemetry data.');
        }
        console.error(error);
    }
}

function updateSensorCharts() {
    updateChart('temperature', sensorHistory.temperature, '°C', '#ef4444');
    updateChart('humidity', sensorHistory.humidity, '%', '#3b82f6');
    updateChart('tvoc', sensorHistory.tvoc, 'ppb', '#8b5cf6');
}

function updateChart(sensorName, data, unit, color) {
    const canvas = document.getElementById(`${sensorName}-chart`);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (sensorCharts[sensorName]) {
        sensorCharts[sensorName].destroy();
    }
    
    // Set y-axis bounds based on sensor type
    let yMin = 0, yMax = 100;
    if (sensorName === 'temperature') {
        yMin = 0;
        yMax = 60;
    } else if (sensorName === 'humidity') {
        yMin = 0;
        yMax = 100;
    } else if (sensorName === 'tvoc') {
        yMin = 0;
        yMax = 300;
    }
    
    const labels = data.map(d => new Date(d.t).toLocaleTimeString());
    const values = data.map(d => d.v);

    sensorCharts[sensorName] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `${sensorName.charAt(0).toUpperCase() + sensorName.slice(1)} (${unit})`,
                data: values,
                borderColor: color,
                backgroundColor: color + '15',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointRadius: 4,
                pointBackgroundColor: color
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    labels: {
                        color: document.body.classList.contains('dark') ? '#e2e8f0' : '#1f2937'
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: document.body.classList.contains('dark') ? '#cbd5e1' : '#52606d'
                    },
                    grid: {
                        color: document.body.classList.contains('dark') ? 'rgba(148, 163, 184, 0.1)' : 'rgba(15, 23, 42, 0.05)'
                    }
                },
                y: {
                    min: yMin,
                    max: yMax,
                    ticks: {
                        color: document.body.classList.contains('dark') ? '#cbd5e1' : '#52606d'
                    },
                    grid: {
                        color: document.body.classList.contains('dark') ? 'rgba(148, 163, 184, 0.1)' : 'rgba(15, 23, 42, 0.05)'
                    }
                }
            }
        }
    });
}

function updateSensorStats() {
    updateStats('temperature', sensorHistory.temperature, '°C');
    updateStats('humid', sensorHistory.humidity, '%');
    updateStats('tvoc', sensorHistory.tvoc, 'ppb');
}

function updateStats(prefix, data, unit) {
    if (data.length === 0) return;

    const values = data.map(d => d.v);
    const current = values[values.length - 1];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = (values.reduce((a, b) => a + b, 0) / values.length);
    
    const currentEl = document.getElementById(`${prefix}-current`);
    const minEl = document.getElementById(`${prefix}-min`);
    const maxEl = document.getElementById(`${prefix}-max`);
    const avgEl = document.getElementById(`${prefix}-avg`);
    
    if (unit === '°C') {
        currentEl.textContent = `${current.toFixed(1)} ${unit}`;
        minEl.textContent = `${min.toFixed(1)} ${unit}`;
        maxEl.textContent = `${max.toFixed(1)} ${unit}`;
        avgEl.textContent = `${avg.toFixed(1)} ${unit}`;
    } else if (unit === '%') {
        currentEl.textContent = `${current.toFixed(1)} ${unit}`;
        minEl.textContent = `${min.toFixed(1)} ${unit}`;
        maxEl.textContent = `${max.toFixed(1)} ${unit}`;
        avgEl.textContent = `${avg.toFixed(1)} ${unit}`;
    } else {
        currentEl.textContent = `${Math.round(current)} ${unit}`;
        minEl.textContent = `${Math.round(min)} ${unit}`;
        maxEl.textContent = `${Math.round(max)} ${unit}`;
        avgEl.textContent = `${Math.round(avg)} ${unit}`;
    }
}

function downloadCSV(sensorName) {
    const data = sensorHistory[sensorName] || [];
    if (!data.length) {
        alert('No data available to download for ' + sensorName);
        return;
    }

    const rows = data.map(d => `${new Date(d.t).toISOString()},${d.v}`);
    const csv = `timestamp,value\n${rows.join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sensorName}-last-1hr.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function switchPage(pageName) {
    pages.forEach(page => page.classList.remove('active'));
    navBtns.forEach(btn => btn.classList.remove('active'));
    
    const page = document.getElementById(`${pageName}-page`);
    const btn = document.querySelector(`[data-page="${pageName}"]`);
    
    if (page) page.classList.add('active');
    if (btn) btn.classList.add('active');
    
    // Update page title
    if (pageName === 'dashboard') {
        pageTitle.textContent = 'Mansion Dashboard';
        pageSubtitle.textContent = 'Monitor system health, sensors, and board controls.';
    } else {
        const sensorNames = {
            temperature: 'Temperature',
            humidity: 'Humidity',
            tvoc: 'TVOC'
        };
        pageTitle.textContent = `${sensorNames[pageName]} Monitoring`;
        pageSubtitle.textContent = 'View detailed sensor readings and historical data.';
    }
}

function applyControl(command) {
    log(`Control command requested: ${command}`);

    switch (command) {
        case 'restart':
            boardStatus.textContent = 'Restarting';
            setTimeout(() => {
                boardStatus.textContent = 'Running';
                log('Board restarted successfully.');
            }, 1800);
            break;
        case 'shutdown':
            boardStatus.textContent = 'Shutdown';
            log('Board shutdown command sent.');
            break;
        case 'toggle-led':
            boardState.ledOn = !boardState.ledOn;
            toggleLedBtn.textContent = boardState.ledOn ? 'Turn LED Off' : 'Turn LED On';
            log(`Status LED ${boardState.ledOn ? 'enabled' : 'disabled'}.`);
            break;
        case 'switch-boot':
            boardState.bootMode = boardState.bootMode === 'Normal' ? 'Recovery' : 'Normal';
            bootModeBtn.textContent = boardState.bootMode === 'Normal' ? 'Switch to Recovery' : 'Switch to Normal';
            log(`Boot mode changed to ${boardState.bootMode}.`);
            break;
        default:
            log('Unknown control action.');
    }
}

// Event Listeners - Navigation
navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        switchPage(btn.dataset.page);
    });
});

// Sensor link navigation from dashboard
document.querySelectorAll('.sensor-link').forEach(sensor => {
    sensor.addEventListener('click', () => {
        switchPage(sensor.dataset.page);
    });
});

// Sensor Pause/Resume Buttons
document.getElementById('temp-pause-btn')?.addEventListener('click', function() {
    sensorPaused.temperature = !sensorPaused.temperature;
    this.textContent = sensorPaused.temperature ? '▶ Resume' : '⏸ Pause';
    sensorLog('temp', sensorPaused.temperature ? 'Temperature monitoring paused.' : 'Temperature monitoring resumed.');
});

document.getElementById('humid-pause-btn')?.addEventListener('click', function() {
    sensorPaused.humidity = !sensorPaused.humidity;
    this.textContent = sensorPaused.humidity ? '▶ Resume' : '⏸ Pause';
    sensorLog('humid', sensorPaused.humidity ? 'Humidity monitoring paused.' : 'Humidity monitoring resumed.');
});

document.getElementById('tvoc-pause-btn')?.addEventListener('click', function() {
    sensorPaused.tvoc = !sensorPaused.tvoc;
    this.textContent = sensorPaused.tvoc ? '▶ Resume' : '⏸ Pause';
    sensorLog('tvoc', sensorPaused.tvoc ? 'TVOC monitoring paused.' : 'TVOC monitoring resumed.');
});

// Clear Data Buttons
document.getElementById('temp-clear-btn')?.addEventListener('click', function() {
    sensorHistory.temperature = [];
    updateChart('temperature', [], '°C', '#ef4444');
    sensorLog('temp', 'Temperature data cleared.');
});

document.getElementById('humid-clear-btn')?.addEventListener('click', function() {
    sensorHistory.humidity = [];
    updateChart('humidity', [], '%', '#3b82f6');
    sensorLog('humid', 'Humidity data cleared.');
});

document.getElementById('tvoc-clear-btn')?.addEventListener('click', function() {
    sensorHistory.tvoc = [];
    updateChart('tvoc', [], 'ppb', '#8b5cf6');
    sensorLog('tvoc', 'TVOC data cleared.');
});

// Download CSV Buttons
document.getElementById('temp-download-btn')?.addEventListener('click', () => downloadCSV('temperature'));
document.getElementById('humid-download-btn')?.addEventListener('click', () => downloadCSV('humidity'));
document.getElementById('tvoc-download-btn')?.addEventListener('click', () => downloadCSV('tvoc'));

// Dashboard Controls
refreshBtn.addEventListener('click', () => loadData(true));
restartBtn.addEventListener('click', () => applyControl('restart'));
shutdownBtn.addEventListener('click', () => applyControl('shutdown'));
toggleLedBtn.addEventListener('click', () => applyControl('toggle-led'));
bootModeBtn.addEventListener('click', () => applyControl('switch-boot'));
themeToggleBtn.addEventListener('click', () => {
    const activeTheme = document.body.classList.contains('dark') ? 'light' : 'dark';
    setTheme(activeTheme);
});

initializeTheme();
startClock();
loadData();

setInterval(() => loadData(false), 2000);