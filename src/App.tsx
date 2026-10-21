/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
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
  Server,
} from 'lucide-react';
import { frostAudio } from './utils/audio';
import { SnowParticles } from './components/SnowParticles';

export interface LeituraAPI {
  id: string;
  sensor_id: string;
  temperatura: number;
  unidade: string;
  status_alerta: boolean;
  timestamp: string;
}

type TempTrend = 'stable' | 'up' | 'down';
type ApiStatus = 'connecting' | 'connected' | 'no_data' | 'error';

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

const API_BASE_URL = 'http://localhost:8000';
const SENSOR_ID = 'freezer_01';

export default function App() {
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    device_id: SENSOR_ID,
    temperature: -18.5,
    max_temp_24h: -16.2,
    min_temp_24h: -20.4,
    avg_temp_24h: -18.1,
    wifi_rssi: -58,
    wifi_signal_pct: 88,
    ip_address: '192.168.1.145',
    uptime_seconds: 1232540,
    power_source: 'USB 5V',
    timestamp: new Date().toISOString(),
  });

  const [historyChronological, setHistoryChronological] = useState<LeituraAPI[]>([]);
  const [isAlertActive, setIsAlertActive] = useState<boolean>(false);
  const [apiStatus, setApiStatus] = useState<ApiStatus>('connecting');
  const [trend, setTrend] = useState<TempTrend>('stable');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('--:--');
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);

  // Armazena valor anterior para detectar disparos de alarme
  const prevAlertRef = useRef<boolean>(false);
  const prevTempRef = useRef<number>(telemetry.temperature);

  // Temporizador de Alerta de Perigo Térmico (> 5.0°C ou status_alerta ativo)
  const [secondsAboveLimit, setSecondsAboveLimit] = useState<number>(0);
  const HAZARD_TEMP_THRESHOLD_SEC = 300;
  const isTempHazard = secondsAboveLimit >= HAZARD_TEMP_THRESHOLD_SEC;

  // Formatação de data e hora para fuso pt-BR
  const formatTimestampPtBR = (isoString?: string) => {
    if (!isoString) return '--:--';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '--:--';
      return date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return '--:--';
    }
  };

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

  // Busca dados do Backend FastAPI (/leituras/atual e /leituras/historico)
  const fetchTelemetryFromApi = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);

    try {
      // 1. Busca leitura atual
      const resAtualPromise = fetch(`${API_BASE_URL}/leituras/atual?sensor_id=${SENSOR_ID}`);
      // 2. Busca histórico das últimas 30 leituras
      const resHistPromise = fetch(`${API_BASE_URL}/leituras/historico?sensor_id=${SENSOR_ID}&limite=30`);

      const [resAtual, resHist] = await Promise.all([resAtualPromise, resHistPromise]);

      if (resAtual.status === 404) {
        // Banco vazio ou sem leituras para o sensor
        setApiStatus('no_data');
        setLastSyncTime(formatCurrentTime());
        return;
      }

      if (!resAtual.ok) {
        setApiStatus('error');
        return;
      }

      const atualData: LeituraAPI = await resAtual.json();
      let histData: LeituraAPI[] = [];

      if (resHist.ok) {
        histData = await resHist.json();
      }

      setApiStatus('connected');

      // Calcula tendência comparando com a temperatura anterior
      const prevT = prevTempRef.current;
      const diff = atualData.temperatura - prevT;
      if (diff > 0.05) setTrend('up');
      else if (diff < -0.05) setTrend('down');
      else setTrend('stable');
      prevTempRef.current = atualData.temperatura;

      // Inverte o histórico para cronologia correta: mais antigo na esquerda -> mais recente na direita
      if (histData.length > 0) {
        const chronological = [...histData].reverse();
        setHistoryChronological(chronological);

        // Estatísticas reais de Máxima, Mínima e Média a partir do histórico
        const temps = histData.map((item) => item.temperatura);
        const max = Math.max(...temps);
        const min = Math.min(...temps);
        const avg = Math.round((temps.reduce((acc, curr) => acc + curr, 0) / temps.length) * 10) / 10;

        setTelemetry((prev) => ({
          ...prev,
          device_id: atualData.sensor_id,
          temperature: atualData.temperatura,
          max_temp_24h: max,
          min_temp_24h: min,
          avg_temp_24h: avg,
          timestamp: atualData.timestamp,
        }));
      } else {
        setTelemetry((prev) => ({
          ...prev,
          device_id: atualData.sensor_id,
          temperature: atualData.temperatura,
          timestamp: atualData.timestamp,
        }));
      }

      // Atualiza status de alerta
      setIsAlertActive(Boolean(atualData.status_alerta));
      setLastSyncTime(formatTimestampPtBR(atualData.timestamp));

      // Acionamento sonoro se alerta foi ativado
      if (atualData.status_alerta && !prevAlertRef.current && audioEnabled) {
        frostAudio.playHazardWarning('temp_danger');
      }
      prevAlertRef.current = Boolean(atualData.status_alerta);
    } catch {
      // API Offline - mantém valores de fallback seguros sem quebrar a tela
      setApiStatus('error');
      setLastSyncTime(formatCurrentTime());
    } finally {
      if (isManual) setIsRefreshing(false);
    }
  };

  // Polling automático a cada 5 segundos (5000 ms) + Limpeza no unmount
  useEffect(() => {
    fetchTelemetryFromApi();

    const pollInterval = setInterval(() => {
      fetchTelemetryFromApi();
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [audioEnabled]);

  // Cronômetro para condição de risco térmico
  useEffect(() => {
    const interval = setInterval(() => {
      if (isAlertActive || telemetry.temperature > 5.0) {
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
  }, [isAlertActive, telemetry.temperature, audioEnabled]);

  // Atualização manual pelo botão
  const handleRefreshTelemetry = async () => {
    frostAudio.playClick(isOutOfRange ? 'warm' : 'ideal');
    await fetchTelemetryFromApi(true);
  };

  // Simulação rápida para testes caso API esteja offline
  const simulateScenario = (temp: number, simulatedTrend: TempTrend = 'stable', alert = false) => {
    setTrend(simulatedTrend);
    setIsAlertActive(alert);
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
        timestamp: new Date().toISOString(),
      };
    });
    setLastSyncTime(formatCurrentTime());
    if (alert && audioEnabled) {
      frostAudio.playHazardWarning('temp_danger');
    }
  };

  // Condição de Alerta: definido pela API (status_alerta) ou limites térmicos
  const isOutOfRange = isAlertActive || telemetry.temperature > 5.0 || (telemetry.temperature > 0 && telemetry.temperature < 1.0);

  // Detecta se estamos monitorando freezer (temperatura negativa) para ajustar escala e rótulos
  const isFreezerScale = telemetry.temperature <= 0;
  const minScale = isFreezerScale ? -25 : -4;
  const maxScale = isFreezerScale ? -5 : 10;
  const clampedPercent = Math.max(0, Math.min(100, ((telemetry.temperature - minScale) / (maxScale - minScale)) * 100));

  const statusConfig = isOutOfRange
    ? {
      label: 'Alerta de Temperatura',
      desc: isAlertActive
        ? 'Atenção · Limite térmico ultrapassado no sensor!'
        : telemetry.temperature > 5.0
          ? 'Temperatura elevada · Risco de deterioração de alimentos'
          : 'Temperatura muito baixa · Risco de congelamento',
      badgeClass:
        'bg-rose-50/95 text-rose-800 border-rose-300 shadow-[0_2px_14px_rgba(244,63,94,0.18)]',
      dotClass: 'bg-rose-500 shadow-[0_0_8px_#f43f5e]',
      gradientText: 'from-amber-600 via-orange-600 to-rose-600',
      pointerBg: '#E11D48',
      borderTint: 'border-rose-300',
      icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />,
    }
    : {
      label: 'Temperatura Ideal',
      desc: isFreezerScale
        ? 'Congelamento seguro · Temperatura abaixo do limite'
        : 'Conservação segura · Alimentos protegidos',
      badgeClass:
        'bg-emerald-50/90 text-emerald-800 border-emerald-200/90 shadow-[0_2px_10px_rgba(16,185,129,0.12)]',
      dotClass: 'bg-emerald-500 shadow-[0_0_8px_#10b981]',
      gradientText: 'from-slate-900 via-slate-800 to-sky-950',
      pointerBg: '#059669',
      borderTint: 'border-emerald-200/60',
      icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />,
    };

  // Badge Elegante e Discreto de Tendência
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

  // Dimensões da Onda Fluida SVG e Orbe de Luz
  const waveWidth = 500;
  const waveHeight = 90;
  const orbX = 35 + (clampedPercent / 100) * (waveWidth - 70);

  const getWaveY = (x: number) => {
    const base = 57;
    const flow = 6 * Math.sin((x / waveWidth) * Math.PI * 2.2 - 0.4);
    const dist = x - orbX;
    const peakHeight = 27;
    const peakSpread = 48;
    const crest = peakHeight * Math.exp(-(dist * dist) / (2 * peakSpread * peakSpread));
    return base - flow - crest;
  };

  const orbY = getWaveY(orbX);

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

  // Configuração do Orbe de Luz
  const orbConfig = isOutOfRange
    ? {
      color: '#EA580C',
      glowColor: '#FB923C',
      pulseHalo: 'rgba(251, 146, 60, 0.5)',
      label: 'Alerta',
    }
    : {
      color: '#059669',
      glowColor: '#34D399',
      pulseHalo: 'rgba(52, 211, 153, 0.5)',
      label: 'Ideal',
    };

  return (
    <div className="relative min-h-screen bg-[#F4F8FC] text-slate-800 flex flex-col justify-between py-10 px-4 sm:px-8 antialiased selection:bg-sky-500/20 selection:text-sky-900 overflow-x-hidden">

      {/* Partículas de Neve Interativas mantidas intactas */}
      <SnowParticles temperature={telemetry.temperature} />

      {/* 1. FUNDO AURORA MESH GRADIENT */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-32 -left-20 w-[650px] h-[650px] rounded-full bg-gradient-to-br from-[#EBF4FF] via-[#E0F2FE]/50 to-transparent blur-[140px]" />
        <div className="absolute top-1/4 right-0 w-[580px] h-[580px] rounded-full bg-gradient-to-bl from-[#E0F7FA]/60 via-[#E1F5FE]/40 to-transparent blur-[150px]" />
        <div className="absolute -bottom-40 left-1/3 w-[700px] h-[550px] rounded-full bg-gradient-to-tr from-[#F0FDF4]/40 via-[#F8FAFC]/80 to-transparent blur-[160px]" />
      </div>

      {/* Conteúdo Central */}
      <div className="relative z-10 max-w-2xl mx-auto w-full space-y-6 sm:space-y-7">

        {/* CABEÇALHO */}
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
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      apiStatus === 'connected'
                        ? 'bg-emerald-500 animate-pulse'
                        : apiStatus === 'connecting'
                        ? 'bg-sky-500 animate-spin'
                        : apiStatus === 'no_data'
                        ? 'bg-amber-500'
                        : 'bg-slate-400'
                    }`}
                  />
                  {apiStatus === 'connected'
                    ? `Sensor: ${telemetry.device_id}`
                    : apiStatus === 'connecting'
                    ? 'Conectando à API...'
                    : apiStatus === 'no_data'
                    ? 'Aguardando dados...'
                    : 'Modo Offline'}
                </p>
                <span className="text-[10px] text-slate-400">|</span>
                <span className="text-[10px] font-mono text-slate-500 bg-slate-100/90 px-1.5 py-0.5 rounded border border-slate-200/60">
                  {API_BASE_URL.replace('http://', '')}
                </span>
              </div>
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
              title="Atualizar leitura agora"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-sky-700 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>
        </header>

        {/* 1.1 INDICADOR VISUAL DISCRETO DE STATUS DA API (Tratamento de Erros / Estado Inicial) */}
        {apiStatus === 'connecting' && (
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-sky-50/80 border border-sky-200/70 text-xs text-sky-800 animate-pulse">
            <Server className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            <span>Conectando à API FastAPI em {API_BASE_URL}...</span>
          </div>
        )}

        {apiStatus === 'no_data' && (
          <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-amber-50/90 border border-amber-200/80 text-xs text-amber-900 shadow-2xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Aguardando dados do sensor · O banco está conectado, mas ainda não possui leituras gravadas para "{SENSOR_ID}".</span>
            </div>
            <button
              onClick={() => fetchTelemetryFromApi(true)}
              className="text-[11px] font-bold text-amber-800 underline hover:text-amber-950 shrink-0 cursor-pointer"
            >
              Checar novamente
            </button>
          </div>
        )}

        {apiStatus === 'error' && (
          <div className="flex items-center justify-between gap-2 px-3.5 py-2 rounded-2xl bg-slate-100/90 border border-slate-200/90 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span>API offline em {API_BASE_URL} · Exibindo valores de fallback seguros.</span>
            </div>
            <button
              onClick={() => fetchTelemetryFromApi(true)}
              className="text-[11px] font-bold text-sky-700 underline hover:text-sky-900 shrink-0 cursor-pointer"
            >
              Tentar reconectar
            </button>
          </div>
        )}

        {/* 2. ALERTA CRÍTICO SE HOUVER RISCO TÉRMICO OU STATUS_ALERTA DA API */}
        {(isTempHazard || isAlertActive) && (
          <div className="rounded-3xl bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 text-white p-5 shadow-lg shadow-rose-500/20 flex items-start gap-3.5 animate-pulse">
            <div className="p-2 bg-white/20 rounded-xl shrink-0 mt-0.5">
              <Flame className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="font-bold text-sm uppercase tracking-wide">
                  Alerta: Limite Térmico Violado
                </h3>
                <span className="font-mono text-xs bg-white/25 px-2 py-0.5 rounded-full font-bold">
                  {isAlertActive ? 'Alerta Ativo no Sensor' : `${formatDuration(secondsAboveLimit)} acima do limite`}
                </span>
              </div>
              <p className="text-xs text-rose-100 mt-1 leading-relaxed font-normal">
                {isFreezerScale
                  ? 'A temperatura do freezer ultrapassou o limite seguro recomendado. Verifique o isolamento térmico e a vedação da porta.'
                  : 'A geladeira está acima da temperatura segura. Verifique o fechamento da porta para proteger os alimentos.'}
              </p>
            </div>
          </div>
        )}

        {/* 3. CARD PRINCIPAL DE TEMPERATURA */}
        <section className={`crystal-plate rounded-3xl p-6 sm:p-8 relative overflow-hidden ${statusConfig.borderTint}`}>
          <div className="absolute top-0 inset-x-8 h-[2px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />

          {/* Topo do Card Principal */}
          <div className="flex items-center justify-between gap-3 pb-5 border-b border-slate-100/90">
            <div>
              <h2 className="text-base sm:text-[17px] font-bold text-slate-900 tracking-tight">
                {isFreezerScale ? 'Temperatura do Freezer' : 'Temperatura da Geladeira'}
              </h2>
              <span className="text-[11px] text-slate-400 font-mono">
                Sensor: {telemetry.device_id}
              </span>
            </div>

            {/* Badge de Status Dinâmico */}
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold tracking-wide transition-all duration-300 ${statusConfig.badgeClass}`}>
              <span className={`w-2 h-2 rounded-full ${statusConfig.dotClass} animate-pulse`} />
              {statusConfig.icon}
              <span>{statusConfig.label}</span>
            </div>
          </div>

          {/* Destaque Numérico Central */}
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

              {/* Badge Elegante e Discreto de Tendência */}
              <div
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all duration-300 shadow-2xs ${trendConfig.badgeClass}`}
                title={`Tendência da temperatura: ${trendConfig.label}`}
              >
                <span className="text-xs font-bold leading-none">{trendConfig.symbol}</span>
                <span>{trendConfig.label}</span>
              </div>
            </div>

            {/* Texto Secundário Informativo */}
            <p className="text-[13px] sm:text-sm text-slate-500 mt-2.5 font-medium">
              {statusConfig.desc}
            </p>
          </div>

          {/* Indicador de Onda Suave e Orbe de Luz */}
          <div className="px-1 sm:px-2 pt-2">
            <div className="relative rounded-2xl bg-white/40 backdrop-blur-md border border-white/80 p-2 sm:p-3 shadow-[inset_0_1.5px_3px_rgba(255,255,255,0.9),0_4px_16px_rgba(14,165,233,0.06)] overflow-hidden">
              <svg
                viewBox={`0 0 ${waveWidth} ${waveHeight}`}
                className="w-full h-auto overflow-visible select-none"
                style={{ maxHeight: '110px' }}
              >
                <defs>
                  <linearGradient id="waveLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#38BDF8" />
                    <stop offset="35%" stopColor="#0EA5E9" />
                    <stop offset="52%" stopColor="#10B981" />
                    <stop offset="70%" stopColor="#F59E0B" />
                    <stop offset="100%" stopColor="#EF4444" />
                  </linearGradient>

                  <linearGradient id="waveFillGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={orbConfig.glowColor} stopOpacity="0.22" />
                    <stop offset="60%" stopColor="#38BDF8" stopOpacity="0.06" />
                    <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0.0" />
                  </linearGradient>

                  <filter id="orbBloom" x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur stdDeviation="5" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                <path
                  d={waveAreaD}
                  fill="url(#waveFillGradient)"
                  className="transition-all duration-700 ease-out"
                />

                {/* Marcadores de Faixa Segura */}
                {(() => {
                  const safeMinTarget = isFreezerScale ? -22 : 1.0;
                  const safeMaxTarget = isFreezerScale ? -14 : 5.0;
                  const safeMinX = 35 + ((safeMinTarget - minScale) / (maxScale - minScale)) * (waveWidth - 70);
                  const safeMaxX = 35 + ((safeMaxTarget - minScale) / (maxScale - minScale)) * (waveWidth - 70);
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

                {/* Linha da Onda: Camada de Glow */}
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

                {/* Linha da Onda: Traço Principal */}
                <path
                  d={wavePathD}
                  fill="none"
                  stroke="url(#waveLineGradient)"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-all duration-700 ease-out"
                />

                {/* Orbe de Luz */}
                <g className="transition-all duration-700 ease-out">
                  <circle
                    cx={orbX}
                    cy={orbY}
                    r="20"
                    fill={orbConfig.pulseHalo}
                    filter="url(#orbBloom)"
                    className="animate-pulse"
                  />
                  <circle
                    cx={orbX}
                    cy={orbY}
                    r="12"
                    fill={orbConfig.glowColor}
                    opacity="0.6"
                  />
                  <circle
                    cx={orbX}
                    cy={orbY}
                    r="8"
                    fill="#FFFFFF"
                    stroke={orbConfig.color}
                    strokeWidth="2"
                    filter="drop-shadow(0px 2px 6px rgba(0,0,0,0.22))"
                  />
                  <circle
                    cx={orbX}
                    cy={orbY}
                    r="3.5"
                    fill={orbConfig.color}
                  />
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

            {/* Rótulos da Régua Térmica */}
            <div className="grid grid-cols-3 items-center text-xs mt-3.5 px-1">
              <div className="flex flex-col items-start">
                <span className="font-semibold text-sky-800 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                  {isFreezerScale ? 'Congelador Forte' : 'Muito Frio'}
                </span>
                <span className="text-[10px] font-mono text-slate-400 mt-0.5">
                  {isFreezerScale ? '< -22.0°C' : '< 1.0°C'}
                </span>
              </div>

              <div className="flex flex-col items-center">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-bold text-xs shadow-2xs tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Faixa Ideal
                </span>
                <span className="text-[10px] font-mono text-emerald-700/80 mt-0.5 font-semibold">
                  {isFreezerScale ? '-22°C a -14°C' : '1.0°C – 5.0°C'}
                </span>
              </div>

              <div className="flex flex-col items-end">
                <span className="font-semibold text-amber-800 flex items-center gap-1">
                  {isFreezerScale ? 'Alerta / Quente' : 'Muito Quente'}
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                </span>
                <span className="text-[10px] font-mono text-slate-400 mt-0.5">
                  {isFreezerScale ? '> -12.0°C' : '> 5.0°C'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 4. DOIS CARDS SECUNDÁRIOS: Histórico e Conectividade */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">

          {/* Card 1: Histórico de temperatura com gráfico cronológico */}
          <div className="crystal-plate rounded-3xl p-5 sm:p-6 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    Histórico de temperatura
                  </h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/80">
                    {historyChronological.length > 0 ? `${historyChronological.length} leituras` : '24h'}
                  </span>
                </div>
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-100 to-sky-50 border border-indigo-100/80 flex items-center justify-center text-sky-700 shadow-2xs">
                  <Activity className="w-4 h-4" />
                </div>
              </div>

              {/* Números: Máxima, Mínima, Média */}
              <div className="grid grid-cols-3 gap-2 py-1">
                <div className="flex flex-col">
                  <span className="text-[11px] sm:text-xs font-medium text-slate-500 flex items-center gap-1 mb-1">
                    <ArrowUpRight className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                    Máxima
                  </span>
                  <span className="text-xl sm:text-2xl font-bold font-mono text-orange-600 tracking-tight">
                    {telemetry.max_temp_24h > 0 ? `+${telemetry.max_temp_24h.toFixed(1)}` : telemetry.max_temp_24h.toFixed(1)}°C
                  </span>
                </div>

                <div className="flex flex-col border-l border-slate-100 pl-3">
                  <span className="text-[11px] sm:text-xs font-medium text-slate-500 flex items-center gap-1 mb-1">
                    <ArrowDownRight className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                    Mínima
                  </span>
                  <span className="text-xl sm:text-2xl font-bold font-mono text-sky-600 tracking-tight">
                    {telemetry.min_temp_24h > 0 ? `+${telemetry.min_temp_24h.toFixed(1)}` : telemetry.min_temp_24h.toFixed(1)}°C
                  </span>
                </div>

                <div className="flex flex-col border-l border-slate-100 pl-3">
                  <span className="text-[11px] sm:text-xs font-medium text-slate-500 flex items-center gap-1.5 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    Média
                  </span>
                  <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-700 tracking-tight">
                    {telemetry.avg_temp_24h > 0 ? `+${telemetry.avg_temp_24h.toFixed(1)}` : telemetry.avg_temp_24h.toFixed(1)}°C
                  </span>
                </div>
              </div>
            </div>

            {/* Gráfico de Histórico Cronológico no eixo X (mais antigo à esquerda -> mais recente à direita) */}
            {historyChronological.length > 1 && (
              <div className="mt-4 pt-3.5 border-t border-slate-100/90">
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium mb-1.5">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                    Eixo cronológico (X)
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">
                    {formatTimestampPtBR(historyChronological[0]?.timestamp)} → {formatTimestampPtBR(historyChronological[historyChronological.length - 1]?.timestamp)}
                  </span>
                </div>

                {(() => {
                  const chartW = 280;
                  const chartH = 48;
                  const padding = 6;
                  const temps = historyChronological.map((item) => item.temperatura);
                  const minT = Math.min(...temps);
                  const maxT = Math.max(...temps);
                  const range = maxT - minT || 1;

                  const points = historyChronological.map((item, idx) => {
                    const x = padding + (idx / (historyChronological.length - 1)) * (chartW - padding * 2);
                    const y = chartH - padding - ((item.temperatura - minT) / range) * (chartH - padding * 2);
                    return { x, y, temp: item.temperatura, time: item.timestamp, alert: item.status_alerta };
                  });

                  const pathD = points.reduce((acc, p, idx) => {
                    return idx === 0 ? `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}` : `${acc} L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
                  }, '');

                  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${chartH} L ${points[0].x.toFixed(1)} ${chartH} Z`;

                  return (
                    <div className="relative w-full rounded-xl bg-slate-50/70 border border-slate-100 p-2 overflow-hidden">
                      <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-12 overflow-visible">
                        <defs>
                          <linearGradient id="histGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#0EA5E9" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        <path d={areaD} fill="url(#histGradient)" />
                        <path d={pathD} fill="none" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        {points.map((p, idx) => (
                          <circle
                            key={idx}
                            cx={p.x}
                            cy={p.y}
                            r={idx === points.length - 1 ? 3.5 : 2}
                            fill={p.alert ? '#EF4444' : idx === points.length - 1 ? '#0284C7' : '#38BDF8'}
                            stroke="#FFFFFF"
                            strokeWidth="1"
                          />
                        ))}
                      </svg>
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-1 px-1">
                        <span>Antigo ({minT.toFixed(1)}°C mín)</span>
                        <span className="text-sky-700 font-semibold">Recente ({historyChronological[historyChronological.length - 1]?.temperatura.toFixed(1)}°C)</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Card 2: Conectividade */}
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
              {/* Status Online */}
              <div className="flex flex-col">
                <span className="text-[11px] sm:text-xs font-medium text-slate-500 flex items-center gap-1.5 mb-1">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      apiStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                    }`}
                  />
                  Sinal Wi-Fi
                </span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    {apiStatus === 'connected' ? 'Online' : 'Offline'}
                  </span>
                  <span className="text-sm sm:text-base font-bold text-emerald-600">
                    · {telemetry.wifi_signal_pct}%
                  </span>
                </div>
              </div>

              {/* Horário de Sincronização pt-BR */}
              <div className="flex flex-col border-l border-slate-100 pl-4">
                <span className="text-[11px] sm:text-xs font-medium text-slate-500 flex items-center gap-1 mb-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Sincronização
                </span>
                <span className="text-sm sm:text-base font-semibold font-mono text-slate-700 tracking-tight mt-1">
                  {lastSyncTime}
                </span>
                <span className="text-[10px] text-slate-400 font-sans mt-0.5">
                  Polling a cada 5s
                </span>
              </div>
            </div>

            {/* Informações de infraestrutura e sensor */}
            <div className="mt-4 pt-3.5 border-t border-slate-100/90 text-xs text-slate-500 flex items-center justify-between">
              <span className="text-[11px]">Backend FastAPI</span>
              <span className="font-mono text-[11px] text-slate-700 font-medium">
                {apiStatus === 'connected' ? 'MongoDB Atlas Conectado' : 'Aguardando API'}
              </span>
            </div>
          </div>

        </section>

        {/* 5. SIMULAÇÃO RÁPIDA (Opcional para testes locais) */}
        <div className="pt-1 flex items-center justify-center gap-2 text-xs flex-wrap">
          <span className="text-slate-500 font-medium">Testar simulação:</span>
          <button
            onClick={() => simulateScenario(-18.5, 'stable', false)}
            className="px-2.5 py-1 rounded-lg bg-white/80 hover:bg-white text-slate-700 font-semibold border border-slate-200/80 transition-all cursor-pointer shadow-2xs"
          >
            Ideal (-18.5°C)
          </button>
          <button
            onClick={() => simulateScenario(-23.0, 'down', false)}
            className="px-2.5 py-1 rounded-lg bg-white/80 hover:bg-white text-sky-800 font-semibold border border-sky-200/80 transition-all cursor-pointer shadow-2xs"
          >
            Forte (-23.0°C)
          </button>
          <button
            onClick={() => simulateScenario(-9.5, 'up', true)}
            className="px-2.5 py-1 rounded-lg bg-white/80 hover:bg-white text-rose-800 font-semibold border border-rose-200/80 transition-all cursor-pointer shadow-2xs"
          >
            Alerta (-9.5°C ⚠️)
          </button>
        </div>

        {/* Rodapé */}
        <footer className="pt-2 text-center text-xs text-slate-400 font-medium">
          FrostSense · Monitoramento Térmico Inteligente conectado ao FastAPI & MongoDB
        </footer>

      </div>
    </div>
  );
}
