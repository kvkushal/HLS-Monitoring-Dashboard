class AudioSynth {
    constructor() {
        this.ctx = null;
        this.timers = [];
        this.isMuted = false;
        this.currentMode = null; // 'SIREN', 'ALARM', or null
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    stopAll() {
        this.timers.forEach(t => clearInterval(t));
        this.timers = [];
        this.currentMode = null;
    }

    beep(freq = 800, type = 'sine', duration = 0.2) {
        if (this.isMuted) return;
        this.init();
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

            // Simple click-free envelope
            gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) { console.error(e); }
    }

    startSiren() {
        if (this.currentMode === 'SIREN') return; // Already running
        this.stopAll();
        if (this.isMuted) return;

        this.currentMode = 'SIREN';
        const loop = () => {
            // Slack-like double beep (High Pitch)
            this.beep(800, 'sine', 0.1);
            setTimeout(() => this.beep(800, 'sine', 0.1), 200);
        };
        loop();
        this.timers.push(setInterval(loop, 7000));
    }

    startAlarm() {
        if (this.currentMode === 'ALARM') return; // Already running
        this.stopAll();
        if (this.isMuted) return;

        this.currentMode = 'ALARM';
        const loop = () => {
            // Slack-like double beep (Low Pitch)
            this.beep(500, 'sine', 0.1);
            setTimeout(() => this.beep(500, 'sine', 0.1), 200);
        };
        loop();
        this.timers.push(setInterval(loop, 7000));
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.isMuted) this.stopAll();
        return this.isMuted;
    }
}

export const audioSynth = new AudioSynth();
