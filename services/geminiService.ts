import { GoogleGenAI, Type, Modality } from '@google/genai';
import { Scene, VoiceGender, VisualStyle, GenerationMode, AnimationType } from '../types';

const hasGeminiKey = () => Boolean(process.env.API_KEY || process.env.GEMINI_API_KEY);

const estimateDurationSeconds = (text: string, wpm = 145) => {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(30, Math.round((words / wpm) * 60));
};

const splitSentences = (text: string): string[] =>
  text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

const pickAnimation = (index: number): AnimationType => {
  const seq: AnimationType[] = ['zoom-in', 'pan-left', 'zoom-out', 'pan-right', 'glide-up', 'glide-down', 'camera-pan-reveal'];
  return seq[index % seq.length];
};

const safeText = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const hash = (input: string) => {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) h = (h << 5) - h + input.charCodeAt(i);
  return Math.abs(h);
};

const buildLocalWhiteboardSvg = (scenePrompt: string, style: VisualStyle) => {
  const seed = hash(scenePrompt);
  const accent = style === 'zak-invest' ? '#0d9488' : '#38bdf8';
  const title = safeText(scenePrompt.split(' ').slice(0, 7).join(' ').toUpperCase());

  const scribbles = Array.from({ length: 14 }, (_, i) => {
    const x1 = 40 + ((seed + i * 47) % 1100);
    const y1 = 80 + ((seed + i * 71) % 540);
    const x2 = x1 + 30 + ((seed + i * 29) % 170);
    const y2 = y1 + (-40 + ((seed + i * 13) % 80));
    return `<path d="M${x1},${y1} Q${(x1 + x2) / 2},${y1 - 20} ${x2},${y2}" stroke="#0f172a" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  }).join('');

  const body = style === 'zak-invest'
    ? `<circle cx="980" cy="250" r="72" stroke="#111827" stroke-width="8" fill="none"/>
       <path d="M920 420 Q980 300 1040 420" stroke="#111827" stroke-width="8" fill="none"/>
       <rect x="900" y="410" width="160" height="220" rx="24" fill="${accent}" stroke="#111827" stroke-width="8"/>`
    : `<rect x="840" y="180" width="280" height="360" rx="20" fill="#e0f2fe" stroke="#0c4a6e" stroke-width="8"/>
       <path d="M870 230 H1090 M870 280 H1090 M870 330 H1090 M870 380 H1090" stroke="#0c4a6e" stroke-width="6"/>`;

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
    <rect width="1280" height="720" fill="#ffffff"/>
    <rect x="22" y="22" width="1236" height="676" rx="28" fill="none" stroke="#0f172a" stroke-opacity="0.15" stroke-width="4"/>
    <text x="70" y="108" fill="#0f172a" font-size="44" font-family="Arial Black, Arial, sans-serif">${title}</text>
    <line x1="70" y1="126" x2="740" y2="126" stroke="${accent}" stroke-width="8"/>
    ${scribbles}
    ${body}
  </svg>`;
};

export async function generateScript(topic: string, mode: GenerationMode = 'free'): Promise<string> {
  if (mode === 'gemini' && hasGeminiKey()) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Act as a Master Storyteller and Educator. Generate a deep, engaging video script about: "${topic}".
LENGTH REQUIREMENT: 1200-2200 words.
Use simple language with clear sections: hook, overview, core lessons, story, framework, action plan, recap and CTA.`;
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    return response.text;
  }

  return [
    `Title: ${topic}`,
    `\nHook: Imagine if you could understand ${topic} in a way that actually changes your next decision today.`,
    '\nOverview: In this video, we break the topic into plain language, useful examples, and practical actions.',
    '\nCore Lesson 1: Define the core idea clearly and remove jargon.',
    `Think of ${topic} like a system with inputs, behaviors, and outcomes. When one piece changes, the result changes.`,
    '\nCore Lesson 2: Spot common mistakes and hidden assumptions before they cost time.',
    '\nStory: Meet a person who struggled, changed one behavior, and compounded results over 90 days.',
    '\nFramework: Use this 3-step loop: Observe -> Simplify -> Execute.',
    '\nAction Plan: Choose one action for 24 hours, one for 7 days, and one for 30 days.',
    '\nRecap: You learned what matters, what to avoid, and what to do next.',
    '\nCTA: If this helped, share your 24-hour action step and key takeaway.',
  ].join('\n\n');
}

export async function analyzeScript(script: string, duration?: number, zakMode = true, mode: GenerationMode = 'free'): Promise<Scene[]> {
  if (mode === 'gemini' && hasGeminiKey()) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Segment this script for a whiteboard video. Total duration ${duration ?? estimateDurationSeconds(script)} sec.\nReturn JSON scene array with text,startTime,endTime,keyword,animationType,prompt,focalPoint.`;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt + `\nScript:\n${script}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              startTime: { type: Type.NUMBER },
              endTime: { type: Type.NUMBER },
              keyword: { type: Type.STRING },
              animationType: { type: Type.STRING },
              prompt: { type: Type.STRING },
              focalPoint: {
                type: Type.OBJECT,
                properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } },
                required: ['x', 'y'],
              },
            },
            required: ['text', 'startTime', 'endTime', 'keyword', 'prompt', 'animationType', 'focalPoint'],
          },
        },
      },
    });
    const rawScenes = JSON.parse(response.text);
    return rawScenes.map((s: Scene, i: number) => ({ ...s, id: `scene-${i}`, style: zakMode ? 'zak-invest' : 'blueprint-curator' }));
  }

  const lines = splitSentences(script);
  const totalDuration = duration ?? estimateDurationSeconds(script);
  const chunks: string[] = [];
  for (let i = 0; i < lines.length; i += 2) chunks.push(lines.slice(i, i + 2).join(' '));
  const safeChunks = (chunks.length ? chunks : [script]).slice(0, 60);
  const sceneDuration = Math.max(4, totalDuration / safeChunks.length);

  return safeChunks.map((text, i) => {
    const keyword = text.split(' ').slice(0, 3).join(' ');
    const start = Number((i * sceneDuration).toFixed(2));
    const end = Number(((i + 1) * sceneDuration).toFixed(2));
    return {
      id: `scene-${i}`,
      text,
      startTime: start,
      endTime: end,
      keyword,
      prompt: `${zakMode ? 'Whiteboard educator in teal hoodie,' : 'clean blueprint style,'} ${text}`,
      animationType: pickAnimation(i),
      focalPoint: { x: ((i % 4) + 1) / 5, y: (((i + 2) % 4) + 1) / 5 },
      style: zakMode ? 'zak-invest' : 'blueprint-curator',
    };
  });
}

export async function generateTTS(
  text: string,
  gender: VoiceGender,
  speed = 1,
  zakMode = false,
  mode: GenerationMode = 'free',
): Promise<{ base64: string; sampleRate: number }> {
  if (mode === 'gemini' && hasGeminiKey()) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const voiceName = zakMode ? 'Charon' : gender === 'male' ? 'Fenrir' : 'Kore';
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text: `Natural voice. pace ${speed.toFixed(1)}x: ${text}` }] }],
      config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } } },
    });
    const base64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64) throw new Error('TTS generation failed');
    return { base64, sampleRate: 24000 };
  }

  throw new Error('Free mode does not use paid TTS APIs. Please record or upload narration in the UI.');
}

export async function generateImageForScene(scenePrompt: string, _characterImageBase64?: string, style: VisualStyle = 'zak-invest'): Promise<string> {
  const svg = buildLocalWhiteboardSvg(scenePrompt, style);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
