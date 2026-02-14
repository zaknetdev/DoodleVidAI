
/* Fix: Explicitly define the AIStudio interface and update the Window augmentation to use it, resolving property type mismatches */
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
  }
}

export {};
