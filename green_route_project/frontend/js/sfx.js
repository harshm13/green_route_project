/**
 * GreenRoute - High-Tech Web Audio API Sound Synthesizer
 * Generates futuristic, pristine UI sounds natively in the browser without external audio assets.
 */

const GreenRouteSFX = (function () {
    let audioCtx = null;
    let isMuted = localStorage.getItem('gr_sfx_muted') === 'true';

    function getAudioContext() {
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                audioCtx = new AudioContext();
            }
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    }

    // 1. Subtle high-tech click
    function playClick() {
        if (isMuted) return;
        const ctx = getAudioContext();
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.04);

        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.04);
    }

    // 2. Sci-Fi Laser / QR Scan Sweep
    function playScan() {
        if (isMuted) return;
        const ctx = getAudioContext();
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.18);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.28);

        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.28);
    }

    // 3. Harmonious Ascending Crystal Chime (for rewards, level-ups & approvals)
    function playSuccess() {
        if (isMuted) return;
        const ctx = getAudioContext();
        if (!ctx) return;

        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);

            gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.08);
            gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + idx * 0.08 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.45);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(ctx.currentTime + idx * 0.08);
            osc.stop(ctx.currentTime + idx * 0.08 + 0.45);
        });
    }

    // 4. Critical Warning Radar Pulse
    function playAlert() {
        if (isMuted) return;
        const ctx = getAudioContext();
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(180, ctx.currentTime + 0.2);

        gain.gain.setValueAtTime(0.09, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.25);
    }

    // 5. Mute toggle
    function toggleMute() {
        isMuted = !isMuted;
        localStorage.setItem('gr_sfx_muted', isMuted);
        updateSfxUi();
        if (!isMuted) playClick();
        return isMuted;
    }

    function isSoundMuted() {
        return isMuted;
    }

    function updateSfxUi() {
        const btn = document.getElementById('gr-sfx-toggle');
        if (btn) {
            btn.innerHTML = isMuted ? '🔇 Audio Off' : '🔊 Cyber SFX';
            btn.classList.toggle('active', !isMuted);
        }
    }

    // Initialize global click sound listeners on buttons and pills
    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('button, .btn, .tab-btn, .filter-pill-btn').forEach(el => {
            el.addEventListener('click', () => {
                playClick();
            });
        });
        updateSfxUi();
    });

    return {
        playClick,
        playScan,
        playSuccess,
        playAlert,
        toggleMute,
        isMuted: isSoundMuted
    };
})();

window.GreenRouteSFX = GreenRouteSFX;
