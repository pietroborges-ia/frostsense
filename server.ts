/**
 * FrostSense IoT Gateway - Telemetry Backend
 * Express server providing REST endpoints for ESP32 and Vite middleware
 */

import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TelemetryPayload {
  device_id: string;
  temperature: number;
  max_temp_24h: number;
  min_temp_24h: number;
  avg_temp_24h: number;
  wifi_rssi: number;
  wifi_signal_pct: number;
  ip_address: string;
  uptime_seconds: number;
  power_source: string;
  timestamp: string;
  duration_above_limit_sec: number;
  temp_hazard_alert: boolean;
}

// In-memory state
let telemetryState: TelemetryPayload = {
  device_id: 'ESP32-FROSTSENSE-01',
  temperature: 3.2,
  max_temp_24h: 4.8,
  min_temp_24h: 1.6,
  avg_temp_24h: 3.1,
  wifi_rssi: -58,
  wifi_signal_pct: 88,
  ip_address: '192.168.1.145',
  uptime_seconds: 1232540,
  power_source: 'USB 5V (Contínua)',
  timestamp: new Date().toISOString(),
  duration_above_limit_sec: 0,
  temp_hazard_alert: false,
};

let lastPacketReceivedAt = Date.now();

// Background timer to track alert thresholds (Temp > 5°C for > 5 min = 300s)
setInterval(() => {
  if (telemetryState.temperature > 5.0) {
    telemetryState.duration_above_limit_sec += 1;
    if (telemetryState.duration_above_limit_sec >= 300) {
      telemetryState.temp_hazard_alert = true;
    }
  } else {
    telemetryState.duration_above_limit_sec = 0;
    telemetryState.temp_hazard_alert = false;
  }
}, 1000);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // REST API: GET latest telemetry for the Dashboard
  app.get('/api/telemetry', (_req: Request, res: Response) => {
    res.json({
      ...telemetryState,
      seconds_since_last_packet: Math.floor((Date.now() - lastPacketReceivedAt) / 1000),
    });
  });

  // REST API: POST telemetry from ESP32
  app.post('/api/telemetry', (req: Request, res: Response) => {
    const data = req.body;

    if (data.temperature !== undefined) {
      const temp = Number(data.temperature);
      telemetryState.temperature = temp;
      // Atualiza máximas e mínimas
      if (temp > telemetryState.max_temp_24h) telemetryState.max_temp_24h = temp;
      if (temp < telemetryState.min_temp_24h) telemetryState.min_temp_24h = temp;
    }
    if (data.wifi_rssi !== undefined) {
      telemetryState.wifi_rssi = Number(data.wifi_rssi);
      telemetryState.wifi_signal_pct = Math.max(0, Math.min(100, Math.round(2 * (Number(data.wifi_rssi) + 100))));
    }
    if (data.ip_address) {
      telemetryState.ip_address = String(data.ip_address);
    }
    if (data.device_id) {
      telemetryState.device_id = String(data.device_id);
    }
    if (data.uptime_seconds !== undefined) {
      telemetryState.uptime_seconds = Number(data.uptime_seconds);
    }

    lastPacketReceivedAt = Date.now();
    telemetryState.timestamp = new Date().toISOString();

    res.status(200).json({
      status: 'acknowledged',
      server_time: telemetryState.timestamp,
      temp_hazard_alert: telemetryState.temp_hazard_alert,
    });
  });

  // REST API: Simulate state change for testing
  app.post('/api/telemetry/simulate', (req: Request, res: Response) => {
    const { temperature, reset_timers } = req.body;
    if (temperature !== undefined) {
      const t = Number(temperature);
      telemetryState.temperature = t;
      if (t > telemetryState.max_temp_24h) telemetryState.max_temp_24h = t;
      if (t < telemetryState.min_temp_24h) telemetryState.min_temp_24h = t;
    }
    if (reset_timers) {
      telemetryState.duration_above_limit_sec = 0;
      telemetryState.temp_hazard_alert = false;
    }
    lastPacketReceivedAt = Date.now();
    telemetryState.timestamp = new Date().toISOString();
    res.json({ success: true, telemetry: telemetryState });
  });

  const isProduction = process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve(__dirname, 'dist'));

  if (isProduction) {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FrostSense Gateway server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start FrostSense server:', err);
  process.exit(1);
});
