export type VisualStyle = 'blueprint-curator' | 'zak-invest';

export type AnimationType =
  | 'zoom-in'
  | 'zoom-out'
  | 'pan-left'
  | 'pan-right'
  | 'glide-up'
  | 'glide-down'
  | 'camera-pan-reveal';

export type VoicePersona = 'charon' | 'puck' | 'kore' | 'fenrir' | 'zephyr' | 'zak';
export type VoiceGender = 'male' | 'female';
export type GenerationMode = 'free' | 'gemini';

export interface Scene {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  keyword: string;
  prompt: string;
  animationType: AnimationType;
  assetUrl?: string;
  assetType?: 'image';
  style?: VisualStyle;
  focalPoint?: { x: number; y: number };
}

export interface GenerationStep {
  id: string;
  label: string;
  status: 'idle' | 'loading' | 'complete' | 'error';
}

export interface StoryState {
  topic: string;
  scriptText: string;
  isGeneratingScript: boolean;
  appStage: 'input' | 'script' | 'production';
  audioFile: File | null;
  characterFile: File | null;
  voicePersona: VoicePersona;
  voiceGender: VoiceGender;
  voiceSpeed: number;
  zakMode: boolean;
  generationMode: GenerationMode;
  scenes: Scene[];
  isProcessing: boolean;
  isRendering: boolean;
  progress: number;
  renderProgress: number;
  message: string;
  steps: GenerationStep[];
}
