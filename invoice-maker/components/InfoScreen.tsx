import React from 'react';
import { Upload, Trash2, Building2, ShieldCheck, Move } from 'lucide-react';
import { CompanyInfo } from '../types';

interface Props {
  info: CompanyInfo;
  onUpdate: (info: Partial<CompanyInfo>) => void;
}

const InfoScreen: React.FC<Props> = ({ info, onUpdate }) => {
  const handleFileUpload = (field: 'logo' | 'signature' | 'watermark', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpdate({ [field]: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeFile = (field: 'logo' | 'signature' | 'watermark') => {
    onUpdate({ [field]: null });
  };

  return (
    <div className="space-y-12 max-w-5xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-slate-200 pb-8">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-[0.3em]">
            <Building2 className="w-4 h-4" />
            <span>Corporate Identity Layer</span>
          </div>
          <h2 className="text-5xl font-black tracking-tighter text-slate-900 uppercase">Company Profile</h2>
          <p className="text-slate-400 font-medium text-sm max-w-md">
            Managing the global branding assets and authorized operational parameters for the network.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Profile Info */}
        <div className="lg:col-span-7 space-y-12">
          <section className="space-y-8">
            <div className="flex items-center gap-3 border-l-4 border-indigo-600 pl-4">
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.3em]">General Profile</h3>
            </div>
            
            <div className="grid grid-cols-1 gap-8 bg-white p-10 border border-slate-200 rounded-[2.5rem] shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Company Name</label>
                  <input 
                    type="text" 
                    value={info.name}
                    onChange={(e) => onUpdate({ name: e.target.value })}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white outline-none font-black text-slate-900 transition-all uppercase tracking-tighter"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Sub-Name (e.g. GENSET)</label>
                  <input 
                    type="text" 
                    value={info.subName}
                    onChange={(e) => onUpdate({ subName: e.target.value })}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white outline-none font-black text-slate-900 transition-all uppercase tracking-tighter"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Headquarters Address</label>
                <textarea 
                  rows={3}
                  value={info.address}
                  onChange={(e) => onUpdate({ address: e.target.value })}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white outline-none font-black text-slate-900 transition-all resize-none uppercase tracking-tighter"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Official Email</label>
                  <input 
                    type="email" 
                    value={info.email}
                    onChange={(e) => onUpdate({ email: e.target.value })}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white outline-none font-black text-slate-900 transition-all font-mono"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Contact Phone</label>
                  <input 
                    type="text" 
                    value={info.phone}
                    onChange={(e) => onUpdate({ phone: e.target.value })}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white outline-none font-black text-slate-900 transition-all font-mono"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-8">
            <div className="flex items-center gap-3 border-l-4 border-emerald-500 pl-4">
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.3em]">Authorized Signatory</h3>
            </div>
            
            <div className="grid grid-cols-1 gap-8 bg-white p-10 border border-slate-200 rounded-[2.5rem] shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Full Name</label>
                  <input 
                    type="text" 
                    value={info.authName}
                    onChange={(e) => onUpdate({ authName: e.target.value })}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white outline-none font-black text-slate-900 transition-all uppercase tracking-tighter"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Designation</label>
                  <input 
                    type="text" 
                    value={info.authJobTitle}
                    onChange={(e) => onUpdate({ authJobTitle: e.target.value })}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white outline-none font-black text-slate-900 transition-all uppercase tracking-tighter"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Direct Phone</label>
                  <input 
                    type="text" 
                    value={info.authPhone}
                    onChange={(e) => onUpdate({ authPhone: e.target.value })}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white outline-none font-black text-slate-900 transition-all font-mono"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Direct Email</label>
                  <input 
                    type="email" 
                    value={info.authEmail}
                    onChange={(e) => onUpdate({ authEmail: e.target.value })}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white outline-none font-black text-slate-900 transition-all font-mono"
                  />
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Assets */}
        <div className="lg:col-span-5 space-y-12">
          <section className="space-y-8">
            <div className="flex items-center gap-3 border-l-4 border-amber-500 pl-4">
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.3em]">Visual Assets</h3>
            </div>
            
            <div className="bg-white p-10 border border-slate-200 rounded-[2.5rem] shadow-sm space-y-10">
              <AssetUpload 
                label="Primary Logo"
                value={info.logo}
                onUpload={(e) => handleFileUpload('logo', e)}
                onClear={() => removeFile('logo')}
              />

              <div className="space-y-8">
                <AssetUpload 
                  label="Digital Signature"
                  value={info.signature}
                  onUpload={(e) => handleFileUpload('signature', e)}
                  onClear={() => removeFile('signature')}
                  isSignature
                />
                
                {info.signature && (
                  <div className="bg-slate-900 p-8 rounded-[2rem] text-white space-y-8 shadow-2xl shadow-slate-900/40 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                    
                    <div className="flex items-center gap-2 relative z-10">
                      <Move className="w-4 h-4 text-indigo-400" />
                      <span className="text-[10px] font-black uppercase tracking-[0.3em]">Precision Placement</span>
                    </div>
                    
                    <div className="space-y-8 relative z-10">
                      <div className="space-y-3">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                          <span>Horizontal Offset</span>
                          <span className="text-indigo-400 font-mono tracking-tighter">{info.signatureXOffset}px</span>
                        </div>
                        <input 
                          type="range" min="-200" max="200" 
                          value={info.signatureXOffset}
                          onChange={(e) => onUpdate({ signatureXOffset: parseInt(e.target.value) })}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                          <span>Vertical Offset</span>
                          <span className="text-indigo-400 font-mono tracking-tighter">{info.signatureYOffset}px</span>
                        </div>
                        <input 
                          type="range" min="-200" max="200" 
                          value={info.signatureYOffset}
                          onChange={(e) => onUpdate({ signatureYOffset: parseInt(e.target.value) })}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                          <span>Asset Scale</span>
                          <span className="text-indigo-400 font-mono tracking-tighter">{Math.round(info.signatureScale * 100)}%</span>
                        </div>
                        <input 
                          type="range" min="0.5" max="2" step="0.1"
                          value={info.signatureScale}
                          onChange={(e) => onUpdate({ signatureScale: parseFloat(e.target.value) })}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-8">
                <AssetUpload 
                  label="Background Watermark"
                  value={info.watermark}
                  onUpload={(e) => handleFileUpload('watermark', e)}
                  onClear={() => removeFile('watermark')}
                />

                {info.watermark && (
                  <div className="bg-slate-900 p-8 rounded-[2rem] text-white space-y-8 shadow-2xl shadow-slate-900/40 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                    
                    <div className="flex items-center gap-2 relative z-10">
                      <Move className="w-4 h-4 text-blue-400" />
                      <span className="text-[10px] font-black uppercase tracking-[0.3em]">Watermark Calibration</span>
                    </div>
                    
                    <div className="space-y-8 relative z-10">
                      <div className="space-y-3">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                          <span>Opacity Intensity</span>
                          <span className="text-blue-400 font-mono tracking-tighter">{Math.round(info.watermarkOpacity * 100)}%</span>
                        </div>
                        <input 
                          type="range" min="0.01" max="0.2" step="0.01"
                          value={info.watermarkOpacity}
                          onChange={(e) => onUpdate({ watermarkOpacity: parseFloat(e.target.value) })}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                          <span>Coverage Scale</span>
                          <span className="text-blue-400 font-mono tracking-tighter">{Math.round(info.watermarkScale * 100)}%</span>
                        </div>
                        <input 
                          type="range" min="0.5" max="3" step="0.1"
                          value={info.watermarkScale}
                          onChange={(e) => onUpdate({ watermarkScale: parseFloat(e.target.value) })}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                          <span>Rotation Angle</span>
                          <span className="text-blue-400 font-mono tracking-tighter">{info.watermarkRotation}°</span>
                        </div>
                        <input 
                          type="range" min="-180" max="180" step="1"
                          value={info.watermarkRotation}
                          onChange={(e) => onUpdate({ watermarkRotation: parseInt(e.target.value) })}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

const AssetUpload: React.FC<{
  label: string;
  value: string | null;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  isSignature?: boolean;
}> = ({ label, value, onUpload, onClear, isSignature }) => (
  <div className="space-y-4">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">{label}</label>
    <div className="flex items-center gap-4">
      {value ? (
        <div className="relative group flex-1">
          <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/5 transition-colors rounded-3xl pointer-events-none" />
          <img 
            src={value} 
            alt={label} 
            className={`${isSignature ? 'h-40' : 'h-32'} w-full rounded-3xl border border-slate-200 bg-slate-50 object-contain p-6 transition-transform group-hover:scale-[1.01] duration-500`} 
          />
          <button 
            onClick={onClear}
            className="absolute -top-3 -right-3 bg-rose-500 text-white p-3 rounded-2xl opacity-0 group-hover:opacity-100 transition-all shadow-2xl hover:bg-rose-600 active:scale-90"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <label className={`${isSignature ? 'h-40' : 'h-32'} flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl cursor-pointer hover:bg-indigo-50 hover:border-indigo-400 transition-all group overflow-hidden relative`}>
          <div className="absolute inset-0 bg-indigo-500/0 group-hover:bg-indigo-500/5 transition-colors pointer-events-none" />
          <Upload className="w-8 h-8 text-slate-300 mb-3 group-hover:text-indigo-500 group-hover:scale-110 transition-all relative z-10" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] group-hover:text-indigo-600 relative z-10">Upload Asset</span>
          <input type="file" className="hidden" accept="image/*" onChange={onUpload} />
        </label>
      )}
    </div>
  </div>
);

export default InfoScreen;