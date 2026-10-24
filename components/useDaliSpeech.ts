import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Lets DALI read its answers out loud with the browser's built-in voices.
 * Arabic text uses an Egyptian Arabic voice (ar-EG) when the device has one,
 * otherwise any Arabic voice; other text uses an English voice. The on/off
 * choice is remembered per browser. Hidden where speech synthesis is missing.
 */
const STORE_KEY = 'nile-dali-speaks';

const pickVoice = (voices: SpeechSynthesisVoice[], arabic: boolean) => {
  const by = (test: (v: SpeechSynthesisVoice) => boolean) => voices.find(test);
  const lang = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace('_', '-');
  if (arabic) {
    return by(v => lang(v) === 'ar-eg' && /natural|neural|online/i.test(v.name))
      || by(v => lang(v) === 'ar-eg')
      || by(v => lang(v).startsWith('ar') && /natural|neural|online|google/i.test(v.name))
      || by(v => lang(v).startsWith('ar'));
  }
  return by(v => lang(v) === 'en-us' && /natural|neural|online|google/i.test(v.name))
    || by(v => lang(v) === 'en-us')
    || by(v => lang(v).startsWith('en'));
};

// Speech engines read emojis and symbols aloud, and Chrome cuts off long
// utterances, so clean the text and speak it a sentence or two at a time.
const toChunks = (text: string) => {
  const clean = String(text || '')
    .replace(/[\p{Extended_Pictographic}️]/gu, '')
    .replace(/[•*#_`>|→←]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const sentences = clean.match(/[^.!?؟\n]+[.!?؟]*/g) || [];
  const chunks: string[] = [];
  let current = '';
  for (const s of sentences) {
    if (current && (current + s).length > 220) { chunks.push(current.trim()); current = ''; }
    current += s;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
};

export function useDaliSpeech() {
  const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  const [enabled, setEnabled] = useState(() => { try { return localStorage.getItem(STORE_KEY) === 'true'; } catch { return false; } });
  const [speaking, setSpeaking] = useState(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (!synth) return;
    const load = () => { voicesRef.current = synth.getVoices(); };
    load();
    synth.addEventListener?.('voiceschanged', load);
    return () => { synth.removeEventListener?.('voiceschanged', load); synth.cancel(); };
  }, [synth]);

  const stop = useCallback(() => { synth?.cancel(); setSpeaking(false); }, [synth]);

  const speak = useCallback((text: string) => {
    if (!synth) return;
    synth.cancel();
    const chunks = toChunks(text);
    if (!chunks.length) return;
    if (!voicesRef.current.length) voicesRef.current = synth.getVoices();
    setSpeaking(true);
    chunks.forEach((chunk, i) => {
      const arabic = /[؀-ۿ]/.test(chunk);
      const u = new SpeechSynthesisUtterance(chunk);
      const voice = pickVoice(voicesRef.current, arabic);
      if (voice) u.voice = voice;
      u.lang = voice?.lang || (arabic ? 'ar-EG' : 'en-US');
      u.rate = arabic ? 0.95 : 1;
      if (i === chunks.length - 1) { u.onend = () => setSpeaking(false); u.onerror = () => setSpeaking(false); }
      synth.speak(u);
    });
  }, [synth]);

  const toggle = useCallback(() => {
    setEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem(STORE_KEY, String(next)); } catch { /* storage blocked */ }
      if (!next) synth?.cancel();
      return next;
    });
    setSpeaking(false);
  }, [synth]);

  return { supported: !!synth, enabled, speaking, speak, stop, toggle };
}
