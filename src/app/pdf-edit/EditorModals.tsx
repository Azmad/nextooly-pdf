import React, { useRef, useState } from "react";
import { Icons } from "@/app/pdf-edit/EditorIcons";
import { removeWhiteBackground } from "@/app/pdf-edit/utils";
import QRCode from "qrcode";

// ==========================================
// 1. SIGNATURE MODAL
// ==========================================
interface SignatureModalProps {
  onClose: () => void;
  onSave: (url: string) => void;
}

export const SignatureModal = ({ onClose, onSave }: SignatureModalProps) => {
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const sigFileRef = useRef<HTMLInputElement>(null);

  const startSignature = (e: any) => {
    const canvas = sigCanvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#000';
    const getPos = (ev: any) => {
      const r = canvas.getBoundingClientRect();
      if (ev.touches) return { x: ev.touches[0].clientX - r.left, y: ev.touches[0].clientY - r.top };
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
    };
    const { x, y } = getPos(e); ctx.beginPath(); ctx.moveTo(x, y);
    const move = (ev: any) => { ev.preventDefault(); const p = getPos(ev); ctx.lineTo(p.x, p.y); ctx.stroke(); };
    const up = () => {
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', move); window.removeEventListener('touchend', up);
    };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', move, { passive: false }); window.addEventListener('touchend', up);
  };

  const clearSignature = () => {
    const canvas = sigCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(f.type)) {
       alert("Only JPEG and PNG images are supported.");
       e.target.value = ""; // Clear the input so they can try again
       return;
    }
    const reader = new FileReader();
    reader.onload = async (evt) => {
      let result = evt.target?.result as string;
      result = await removeWhiteBackground(result);
      const img = new Image();
      img.onload = () => {
        const canvas = sigCanvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (canvas && ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const scale = Math.min((canvas.width - 20) / img.width, (canvas.height - 20) / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
        }
      };
      img.src = result;
    };
    reader.readAsDataURL(f);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3 className="text-lg font-bold mb-4 text-gray-800">Add Signature</h3>
        <canvas ref={sigCanvasRef} className="sig-canvas border border-gray-300 rounded w-full h-48" width={350} height={200} onMouseDown={startSignature} onTouchStart={startSignature} />
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-gray-400 font-bold uppercase">Draw Above</span>
          <button className="text-sm text-blue-600 font-medium flex items-center gap-1" onClick={() => sigFileRef.current?.click()}>
            <Icons.ImageIcon /> Upload Image
          </button>
          <input ref={sigFileRef} type="file" accept="image/png, image/jpeg, image/jpg" hidden onChange={handleUpload} />
        </div>
        <div className="flex flex-col gap-3 mt-4">
          <div className="flex gap-3">
            <button onClick={clearSignature} className="flex-1 py-2 border border-gray-300 rounded text-gray-600 hover:bg-gray-50">Clear</button>
            <button onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded text-gray-600 hover:bg-gray-50">Cancel</button>
          </div>
          <button onClick={() => {
             if(sigCanvasRef.current) onSave(sigCanvasRef.current.toDataURL());
          }} className="w-full py-3 bg-blue-600 text-white font-bold rounded shadow hover:bg-blue-700">Use Signature</button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 2. QR CODE MODAL (Client-Side)
// ==========================================
interface QrModalProps {
  editingId: string | null;
  initialText: string;
  savedQr: string | null;
  onClose: () => void;
  onSave: (url: string, text: string) => void;
}

export const QrModal = ({ editingId, initialText, savedQr: initialSavedQr, onClose, onSave }: QrModalProps) => {
  const [text, setText] = useState(initialText);
  const [preview, setPreview] = useState<string | null>(initialSavedQr);

  const generate = async () => {
    if (!text) return;
    try {
      // Generates a Data URL (base64) purely on the client side
      const url = await QRCode.toDataURL(text, { 
        width: 200, 
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
      setPreview(url);
    } catch (err) {
      console.error(err);
    }
  };

  // Auto-generate preview if editing an existing code
  React.useEffect(() => {
    if (editingId && initialText && !preview) {
      generate();
    }
  }, []);

  return (
    <div className="modal-overlay">
      <div className="modal-content w-[350px]">
        <h3 className="text-lg font-bold mb-4 text-gray-800">{editingId ? "Edit QR Code" : "Setup QR Code"}</h3>
        <input
          type="text"
          className="w-full p-2 border border-gray-300 rounded mb-4"
          placeholder="Enter text or URL"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="w-full py-2 bg-slate-200 hover:bg-slate-300 rounded mb-4 font-medium" onClick={generate}>
          Generate Preview
        </button>
        {preview && (
          <div className="flex justify-center mb-4 p-4 border rounded bg-white">
            <img src={preview} alt="QR Preview" className="w-32 h-32" />
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={() => preview && onSave(preview, text)} disabled={!preview} className="flex-1 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 disabled:opacity-50">
            {editingId ? "Update Item" : "Save & Use"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 3. STAMP MODAL
// ==========================================
interface StampModalProps {
  editingId: string | null;
  savedStamp: string | null;
  onClose: () => void;
  onSave: (url: string) => void;
}

export const StampModal = ({ editingId, savedStamp: initialStamp, onClose, onSave }: StampModalProps) => {
  const [preview, setPreview] = useState<string | null>(initialStamp);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(f.type)) {
       alert("Only JPEG and PNG images are supported.");
       e.target.value = ""; // Clear the input
       return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      setPreview(evt.target?.result as string);
    };
    reader.readAsDataURL(f);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content w-[350px]">
        <h3 className="text-lg font-bold mb-4 text-gray-800">{editingId ? "Edit Stamp" : "Setup Stamp"}</h3>
        <div className="mb-4 text-center">
          <button
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 justify-center w-full py-2 border border-dashed border-blue-400 rounded bg-blue-50"
            onClick={() => fileRef.current?.click()}
          >
            <Icons.Upload /> Upload Image
          </button>
          <input ref={fileRef} type="file" accept="image/png, image/jpeg, image/jpg" hidden onChange={handleUpload} />
        </div>
        {preview ? (
          <div className="flex justify-center mb-4 p-4 border rounded bg-white">
            <img src={preview} alt="Stamp Preview" className="max-h-32 object-contain" />
          </div>
        ) : (
          <p className="text-xs text-center text-gray-400 mb-4">No stamp selected</p>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={() => preview && onSave(preview)} disabled={!preview} className="flex-1 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 disabled:opacity-50">
            {editingId ? "Update Item" : "Save & Use"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 4. METADATA MODAL
// ==========================================
interface MetadataModalProps {
  metadata: any;
  onClose: () => void;
  onSave: (meta: any) => void;
}

export const MetadataModal = ({ metadata: initial, onClose, onSave }: MetadataModalProps) => {
  const [data, setData] = useState(initial);

  // Helper to safely format dates
  const formatDate = (dateVal: any) => {
    if (!dateVal) return "-";
    try {
      // Handle both Date objects and string ISO dates
      const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
      return d.toLocaleString();
    } catch (e) {
      return "-";
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ width: '500px' }}>
        <h3 className="text-lg font-bold mb-4 text-gray-800">Document Properties</h3>
        
        <div className="flex flex-col gap-4">
          {/* --- EDITABLE FIELDS --- */}
          <div>
            <label className="block text-gray-500 font-semibold mb-1 text-sm">Title</label>
            <input 
              className="w-full border border-gray-300 p-2 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
              value={data.title || ""} 
              onChange={e => setData({ ...data, title: e.target.value })} 
              placeholder="Document Title"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-500 font-semibold mb-1 text-sm">Author</label>
              <input 
                className="w-full border border-gray-300 p-2 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                value={data.author || ""} 
                onChange={e => setData({ ...data, author: e.target.value })} 
                placeholder="Author Name"
              />
            </div>
            <div>
              <label className="block text-gray-500 font-semibold mb-1 text-sm">Subject</label>
              <input 
                className="w-full border border-gray-300 p-2 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                value={data.subject || ""} 
                onChange={e => setData({ ...data, subject: e.target.value })} 
                placeholder="Subject"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-500 font-semibold mb-1 text-sm">Keywords</label>
            <input 
              className="w-full border border-gray-300 p-2 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
              value={data.keywords || ""} 
              onChange={e => setData({ ...data, keywords: e.target.value })} 
              placeholder="Separated by commas"
            />
          </div>

          {/* --- READ-ONLY INFO SECTION --- */}
          <div className="mt-2 pt-3 border-t border-gray-200 bg-slate-50 p-3 rounded-md">
            {/* <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Read-Only Properties</h4> */}
            <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
              <div>
                <span className="block text-gray-500">PDF Producer:</span>
                <span className="block font-medium text-gray-700 truncate" title={data.producer}>
                  {data.producer || "Unknown"}
                </span>
              </div>
              <div>
                <span className="block text-gray-500">PDF Creator:</span>
                <span className="block font-medium text-gray-700 truncate" title={data.creator}>
                  {data.creator || "Unknown"}
                </span>
              </div>
              <div>
                <span className="block text-gray-500">Created:</span>
                <span className="block font-medium text-gray-700">
                  {formatDate(data.creationDate)}
                </span>
              </div>
              <div>
                <span className="block text-gray-500">Modified:</span>
                <span className="block font-medium text-gray-700">
                  {formatDate(data.modificationDate)}
                </span>
              </div>
              {data.pageCount && (
                <div className="col-span-2 mt-1">
                   <span className="text-gray-500">Page Count: </span>
                   <span className="font-medium text-gray-700">{data.pageCount}</span>
                </div>
              )}
            </div>
          </div>

          {/* --- ACTIONS --- */}
          <div className="flex justify-end gap-3 mt-2">
            <button 
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded text-sm font-medium transition-colors" 
              onClick={onClose}
            >
              Cancel
            </button>
            <button 
              className="px-6 py-2 bg-blue-600 text-white font-bold rounded text-sm hover:bg-blue-700 shadow-sm transition-all active:scale-95" 
              onClick={() => onSave(data)}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 5. WATERMARK MODAL
// ==========================================
// interface WatermarkModalProps {
//   onClose: () => void;
//   onSave: (settings: { text: string; range: string; color: string; opacity: number; rotation: number; size: number }) => void;
// }

// export const WatermarkModal = ({ onClose, onSave }: WatermarkModalProps) => {
//   const [text, setText] = useState("CONFIDENTIAL");
//   const [range, setRange] = useState("all"); // "all" or "1-5, 8"
//   const [color, setColor] = useState("#ff0000");
//   const [opacity, setOpacity] = useState(0.3);
//   const [rotation, setRotation] = useState(45);
//   const [size, setSize] = useState(60);

//   return (
//     <div className="modal-overlay">
//       <div className="modal-content w-[400px]">
//         <h3 className="text-lg font-bold mb-4 text-gray-800">Add Watermark</h3>

//         <div className="flex flex-col gap-4">
//           <div>
//             <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Watermark Text</label>
//             <input
//               className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
//               value={text}
//               onChange={(e) => setText(e.target.value)}
//               placeholder="e.g. DRAFT, CONFIDENTIAL"
//             />
//           </div>

//           <div className="grid grid-cols-2 gap-4">
//              <div>
//               <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Color</label>
//               <div className="flex items-center gap-2 border border-gray-300 p-2 rounded bg-white">
//                 <input type="color" className="w-6 h-6 p-0 border-0 rounded cursor-pointer" value={color} onChange={(e) => setColor(e.target.value)} />
//                 <span className="text-xs text-gray-500">{color}</span>
//               </div>
//             </div>
//             <div>
//               <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Font Size</label>
//               <input type="number" className="w-full border border-gray-300 p-2 rounded" value={size} onChange={(e) => setSize(Number(e.target.value))} />
//             </div>
//           </div>

//           <div className="grid grid-cols-2 gap-4">
//             <div>
//               <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Opacity: {Math.round(opacity * 100)}%</label>
//               <input type="range" min="0.1" max="1" step="0.1" className="w-full" value={opacity} onChange={(e) => setOpacity(parseFloat(e.target.value))} />
//             </div>
//             <div>
//               <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Rotation: {rotation}°</label>
//               <input type="range" min="0" max="360" step="15" className="w-full" value={rotation} onChange={(e) => setRotation(parseInt(e.target.value))} />
//             </div>
//           </div>

//           <div>
//             <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Page Range</label>
//             <div className="flex gap-4 mb-2">
//               <label className="flex items-center gap-2 text-sm cursor-pointer">
//                 <input type="radio" name="range" checked={range === "all"} onChange={() => setRange("all")} /> All Pages
//               </label>
//               <label className="flex items-center gap-2 text-sm cursor-pointer">
//                 <input type="radio" name="range" checked={range !== "all"} onChange={() => setRange("")} /> Custom
//               </label>
//             </div>
//             {range !== "all" && (
//               <input
//                 className="w-full border border-gray-300 p-2 rounded text-sm placeholder:text-gray-300"
//                 placeholder="e.g. 1, 3-5, 10"
//                 value={range}
//                 onChange={(e) => setRange(e.target.value)}
//               />
//             )}
//           </div>

//           <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
//             <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
//             <button
//               onClick={() => onSave({ text, range, color, opacity, rotation, size })}
//               className="px-6 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 shadow-sm"
//             >
//               Add Watermark
//             </button>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };