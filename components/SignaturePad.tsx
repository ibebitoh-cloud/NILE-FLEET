
import React, { useRef, useState, useEffect } from 'react';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  initialValue?: string;
  isAr?: boolean;
}

const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, initialValue, isAr }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(!!initialValue);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && initialValue) {
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = initialValue;
    }
  }, [initialValue]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    // Account for canvas scaling if CSS width/height differ from internal width/height
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#001F3F';
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasSignature(false);
      onSave('');
    }
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (canvas && hasSignature) {
      onSave(canvas.toDataURL('image/png'));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      onSave(dataUrl);
      setHasSignature(true);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      <div className="relative group">
        <canvas
          ref={canvasRef}
          width={800} // Internal resolution
          height={360}
          className="w-full h-[180px] bg-slate-50 dark:bg-slate-950 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 cursor-crosshair touch-none shadow-inner"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 text-center px-6">
              {isAr ? 'وقع هنا يدوياً أو ارفع ملفاً' : 'Draw manually or upload image'}
            </p>
          </div>
        )}
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleFileUpload} 
      />

      <div className="grid grid-cols-2 gap-3">
        <button 
          type="button" 
          onClick={clear}
          className="py-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-[9px] font-black uppercase text-slate-500 hover:text-rose-500 transition-all border border-transparent hover:border-rose-200"
        >
          {isAr ? 'مسح' : 'Clear'}
        </button>
        <button 
          type="button" 
          onClick={() => fileInputRef.current?.click()}
          className="py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl text-[9px] font-black uppercase border border-blue-100 dark:border-blue-800 hover:bg-blue-100 transition-all"
        >
          {isAr ? 'رفع ملف' : 'Upload Image'}
        </button>
        <button 
          type="button" 
          onClick={handleSave}
          className="col-span-2 py-4 bg-[#001F3F] text-[#C2A378] rounded-xl text-[10px] font-black uppercase shadow-xl active:scale-95 transition-all border border-[#C2A378]/30"
        >
          {isAr ? 'اعتماد التوقيع الحالي' : 'Confirm Signature Asset'}
        </button>
      </div>
    </div>
  );
};

export default SignaturePad;
