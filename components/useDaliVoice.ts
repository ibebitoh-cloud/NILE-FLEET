import { useEffect, useRef, useState } from 'react';

/**
 * Voice input for DALI using the browser's built-in speech recognition
 * (Chrome, Edge, Safari on iPhone/Mac). Nothing is sent to our servers; the
 * recognized text is placed in the message box so the user can check it first.
 * `supported` is false on browsers without it, and the mic button is hidden.
 */
export function useDaliVoice(arabic: boolean, onText: (text: string) => void) {
  const Recognition: any = typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : undefined;
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const recRef = useRef<any>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => () => { try { recRef.current?.abort(); } catch { /* already stopped */ } }, []);

  const stop = () => { try { recRef.current?.stop(); } catch { /* already stopped */ } };

  const start = () => {
    if (!Recognition || listening) return;
    setError('');
    const rec = new Recognition();
    rec.lang = arabic ? 'ar-EG' : 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onresult = (event: any) => {
      let text = '';
      for (let i = 0; i < event.results.length; i++) text += event.results[i][0].transcript;
      onTextRef.current(text.trim());
    };
    rec.onerror = (event: any) => {
      const code = String(event?.error || '');
      if (code === 'not-allowed' || code === 'service-not-allowed') setError(arabic ? 'اسمح للمتصفح باستخدام الميكروفون.' : 'Allow microphone access in your browser.');
      else if (code !== 'aborted' && code !== 'no-speech') setError(arabic ? 'لم أسمع جيداً، حاول مرة أخرى.' : "I didn't catch that. Please try again.");
    };
    rec.onend = () => { setListening(false); recRef.current = null; };
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { setListening(false); }
  };

  return { supported: !!Recognition, listening, error, start, stop, toggle: () => (listening ? stop() : start()) };
}
