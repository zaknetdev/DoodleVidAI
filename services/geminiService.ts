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
    '\nOverview: In this video, we will break the topic into plain language, simple examples, and practical actions.',
    '\nCore Lesson 1: Define the idea clearly and remove jargon.',
    `Think of ${topic} like a system with inputs, habits, and outcomes. When one piece changes, the result changes.`,
    '\nCore Lesson 2: Spot common mistakes and hidden assumptions.',
    '\nStory: Meet a person who struggled, changed one behavior, then compounded results over 90 days.',
    '\nFramework: Use this 3-step loop: Observe -> Simplify -> Execute.',
    '\nAction Plan: Pick one action to do in 24 hours, one in 7 days, and one in 30 days.',
    '\nRecap: You learned what matters, what to avoid, and exactly what to do next.',
    '\nCTA: If this helped, comment your key takeaway and share your 24-hour action.',
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
  const safeChunks = chunks.length ? chunks : [script];
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

  throw new Error('Free mode does not use paid TTS APIs. Please record/upload narration in the UI.');
}

export async function generateImageForScene(scenePrompt: string, _characterImageBase64?: string, style: VisualStyle = 'zak-invest'): Promise<string> {
  const styleHint =
    style === 'zak-invest'
      ? 'professional whiteboard marker drawing, plain white background, clean line art, teal hoodie character, no text'
      : 'minimal technical blueprint illustration, no text, high contrast';

  return `https://image.pollinations.ai/prompt/${encodeURIComponent(`${scenePrompt}, ${styleHint}`)}?width=1280&height=720&nologo=true`;
}
