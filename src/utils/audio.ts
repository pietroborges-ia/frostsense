// Web Audio API generator for subtle frosted haptic/sound feedback and emergency hazard alerts

class FrostAudio {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;
  private alarmInterval: number | null = null;

  private init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public playClick(type: 'cold' | 'ideal' | 'warm') {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const now = this.ctx.currentTime;

      if (type === 'cold') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1760, now + 0.12);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.18);
      } else if (type === 'ideal') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(659.25, now);
        osc.frequency.setValueAtTime(783.99, now + 0.05);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.16);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(330, now + 0.15);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
      }
    } catch {
      // Audio playback fails silently if restricted by browser policy
    }
  }

  public playHazardWarning(pattern: 'door_open' | 'temp_danger') {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      if (pattern === 'door_open') {
        // High double alert beep (Door Open)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(950, now);
        osc.frequency.setValueAtTime(1200, now + 0.1);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      } else {
        // Urgent descending siren beep (Bacterial hazard)
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(520, now + 0.3);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      }

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch {
      // silently ignore
    }
  }
}

export const frostAudio = new FrostAudio();
