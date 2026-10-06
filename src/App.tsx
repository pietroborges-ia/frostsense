/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Clock,
  Volume2,
  VolumeX,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  Wifi,
  Activity,
} from 'lucide-react';
import { frostAudio } from './utils/audio';

type TempTrend = 'stable' | 'up' | 'down';

interface TelemetryData {
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
}

export default function App() {
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    device_id: 'ESP32-FROSTSENSE-01',
    temperature: 3.2,
    max_temp_24h: 4.8,
    min_temp_24h: 1.6,
    avg_temp_24h: 3.1,
    wifi_rssi: -58,
    wifi_signal_pct: 88,
    ip_address: '192.168.1.145',
    uptime_seconds: 1232540,
    power_source: 'USB 5V',
    timestamp: new Date().toISOString(),
  });

  const [trend, setTrend] = useState<TempTrend>('stable');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('19:01');
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);

  // Temporizador de Alerta de Perigo Térmico (> 5.0°C por mais de 5 minutos = 300s)
  const [secondsAboveLimit, setSecondsAboveLimit] = useState<number>(0);
  const HAZARD_TEMP_THRESHOLD_SEC = 300;
  const isTempHazard = secondsAboveLimit >= HAZARD_TEMP_THRESHOLD_SEC;

  // Lógica Dinâmica do Status:
  // Se > 5.0°C ou < 1.0°C -> "⚠️ Alerta de Temperatura" em tom vermelho/laranja
  // Se entre 1.0°C e 5.0°C -> "Temperatura Ideal" em tom verde
  const isOutOfRange = telemetry.temperature > 5.0 || telemetry.temperature < 1.0;

  const statusConfig = isOutOfRange
    ? {
        label: '⚠️ Alerta de Temperatura',
        desc:
          telemetry.temperature > 5.0
            ? 'Temperatura elevada · Risco de deterioração de alimentos'
            : 'Temperatura muito baixa · Risco de congelamento',
        badgeClass:
          'bg-rose-50/95 text-rose-800 border-rose-300 shadow-[0_2px_14px_rgba(244,63,94,0.18)]',
        dotClass: 'bg-rose-500 shadow-[0_0_8px_#f43f5e]',
        gradientText:
          telemetry.temperature > 5.0
            ? 'from-amber-600 via-orange-600 to-rose-600'
            : 'from-indigo-700 via-sky-600 to-cyan-600',
        pointerBg: '#E11D48',
        borderTint: 'border-rose-300',
        icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />,
      }
    : {
        label: 'Temperatura Ideal',
        desc: 'Conservação segura · Alimentos protegidos',
        badgeClass:
          'bg-emerald-50/90 text-emerald-800 border-emerald-200/90 shadow-[0_2px_10px_rgba(16,185,129,0.12)]',
        dotClass: 'bg-emerald-500 shadow-[0_0_8px_#10b981]',
        gradientText: 'from-slate-900 via-slate-800 to-sky-950',
        pointerBg: '#059669',
        borderTint: 'border-emerald-200/60',
        icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />,
      };

  // Badge Elegante e Discreto de Tendência (ex: [→ Estável], [↗ Subindo], [↘ Descendo])
  const trendConfig = {
    stable: {
      symbol: '→',
      label: 'Estável',
      badgeClass: 'bg-slate-100/90 text-slate-600 border-slate-200/80',
    },
    up: {
      symbol: '↗',
      label: 'Subindo',
      badgeClass: 'bg-orange-50 text-orange-700 border-orange-200/80',
    },
    down: {
      symbol: '↘',
      label: 'Descendo',
      badgeClass: 'bg-sky-50 text-sky-700 border-sky-200/80',
    },
  }[trend];

  const formatCurrentTime = () => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  };

  const formatDuration = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Cronômetro para condição de risco térmico
  useEffect(() => {
    const interval = setInterval(() => {
      if (telemetry.temperature > 5.0) {
        setSecondsAboveLimit((prev) => {
          const next = prev + 1;
          if (next === HAZARD_TEMP_THRESHOLD_SEC && audioEnabled) {
            frostAudio.playHazardWarning('temp_danger');
          }
          return next;
        });
      } else {
        setSecondsAboveLimit(0);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [telemetry.temperature, audioEnabled]);

  // Consulta periódica ao backend
  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const res = await fetch('/api/telemetry');
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data.temperature === 'number') {
            const newTemp = data.temperature;
            setTrend((prevTrend) => {
              const diff = newTemp - telemetry.temperature;
              if (diff > 0.08) return 'up';
              if (diff < -0.08) return 'down';
              return prevTrend;
            });
            setTelemetry((prev) => ({
              ...prev,
              ...data,
            }));
            setLastSyncTime(formatCurrentTime());
          }
        }
      } catch {
        // Fallback offline silencioso
      }
    };

    fetchTelemetry();
    const pollInterval = setInterval(fetchTelemetry, 10000);
    return () => clearInterval(pollInterval);
  }, [telemetry.temperature]);

  // Atualização manual
  const handleRefreshTelemetry = async () => {
    setIsRefreshing(true);
    frostAudio.playClick(isOutOfRange ? 'warm' : 'ideal');
    try {
      const res = await fetch('/api/telemetry');
      if (res.ok) {
        const data = await res.json();
        setTelemetry((prev) => ({ ...prev, ...data }));
      } else {
        const deltaTemp = Math.random() * 0.4 - 0.2;
        const nextTemp = Math.round((telemetry.temperature + deltaTemp) * 10) / 10;
        if (deltaTemp > 0.05) setTrend('up');
        else if (deltaTemp < -0.05) setTrend('down');
        else setTrend('stable');

        setTelemetry((prev) => {
          const newMax = Math.max(prev.max_temp_24h, nextTemp);
          const newMin = Math.min(prev.min_temp_24h, nextTemp);
          const newAvg = Math.round(((newMax + newMin) / 2) * 10) / 10;
          return {
            ...prev,
            temperature: nextTemp,
            max_temp_24h: newMax,
            min_temp_24h: newMin,
            avg_temp_24h: newAvg,
          };
        });
      }
      setLastSyncTime(formatCurrentTime());
    } catch {
      setLastSyncTime(formatCurrentTime());
    } finally {
      setIsRefreshing(false);
    }
  };

  // Simulação rápida para testes
  const simulateScenario = async (temp: number, simulatedTrend: TempTrend = 'stable', durationTempSec = 0) => {
    try {
      await fetch('/api/telemetry/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ temperature: temp }),
      });
    } catch {
      // offline fallback
    }

    setTrend(simulatedTrend);
    setTelemetry((prev) => {
      const newMax = Math.max(prev.max_temp_24h, temp);
      const newMin = Math.min(prev.min_temp_24h, temp);
      const newAvg = Math.round(((newMax + newMin) / 2) * 10) / 10;
      return {
        ...prev,
        temperature: temp,
        max_temp_24h: newMax,
        min_temp_24h: newMin,
        avg_temp_24h: newAvg,
      };
    });
    setSecondsAboveLimit(durationTempSec);
    frostAudio.playClick(temp > 5.0 || temp < 1.0 ? 'warm' : 'ideal');
    setLastSyncTime(formatCurrentTime());
  };

  // Cálculo da porcentagem na régua (-4.0°C a 10.0°C)
  const minScale = -4;
  const maxScale = 10;
  const clampedPercent = Math.max(0, Math.min(100, ((telemetry.temperature - minScale) / (maxScale - minScale)) * 100));

  // Dimensões da Onda Fluida SVG e Orbe de Luz
  const waveWidth = 500;
  const waveHeight = 90;
  const orbX = 35 + (clampedPercent / 100) * (waveWidth - 70);

  // Função que calcula a crista da onda no ponto x:
  // A onda flui suavemente e sua crista atinge o pico principal exatamente onde o orbe está posicionado
  const getWaveY = (x: number) => {
    const base = 57;
    const flow = 6 * Math.sin((x / waveWidth) * Math.PI * 2.2 - 0.4);
    const dist = x - orbX;
    const peakHeight = 27; // Elevação da crista na temperatura atual
    const peakSpread = 48; // Abertura suave e contínua
    const crest = peakHeight * Math.exp(-(dist * dist) / (2 * peakSpread * peakSpread));
    return base - flow - crest;
  };

  const orbY = getWaveY(orbX);

  // Geração de pontos da curva da onda
  const numPoints = 50;
  const wavePoints: [number, number][] = [];
  for (let i = 0; i <= numPoints; i++) {
    const x = (i / numPoints) * waveWidth;
    wavePoints.push([x, getWaveY(x)]);
  }

  const wavePathD = wavePoints.reduce((acc, [x, y], idx) => {
    return idx === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : `${acc} L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }, '');

  const waveAreaD = `${wavePathD} L ${waveWidth} ${waveHeight} L 0 ${waveHeight} Z`;

  // Configuração do Orbe de Luz (cor, brilho e pulso térmico)
  const orbConfig = telemetry.temperature < 1.0
    ? {
        color: '#0284C7',
        glowColor: '#38BDF8',
        pulseHalo: 'rgba(56, 189, 248, 0.5)',
        label: 'Muito Frio',
      }
    : telemetry.temperature > 5.0
    ? {
        color: '#EA580C',
        glowColor: '#FB923C',
        pulseHalo: 'rgba(251, 146, 60, 0.5)',
        label: 'Muito Quente',
      }
    : {
        color: '#059669',
        glowColor: '#34D399',
        pulseHalo: 'rgba(52, 211, 153, 0.5)',
        label: 'Ideal',
      };

  return (
    <div className="relative min-h-screen bg-[#F4F8FC] text-slate-800 flex flex-col justify-between py-10 px-4 sm:px-8 antialiased selection:bg-sky-500/20 selection:text-sky-900 overflow-x-hidden">
      
      {/* 1. FUNDO AURORA MESH GRADIENT (Orgânico e Limpo) */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-32 -left-20 w-[650px] h-[650px] rounded-full bg-gradient-to-br from-[#EBF4FF] via-[#E0F2FE]/50 to-transparent blur-[140px]" />
        <div className="absolute top-1/4 right-0 w-[580px] h-[580px] rounded-full bg-gradient-to-bl from-[#E0F7FA]/60 via-[#E1F5FE]/40 to-transparent blur-[150px]" />
        <div className="absolute -bottom-40 left-1/3 w-[700px] h-[550px] rounded-full bg-gradient-to-tr from-[#F0FDF4]/40 via-[#F8FAFC]/80 to-transparent blur-[160px]" />
      </div>

      {/* Conteúdo Central em Cristal Fosco com amplo respiro visual */}
      <div className="relative z-10 max-w-2xl mx-auto w-full space-y-6 sm:space-y-7">
        
        {/* CABEÇALHO: Presença Forte na Marca + Subtítulo Discreto */}
        <header className="flex items-center justify-between gap-4 pb-3.5 border-b border-sky-100/70">
          <div className="flex items-center gap-3">
            {/* Emblema da Marca */}
            <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-tr from-sky-500 via-cyan-400 to-teal-400 p-[1.5px] shadow-[0_4px_16px_rgba(6,182,212,0.22)] shrink-0">
              <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <line x1="12" y1="2.5" x2="12" y2="21.5" stroke="#0284C7" strokeWidth="2.2" strokeLinecap="round" />
                  <line x1="3.8" y1="7.2" x2="20.2" y2="16.8" stroke="#0284C7" strokeWidth="2.2" strokeLinecap="round" />
                  <line x1="3.8" y1="16.8" x2="20.2" y2="7.2" stroke="#0284C7" strokeWidth="2.2" strokeLinecap="round" />
                  <path d="M9.5 4.5 L12 2.5 L14.5 4.5" stroke="#06B6D4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M9.5 19.5 L12 21.5 L14.5 19.5" stroke="#06B6D4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="12" r="2.2" fill="#0EA5E9" />
                </svg>
              </div>
            </div>

            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight leading-none text-slate-900">
                Frost<span className="bg-gradient-to-r from-sky-600 via-cyan-600 to-teal-500 bg-clip-text text-transparent">Sense</span>
              </h1>
              <p className="text-xs text-slate-500 mt-1 font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Monitoramento em tempo real
              </p>
            </div>
          </div>

          {/* Ações Rápidas Compactas */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAudioEnabled(!audioEnabled)}
              className="crystal-btn p-2 rounded-xl text-slate-600 hover:text-slate-900 cursor-pointer"
              title={audioEnabled ? 'Alarmes sonoros ativados' : 'Alarmes sonoros silenciados'}
            >
              {audioEnabled ? (
                <Volume2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-400" />
              )}
            </button>

            <button
              onClick={handleRefreshTelemetry}
              disabled={isRefreshing}
              className="crystal-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-950 cursor-pointer disabled:opacity-50"
              title="Atualizar leitura"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-sky-700 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>
        </header>

        {/* 2. ALERTA CRÍTICO SE HOUVER RISCO DE DETERIORAÇÃO (> 5 min acima de 5°C) */}
        {isTempHazard && (
          <div className="rounded-3xl bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 text-white p-5 shadow-lg shadow-rose-500/20 flex items-start gap-3.5 animate-pulse">
            <div className="p-2 bg-white/20 rounded-xl shrink-0 mt-0.5">
              <Flame className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="font-bold text-sm uppercase tracking-wide">
                  Alerta: Temperatura Elevada Prolongada
                </h3>
                <span className="font-mono text-xs bg-white/25 px-2 py-0.5 rounded-full font-bold">
                  {formatDuration(secondsAboveLimit)} acima de 5°C
                </span>
              </div>
              <p className="text-xs text-rose-100 mt-1 leading-relaxed font-normal">
                A geladeira está acima da temperatura segura há mais de 5 minutos. Verifique o fechamento da porta para proteger os alimentos.
              </p>
            </div>
          </div>
        )}

        {/* 3. CARD PRINCIPAL DE TEMPERATURA (Elemento com Maior Hierarquia e Foco Visual) */}
        <section className={`crystal-plate rounded-3xl p-6 sm:p-8 relative overflow-hidden ${statusConfig.borderTint}`}>
          <div className="absolute top-0 inset-x-8 h-[2px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />

          {/* Topo do Card Principal: Título Forte (16–18px, Peso 700) + Badge de Status */}
          <div className="flex items-center justify-between gap-3 pb-5 border-b border-slate-100/90">
            <h2 className="text-base sm:text-[17px] font-bold text-slate-900 tracking-tight">
              Temperatura da Geladeira
            </h2>

            {/* Badge de Status Dinâmico */}
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold tracking-wide transition-all duration-300 ${statusConfig.badgeClass}`}>
              <span className={`w-2 h-2 rounded-full ${statusConfig.dotClass} animate-pulse`} />
              {statusConfig.icon}
              <span>{statusConfig.label}</span>
            </div>
          </div>

          {/* Destaque Numérico Central: Herói Visual da Página (64–72px, Peso 700/800) */}
          <div className="py-7 sm:py-9 flex flex-col items-center justify-center text-center">
            <div className="flex items-center justify-center gap-3.5 flex-wrap">
              <div className="flex items-baseline justify-center gap-1.5">
                <span
                  className="text-6xl sm:text-7xl font-extrabold tracking-tight text-slate-900 font-mono tabular-nums leading-none select-all"
                  style={{ textShadow: '0 2px 10px rgba(15, 23, 42, 0.04)' }}
                >
                  {telemetry.temperature > 0 ? `+${telemetry.temperature.toFixed(1)}` : telemetry.temperature.toFixed(1)}
                </span>
                <span className="text-3xl sm:text-4xl font-semibold text-slate-400 font-sans tracking-normal select-none">
                  °C
                </span>
              </div>

              {/* Badge Elegante e Discreto de Tendência ao lado: +3.2°C [→ Estável] */}
              <div
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all duration-300 shadow-2xs ${trendConfig.badgeClass}`}
                title={`Tendência da temperatura: ${trendConfig.label}`}
              >
                <span className="text-xs font-bold leading-none">{trendConfig.symbol}</span>
                <span>{trendConfig.label}</span>
              </div>
            </div>

            {/* Texto Secundário Informativo (13–14px, Menor Destaque, Peso 400/500) */}
            <p className="text-[13px] sm:text-sm text-slate-500 mt-2.5 font-medium">
              {statusConfig.desc}
            </p>
          </div>

          {/* Indicador de Onda Suave e Orbe de Luz Brilhante (Frio -> Quente) */}
          <div className="px-1 sm:px-2 pt-2">
            {/* Contêiner em Vidro com Reflexo Suave */}
            <div className="relative rounded-2xl bg-white/40 backdrop-blur-md border border-white/80 p-2 sm:p-3 shadow-[inset_0_1.5px_3px_rgba(255,255,255,0.9),0_4px_16px_rgba(14,165,233,0.06)] overflow-hidden">
              <svg
                viewBox={`0 0 ${waveWidth} ${waveHeight}`}
                className="w-full h-auto overflow-visible select-none"
                style={{ maxHeight: '110px' }}
              >
                <defs>
                  {/* Gradiente da linha da onda (Frio -> Ideal -> Quente) */}
                  <linearGradient id="waveLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#38BDF8" />
                    <stop offset="35%" stopColor="#0EA5E9" />
                    <stop offset="52%" stopColor="#10B981" />
                    <stop offset="70%" stopColor="#F59E0B" />
                    <stop offset="100%" stopColor="#EF4444" />
                  </linearGradient>

                  {/* Gradiente da área translúcida abaixo da onda */}
                  <linearGradient id="waveFillGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={orbConfig.glowColor} stopOpacity="0.22" />
                    <stop offset="60%" stopColor="#38BDF8" stopOpacity="0.06" />
                    <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0.0" />
                  </linearGradient>

                  {/* Filtro de brilho suave para o orbe de luz */}
                  <filter id="orbBloom" x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur stdDeviation="5" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Preenchimento de profundidade abaixo da onda */}
                <path
                  d={waveAreaD}
                  fill="url(#waveFillGradient)"
                  className="transition-all duration-700 ease-out"
                />

                {/* Marcadores Verticais Sutis de Faixa Segura (1°C e 5°C) */}
                {(() => {
                  const safeMinX = 35 + ((1.0 - minScale) / (maxScale - minScale)) * (waveWidth - 70);
                  const safeMaxX = 35 + ((5.0 - minScale) / (maxScale - minScale)) * (waveWidth - 70);
                  return (
                    <g opacity="0.35">
                      <line
                        x1={safeMinX}
                        y1={getWaveY(safeMinX)}
                        x2={safeMinX}
                        y2={waveHeight - 8}
                        stroke="#0EA5E9"
                        strokeWidth="1.5"
                        strokeDasharray="2 3"
                      />
                      <line
                        x1={safeMaxX}
                        y1={getWaveY(safeMaxX)}
                        x2={safeMaxX}
                        y2={waveHeight - 8}
                        stroke="#F59E0B"
                        strokeWidth="1.5"
                        strokeDasharray="2 3"
                      />
                    </g>
                  );
                })()}

                {/* Linha da Onda: Camada de Brilho Difuso (Glow) */}
                <path
                  d={wavePathD}
                  fill="none"
                  stroke="url(#waveLineGradient)"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.32"
                  className="transition-all duration-700 ease-out"
                />

                {/* Linha da Onda: Traço Principal Fluido e Nítido */}
                <path
                  d={wavePathD}
                  fill="none"
                  stroke="url(#waveLineGradient)"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-all duration-700 ease-out"
                />

                {/* Orbe de Luz Brilhante que segue a crista da onda */}
                <g className="transition-all duration-700 ease-out">
                  {/* 1. Halo de radiação luminosa externa pulsante */}
                  <circle
                    cx={orbX}
                    cy={orbY}
                    r="20"
                    fill={orbConfig.pulseHalo}
                    filter="url(#orbBloom)"
                    className="animate-pulse"
                  />

                  {/* 2. Aura de cor saturada intermediária */}
                  <circle
                    cx={orbX}
                    cy={orbY}
                    r="12"
                    fill={orbConfig.glowColor}
                    opacity="0.6"
                  />

                  {/* 3. Corpo de luz circular branco/cerâmico */}
                  <circle
                    cx={orbX}
                    cy={orbY}
                    r="8"
                    fill="#FFFFFF"
                    stroke={orbConfig.color}
                    strokeWidth="2"
                    filter="drop-shadow(0px 2px 6px rgba(0,0,0,0.22))"
                  />

                  {/* 4. Núcleo de luz central de alta intensidade */}
                  <circle
                    cx={orbX}
                    cy={orbY}
                    r="3.5"
                    fill={orbConfig.color}
                  />

                  {/* 5. Ponto de reflexo especular superior */}
                  <circle
                    cx={orbX - 1.5}
                    cy={orbY - 1.5}
                    r="1.2"
                    fill="#FFFFFF"
                    opacity="0.95"
                  />
                </g>
              </svg>
            </div>

            {/* Rótulos Visuais Perfeitamente Alinhados abaixo da régua */}
            <div className="grid grid-cols-3 items-center text-xs mt-3.5 px-1">
              {/* Muito Frio */}
              <div className="flex flex-col items-start">
                <span className="font-semibold text-sky-800 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                  Muito Frio
                </span>
                <span className="text-[10px] font-mono text-slate-400 mt-0.5">
                  &lt; 1.0°C
                </span>
              </div>

              {/* Ideal (Pílula em Destaque Central) */}
              <div className="flex flex-col items-center">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-bold text-xs shadow-2xs tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Ideal
                </span>
                <span className="text-[10px] font-mono text-emerald-700/80 mt-0.5 font-semibold">
                  1.0°C – 5.0°C
                </span>
              </div>

              {/* Muito Quente */}
              <div className="flex flex-col items-end">
                <span className="font-semibold text-amber-800 flex items-center gap-1">
                  Muito Quente
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                </span>
                <span className="text-[10px] font-mono text-slate-400 mt-0.5">
                  &gt; 5.0°C
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 4. DOIS CARDS SECUNDÁRIOS: Histórico e Conectividade */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          
          {/* Card 1: Histórico de temperatura com badge discreto '24h' */}
          <div className="crystal-plate rounded-3xl p-5 sm:p-6 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  Histórico de temperatura
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/80">
                  24h
                </span>
              </div>
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-100 to-sky-50 border border-indigo-100/80 flex items-center justify-center text-sky-700 shadow-2xs">
                <Activity className="w-4 h-4" />
              </div>
            </div>

            {/* Números com Hierarquia Clara: Valor numérico maior e com maior peso que o rótulo */}
            <div className="grid grid-cols-3 gap-2 py-1">
              {/* Máxima */}
              <div className="flex flex-col">
                <span className="text-[11px] sm:text-xs font-medium text-slate-500 flex items-center gap-1 mb-1">
                  <ArrowUpRight className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                  Máxima
                </span>
                <span className="text-xl sm:text-2xl font-bold font-mono text-orange-600 tracking-tight">
                  +{telemetry.max_temp_24h.toFixed(1)}°C
                </span>
              </div>

              {/* Mínima */}
              <div className="flex flex-col border-l border-slate-100 pl-3">
                <span className="text-[11px] sm:text-xs font-medium text-slate-500 flex items-center gap-1 mb-1">
                  <ArrowDownRight className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  Mínima
                </span>
                <span className="text-xl sm:text-2xl font-bold font-mono text-sky-600 tracking-tight">
                  +{telemetry.min_temp_24h.toFixed(1)}°C
                </span>
              </div>

              {/* Média */}
              <div className="flex flex-col border-l border-slate-100 pl-3">
                <span className="text-[11px] sm:text-xs font-medium text-slate-500 flex items-center gap-1.5 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  Média
                </span>
                <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-700 tracking-tight">
                  +{telemetry.avg_temp_24h.toFixed(1)}°C
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Conectividade (Título simples, Online em destaque e horário secundário) */}
          <div className="crystal-plate rounded-3xl p-5 sm:p-6 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Conectividade
              </h3>
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-50 border border-emerald-100/80 flex items-center justify-center text-emerald-600 shadow-2xs">
                <Wifi className="w-4 h-4" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 py-1">
              {/* Status Online com bastante destaque e porcentagem */}
              <div className="flex flex-col">
                <span className="text-[11px] sm:text-xs font-medium text-slate-500 flex items-center gap-1.5 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Sinal Wi-Fi
                </span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    Online
                  </span>
                  <span className="text-sm sm:text-base font-bold text-emerald-600">
                    · {telemetry.wifi_signal_pct}%
                  </span>
                </div>
              </div>

              {/* Horário de Sincronização menor e secundário */}
              <div className="flex flex-col border-l border-slate-100 pl-4">
                <span className="text-[11px] sm:text-xs font-medium text-slate-500 flex items-center gap-1 mb-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Sincronização
                </span>
                <span className="text-sm sm:text-base font-semibold font-mono text-slate-700 tracking-tight mt-1">
                  Atualizado às {lastSyncTime}
                </span>
              </div>
            </div>
          </div>

        </section>

        {/* 5. SIMULAÇÃO RÁPIDA (Discreta e Opcional para Testes) */}
        <div className="pt-1 flex items-center justify-center gap-2 text-xs flex-wrap">
          <span className="text-slate-500 font-medium">Testar leitura:</span>
          <button
            onClick={() => simulateScenario(3.2, 'stable', 0)}
            className="px-2.5 py-1 rounded-lg bg-white/80 hover:bg-white text-slate-700 font-semibold border border-slate-200/80 transition-all cursor-pointer shadow-2xs"
          >
            Ideal (3.2°C →)
          </button>
          <button
            onClick={() => simulateScenario(0.4, 'down', 0)}
            className="px-2.5 py-1 rounded-lg bg-white/80 hover:bg-white text-sky-800 font-semibold border border-sky-200/80 transition-all cursor-pointer shadow-2xs"
            title="Testa alarme de temperatura muito fria (< 1.0°C)"
          >
            Frio (0.4°C ↘)
          </button>
          <button
            onClick={() => simulateScenario(6.8, 'up', 305)}
            className="px-2.5 py-1 rounded-lg bg-white/80 hover:bg-white text-rose-800 font-semibold border border-rose-200/80 transition-all cursor-pointer shadow-2xs"
            title="Testa alarme de temperatura quente (> 5.0°C)"
          >
            Quente (6.8°C ↗)
          </button>
        </div>

        {/* Rodapé Limpo e Profissional */}
        <footer className="pt-2 text-center text-xs text-slate-400 font-medium">
          FrostSense · Monitoramento Térmico Inteligente
        </footer>

      </div>
    </div>
  );
}
