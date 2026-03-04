import React, { useEffect, useMemo, useRef, useState } from 'react';
import { analyzeScript, generateImageForScene, generateScript, generateTTS } from './services/geminiService';
import { GenerationMode, GenerationStep, StoryState } from './types';
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  HandRaisedIcon,
  MicrophoneIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

const INITIAL_STEPS: GenerationStep[] = [
  { id: 'script', label: 'Script', status: 'idle' },
  { id: 'voice', label: 'Voiceover', status: 'idle' },
  { id: 'scenes', label: 'Storyboard', status: 'idle' },
  { id: 'visuals', label: 'Visuals', status: 'idle' },
];

const BG_MUSIC_URL = 'https://files.freemusicarchive.org/storage-freemusicarchive-org/music/no_curator/Ketsa/Raising_Frequencies/Ketsa_-_02_-_A_New_Dawn.mp3';

const App: React.FC = () => {
  const [state, setState] = useState<StoryState>({
    topic: '',
    scriptText: '',
    isGeneratingScript: false,
    appStage: 'input',
    audioFile: null,
    characterFile: null,
    voicePersona: 'zak',
    voiceGender: 'male',
    voiceSpeed: 1,
    zakMode: true,
    generationMode: 'free',
    scenes: [],
    isProcessing: false,
    isRendering: false,
    progress: 0,
    renderProgress: 0,
    message: 'Ready',
    steps: INITIAL_STEPS,
  });

  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecordingNarration, setIsRecordingNarration] = useState(false);
  const [isNarrationReady, setIsNarrationReady] = useState(false);
  const [autoGenerateVoice, setAutoGenerateVoice] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);
  const productionTimerRef = useRef<number | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const musicRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const voiceSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const musicSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const handImageRef = useRef<HTMLImageElement | null>(null);
  const audioObjectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const hand = new Image();
    hand.crossOrigin = 'anonymous';
    hand.src = 'https://i.ibb.co/L5w2RST/sketch-hand.png';
    hand.onload = () => (handImageRef.current = hand);
  }, []);

  useEffect(() => {
    return () => {
      if (audioObjectUrlRef.current) URL.revokeObjectURL(audioObjectUrlRef.current);
      if (productionTimerRef.current) window.clearInterval(productionTimerRef.current);
    };
  }, []);


  useEffect(() => {
    if (!state.isProcessing || etaSeconds === null) return;
    setEtaSeconds((prev) => {
      if (prev === null) return prev;
      return Math.max(0, prev - 1);
    });
  }, [elapsedSeconds, state.isProcessing]);

  const activeScene = useMemo(() => {
    if (!state.scenes.length) return null;
    return state.scenes.find((s) => currentTime >= s.startTime && currentTime <= s.endTime) ?? state.scenes[state.scenes.length - 1];
  }, [state.scenes, currentTime]);

  const updateStep = (id: string, status: GenerationStep['status']) => {
    setState((s) => ({ ...s, steps: s.steps.map((step) => (step.id === id ? { ...step, status } : step)) }));
  };

  const selectMode = (generationMode: GenerationMode) => {
    setState((s) => ({ ...s, generationMode }));
    setAutoGenerateVoice(generationMode === 'gemini');
  };

  const handleGenerateScript = async () => {
    if (!state.topic.trim()) {
      setState((st) => ({ ...st, message: 'Please enter a topic first.' }));
      return;
    }
    setState((s) => ({ ...s, isGeneratingScript: true }));
    try {
      const script = await generateScript(state.topic, state.generationMode);
      setState((s) => ({ ...s, isGeneratingScript: false, scriptText: script, appStage: 'script' }));
    } catch (error) {
      console.error(error);
      setState((s) => ({ ...s, isGeneratingScript: false, message: 'Script generation failed' }));
    }
  };

  const applyAudioUrl = (url: string, file: File | null) => {
    if (!audioRef.current) return;
    if (audioObjectUrlRef.current?.startsWith('blob:')) URL.revokeObjectURL(audioObjectUrlRef.current);
    audioObjectUrlRef.current = url;
    audioRef.current.src = url;
    setState((s) => ({ ...s, audioFile: file }));
  };

  const handleNarrationUpload = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      setState((st) => ({ ...st, message: 'Please upload a valid audio file.' }));
      return;
    }
    applyAudioUrl(URL.createObjectURL(file), file);
    setIsNarrationReady(true);
    setState((st) => ({ ...st, message: `Narration loaded: ${file.name}` }));
  };

  const handleRecordNarration = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setState((st) => ({ ...st, message: 'This browser does not support direct audio recording. Please upload an MP3/WAV file.' }));
      return;
    }
    if (isRecordingNarration) {
      recorderRef.current?.stop();
      setIsRecordingNarration(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (event) => chunks.push(event.data);
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const file = new File([blob], `narration-${Date.now()}.webm`, { type: 'audio/webm' });
        applyAudioUrl(URL.createObjectURL(file), file);
        setIsNarrationReady(true);
        setState((st) => ({ ...st, message: 'Narration recorded successfully.' }));
      };
      recorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecordingNarration(true);
    } catch (error) {
      console.error(error);
      setState((s) => ({ ...s, message: 'Microphone permission is required for recording.' }));
    }
  };

  const loadAudioDuration = async (): Promise<number> => {
    if (!audioRef.current?.src) throw new Error('Narration source is missing. Upload or record a voiceover first.');
    const tempAudio = new Audio(audioRef.current.src);
    await new Promise<void>((resolve, reject) => {
      tempAudio.onloadedmetadata = () => resolve();
      tempAudio.onerror = () => reject(new Error('Could not read narration file metadata. Try another audio file.'));
    });
    return tempAudio.duration || 120;
  };

  const buildNarrationIfNeeded = async () => {
    if (audioRef.current?.src) return;
    if (!autoGenerateVoice) throw new Error('Upload/record narration or enable auto voice generation.');
    const tts = await generateTTS(state.scriptText, state.voiceGender, state.voiceSpeed, state.zakMode, state.generationMode);
    const binary = atob(tts.base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const buffer = new ArrayBuffer(44 + bytes.length);
    const view = new DataView(buffer);
    const writeString = (offset: number, value: string) => {
      for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
    };
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + bytes.length, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, tts.sampleRate, true);
    view.setUint32(28, tts.sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, bytes.length, true);
    new Uint8Array(buffer, 44).set(bytes);
    const url = URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
    applyAudioUrl(url, null);
  };

  const handleStartProduction = async () => {
    if (!state.scriptText.trim()) {
      setState((st) => ({ ...st, message: 'Please generate or paste your script first.' }));
      return;
    }

    if (state.isProcessing) return;

    if (autoGenerateVoice && state.generationMode !== 'gemini') {
      setState((st) => ({ ...st, message: 'Auto voice generation requires Gemini mode.' }));
      return;
    }

    if (!audioRef.current?.src && !autoGenerateVoice) {
      setState((st) => ({ ...st, message: 'Upload/record narration or enable auto voice generation before building assets.' }));
      return;
    }

    setElapsedSeconds(0);
    setEtaSeconds(null);
    if (productionTimerRef.current) window.clearInterval(productionTimerRef.current);
    productionTimerRef.current = window.setInterval(() => setElapsedSeconds((e) => e + 1), 1000);

    setState((s) => ({ ...s, appStage: 'production', isProcessing: true, steps: INITIAL_STEPS, scenes: [], progress: 0 }));
    try {
      imageCache.current.clear();
      updateStep('script', 'complete');
      updateStep('voice', 'loading');
      await buildNarrationIfNeeded();
      updateStep('voice', 'complete');

      updateStep('scenes', 'loading');
      const duration = await loadAudioDuration();
      const scenes = await analyzeScript(state.scriptText, duration, state.zakMode, state.generationMode);
      if (!scenes.length) throw new Error('Could not create scenes from script. Please expand your script and try again.');
      setEtaSeconds(Math.max(5, Math.round(scenes.length * 1.5)));
      updateStep('scenes', 'complete');

      updateStep('visuals', 'loading');
      const finalScenes = [...scenes];
      let done = 0;

      const loadScene = async (scene: typeof scenes[number]) => {
        const url = await generateImageForScene(scene.prompt, undefined, scene.style, state.generationMode);
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.src = url;
        await new Promise<void>((resolve) => {
          image.onload = () => resolve();
          image.onerror = () => resolve();
        });
        imageCache.current.set(url, image);
        const idx = finalScenes.findIndex((s) => s.id === scene.id);
        finalScenes[idx] = { ...scene, assetUrl: url };
        done += 1;
        setState((s) => ({ ...s, progress: Math.round((done / Math.max(1, scenes.length)) * 100) }));
      };

      for (let i = 0; i < scenes.length; i += 4) {
        await Promise.all(scenes.slice(i, i + 4).map(loadScene));
      }

      setState((s) => ({ ...s, scenes: finalScenes, isProcessing: false, message: 'Production ready.' }));
      setEtaSeconds(0);
      if (productionTimerRef.current) window.clearInterval(productionTimerRef.current);
      productionTimerRef.current = null;
      updateStep('visuals', 'complete');
    } catch (error) {
      console.error(error);
      if (productionTimerRef.current) window.clearInterval(productionTimerRef.current);
      productionTimerRef.current = null;
      setState((s) => ({ ...s, isProcessing: false, message: error instanceof Error ? error.message : 'Production failed.' }));
    }
  };

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const W = 1280;
      const H = 720;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, W, H);

      if (activeScene?.assetUrl && imageCache.current.has(activeScene.assetUrl)) {
        const image = imageCache.current.get(activeScene.assetUrl)!;
        const duration = activeScene.endTime - activeScene.startTime;
        const rel = Math.max(0, currentTime - activeScene.startTime);
        const draw = Math.min(1, rel / Math.max(1, duration * 0.4));
        const strips = 42;
        const stripW = W / strips;

        ctx.save();
        ctx.beginPath();
        for (let i = 0; i < strips; i += 1) {
          if (i / strips < draw) ctx.rect(i * stripW, 0, stripW + 2, H);
        }
        ctx.clip();
        ctx.drawImage(image, 0, 0, W, H);
        ctx.restore();

        if (handImageRef.current && draw < 1) {
          const x = W * draw - 160;
          const y = H * 0.68 + Math.sin(currentTime * 10) * 20;
          ctx.drawImage(handImageRef.current, x, y, 320, 320);
        }
      }

      if (isPlaying || state.isRendering) requestAnimationFrame(render);
    };

    render();
  }, [activeScene, currentTime, isPlaying, state.isRendering]);

  const ensureAudioGraph = (context: AudioContext) => {
    if (!audioRef.current || !musicRef.current) return null;

    if (!voiceSourceRef.current) voiceSourceRef.current = context.createMediaElementSource(audioRef.current);
    if (!musicSourceRef.current) musicSourceRef.current = context.createMediaElementSource(musicRef.current);

    return { voiceSource: voiceSourceRef.current, musicSource: musicSourceRef.current };
  };

  const handleExport = async () => {
    if (!canvasRef.current || !audioRef.current || !musicRef.current) return;
    setState((s) => ({ ...s, isRendering: true }));

    try {
      if (!audioContextRef.current) audioContextRef.current = new AudioContext();
      const context = audioContextRef.current;
      if (context.state === 'suspended') await context.resume();

      const graph = ensureAudioGraph(context);
      if (!graph) throw new Error('Audio graph initialization failed.');

      const destination = context.createMediaStreamDestination();
      const voiceGain = context.createGain();
      voiceGain.gain.value = 1;
      graph.voiceSource.connect(voiceGain).connect(destination);

      const musicGain = context.createGain();
      musicGain.gain.value = 0.14;
      graph.musicSource.connect(musicGain).connect(destination);

      if (!canvasRef.current.captureStream || typeof MediaRecorder === 'undefined') {
        throw new Error('Video export is not supported in this browser.');
      }

      const stream = new MediaStream([...canvasRef.current.captureStream(60).getTracks(), ...destination.stream.getTracks()]);
      const preferredMime = 'video/webm;codecs=vp9,opus';
      const fallbackMime = 'video/webm';
      const mimeType = MediaRecorder.isTypeSupported(preferredMime) ? preferredMime : fallbackMime;
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      let exportInterval: number | null = null;

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `doodlevid-master-${Date.now()}.webm`;
        a.click();
        if (exportInterval) window.clearInterval(exportInterval);
        stream.getTracks().forEach((t) => t.stop());
        voiceGain.disconnect();
        musicGain.disconnect();
        setState((s) => ({ ...s, isRendering: false }));
      };
      mediaRecorder.onerror = () => {
        if (exportInterval) window.clearInterval(exportInterval);
        stream.getTracks().forEach((t) => t.stop());
        voiceGain.disconnect();
        musicGain.disconnect();
        setState((st) => ({ ...st, isRendering: false, message: 'Export failed due to recorder error.' }));
      };

      audioRef.current.currentTime = 0;
      musicRef.current.currentTime = 0;
      setCurrentTime(0);
      setIsPlaying(true);
      mediaRecorder.start();
      await Promise.all([audioRef.current.play(), musicRef.current.play()]);

      exportInterval = window.setInterval(() => {
        if (audioRef.current?.ended) {
          if (exportInterval) window.clearInterval(exportInterval);
          mediaRecorder.stop();
          setIsPlaying(false);
        }
        if (audioRef.current?.duration) {
          setState((s) => ({ ...s, renderProgress: Math.round((audioRef.current!.currentTime / audioRef.current!.duration) * 100) }));
        }
      }, 200);
    } catch (error) {
      console.error(error);
      setState((s) => ({ ...s, isRendering: false, message: 'Export failed. Try again after pressing play once.' }));
    }
  };

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 lg:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex items-center justify-between border border-white/10 rounded-2xl px-6 py-4 bg-slate-900/60">
          <h1 className="text-2xl font-black flex items-center gap-2"><HandRaisedIcon className="w-8 h-8 text-teal-400" /> DoodleVid AI</h1>
          <p className="text-xs uppercase tracking-wider text-slate-400">One click whiteboard pipeline</p>
        </header>

        <div className="grid lg:grid-cols-12 gap-6">
          <section className="lg:col-span-4 space-y-4 border border-white/10 rounded-2xl p-5 bg-slate-900/40">
            <h2 className="font-bold">Project</h2>
            <input className="w-full bg-slate-950 border border-white/10 rounded-xl p-3" value={state.topic} onChange={(e) => setState((s) => ({ ...s, topic: e.target.value }))} placeholder="Topic" />
            <div className="grid grid-cols-2 gap-2 text-sm">
              <button onClick={() => selectMode('free')} className={`rounded-xl p-2 border ${state.generationMode === 'free' ? 'border-teal-400 bg-teal-500/20' : 'border-white/10'}`}>Free mode</button>
              <button onClick={() => selectMode('gemini')} className={`rounded-xl p-2 border ${state.generationMode === 'gemini' ? 'border-teal-400 bg-teal-500/20' : 'border-white/10'}`}>Gemini mode</button>
            </div>
            <button onClick={handleGenerateScript} disabled={state.isGeneratingScript || !state.topic} className="w-full rounded-xl p-3 bg-teal-600 font-bold disabled:opacity-40 flex justify-center gap-2">
              {state.isGeneratingScript ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <SparklesIcon className="w-5 h-5" />} Generate script
            </button>

            <textarea className="w-full h-56 bg-slate-950 border border-white/10 rounded-xl p-3 text-sm" value={state.scriptText} onChange={(e) => setState((s) => ({ ...s, scriptText: e.target.value, appStage: 'script' }))} />

            <div className="space-y-2 text-sm">
              <label className="block font-semibold">Voiceover source</label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={autoGenerateVoice} onChange={(e) => setAutoGenerateVoice(e.target.checked)} disabled={state.generationMode !== 'gemini'} />
                <span>Auto-generate voice with Google TTS (Gemini mode)</span>
              </label>
              <label className="block">Or upload your own MP3/WAV</label>
              <input type="file" accept="audio/*,.mp3,.wav,.m4a,.webm" onChange={(e) => handleNarrationUpload(e.target.files?.[0] ?? null)} />
              <button onClick={handleRecordNarration} className="rounded-xl p-2 border border-white/10 w-full flex justify-center gap-2">
                <MicrophoneIcon className="w-5 h-5" /> {isRecordingNarration ? 'Stop recording' : 'Record narration'}
              </button>
            </div>

            <button onClick={handleStartProduction} disabled={!state.scriptText || state.isProcessing || (!isNarrationReady && !(autoGenerateVoice && state.generationMode === 'gemini'))} className="w-full rounded-xl p-3 bg-emerald-600 font-bold disabled:opacity-40">Build full video assets</button>
            <p className="text-xs text-amber-300">Google image generation uses Gemini image model. Whisk currently does not expose a public API key flow; this app uses the closest free Google programmable path.</p>
            <p className="text-xs text-slate-400">{state.message}</p>
          </section>

          <section className="lg:col-span-8 space-y-4">
            <div className="aspect-video border border-white/10 rounded-2xl overflow-hidden bg-white relative">
              <canvas ref={canvasRef} width={1280} height={720} className="w-full h-full" onClick={() => {
                if (!audioRef.current?.src) {
                  setState((st) => ({ ...st, message: 'Please upload/record narration or enable auto voice first.' }));
                  return;
                }
                if (isPlaying) {
                  audioRef.current?.pause();
                  musicRef.current?.pause();
                } else {
                  audioRef.current?.play();
                  musicRef.current?.play();
                }
                setIsPlaying((p) => !p);
              }} />
              <audio ref={audioRef} onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)} onEnded={() => setIsPlaying(false)} />
              <audio ref={musicRef} src={BG_MUSIC_URL} loop />
            </div>

            <div className="border border-white/10 rounded-2xl p-4 bg-slate-900/40 space-y-3">
              <div className="flex justify-between text-sm">
                <span>{formatTime(currentTime)} / {formatTime(audioRef.current?.duration || 0)}</span>
                <button onClick={handleExport} disabled={state.isRendering || state.isProcessing || !state.scenes.length} className="rounded-xl px-4 py-2 bg-teal-600 font-semibold disabled:opacity-40 flex items-center gap-2">
                  <ArrowDownTrayIcon className="w-5 h-5" /> {state.isRendering ? `Encoding ${state.renderProgress}%` : 'Export webm'}
                </button>
              </div>
              {state.isProcessing && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="flex items-center gap-1"><ClockIcon className="w-4 h-4" /> Elapsed: {formatTime(elapsedSeconds)}</span>
                    <span>ETA: {etaSeconds === null ? '--:--' : formatTime(etaSeconds)}</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-teal-500 transition-all" style={{ width: `${state.progress}%` }} />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {state.steps.map((step) => (
                  <div key={step.id} className="rounded-xl border border-white/10 p-3 text-xs flex items-center gap-2">
                    <CheckCircleIcon className={`w-4 h-4 ${step.status === 'complete' ? 'text-emerald-400' : step.status === 'loading' ? 'text-amber-400 animate-pulse' : 'text-slate-600'}`} /> {step.label}
                  </div>
                ))}
              </div>
              <div className="h-24 overflow-x-auto whitespace-nowrap space-x-2">
                {state.scenes.map((scene) => (
                  <span key={scene.id} className="inline-block rounded-lg bg-slate-800 px-3 py-2 text-xs">{scene.keyword}</span>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default App;
