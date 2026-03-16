import React, { useRef, useState, useEffect } from "react";
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
  // Keep refs to active listeners so we can always clean them up
  const moveRef = useRef<((ev: any) => void) | null>(null);
  const upRef = useRef<(() => void) | null>(null);

  // Guarantee cleanup when modal unmounts (covers mid-draw close)
  useEffect(() => {
    return () => {
      if (moveRef.current) window.removeEventListener("mousemove", moveRef.current);
      if (moveRef.current) window.removeEventListener("touchmove", moveRef.current);
      if (upRef.current) window.removeEventListener("mouseup", upRef.current);
      if (upRef.current) window.removeEventListener("touchend", upRef.current);
    };
  }, []);

  const startSignature = (e: any) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#000";

    const getPos = (ev: any) => {
      const r = canvas.getBoundingClientRect();
      if (ev.touches) return { x: ev.touches[0].clientX - r.left, y: ev.touches[0].clientY - r.top };
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
    };

    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);

    const move = (ev: any) => {
      ev.preventDefault();
      const p = getPos(ev);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
      moveRef.current = null;
      upRef.current = null;
    };

    moveRef.current = move;
    upRef.current = up;
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", up);
  };

  const clearSignature = () => {
    const canvas = sigCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const validTypes = ["image/jpeg", "image/png", "image/jpg"];
    if (!validTypes.includes(f.type)) {
      alert("Only JPEG and PNG images are supported.");
      e.target.value = "";
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
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Add Signature">
      <div className="modal-content">
        <h3 className="text-lg font-bold mb-4 text-gray-800">Add Signature</h3>
        <canvas
          ref={sigCanvasRef}
          className="sig-canvas border border-gray-300 rounded w-full h-48"
          width={350}
          height={200}
          onMouseDown={startSignature}
          onTouchStart={startSignature}
          aria-label="Signature drawing area — draw your signature here"
          role="img"
        />
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
          <button
            onClick={() => { if (sigCanvasRef.current) onSave(sigCanvasRef.current.toDataURL()); }}
            className="w-full py-3 bg-blue-600 text-white font-bold rounded shadow hover:bg-blue-700"
          >
            Use Signature
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 2. QR CODE MODAL
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

  const generate = async (value: string) => {
    if (!value.trim()) return;
    try {
      const url = await QRCode.toDataURL(value, {
        width: 200,
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      });
      setPreview(url);
    } catch (err) {
      console.error(err);
    }
  };

  // Auto-generate whenever text changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => { generate(text); }, 400);
    return () => clearTimeout(timer);
  }, [text]);

  // Auto-generate on open if editing an existing code
  useEffect(() => {
    if (editingId && initialText) generate(initialText);
  }, []);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="QR Code Setup">
      <div className="modal-content w-[350px]">
        <h3 className="text-lg font-bold mb-4 text-gray-800">{editingId ? "Edit QR Code" : "Setup QR Code"}</h3>
        <input
          type="text"
          className="w-full p-2 border border-gray-300 rounded mb-4"
          placeholder="Enter text or URL"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
        {preview && (
          <div className="flex justify-center mb-4 p-4 border rounded bg-white">
            <img src={preview} alt="QR Code Preview" className="w-32 h-32" />
          </div>
        )}
        {!preview && text.trim() && (
          <div className="flex justify-center mb-4 p-4 border rounded bg-slate-50 text-slate-400 text-sm h-32 items-center">
            Generating…
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded text-gray-600 hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => preview && onSave(preview, text)}
            disabled={!preview}
            className="flex-1 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 disabled:opacity-50"
          >
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
    const validTypes = ["image/jpeg", "image/png", "image/jpg"];
    if (!validTypes.includes(f.type)) {
      alert("Only JPEG and PNG images are supported.");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => { setPreview(evt.target?.result as string); };
    reader.readAsDataURL(f);
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Stamp Setup">
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
          <button
            onClick={() => preview && onSave(preview)}
            disabled={!preview}
            className="flex-1 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 disabled:opacity-50"
          >
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

  const formatDate = (dateVal: any) => {
    if (!dateVal) return "-";
    try {
      const d = typeof dateVal === "string" ? new Date(dateVal) : dateVal;
      return d.toLocaleString();
    } catch (e) {
      return "-";
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Document Properties">
      <div className="modal-content" style={{ width: "500px" }}>
        <h3 className="text-lg font-bold mb-4 text-gray-800">Document Properties</h3>
        <div className="flex flex-col gap-4">
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
          <div className="mt-2 pt-3 border-t border-gray-200 bg-slate-50 p-3 rounded-md">
            <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
              <div>
                <span className="block text-gray-500">PDF Producer:</span>
                <span className="block font-medium text-gray-700 truncate" title={data.producer}>{data.producer || "Unknown"}</span>
              </div>
              <div>
                <span className="block text-gray-500">PDF Creator:</span>
                <span className="block font-medium text-gray-700 truncate" title={data.creator}>{data.creator || "Unknown"}</span>
              </div>
              <div>
                <span className="block text-gray-500">Created:</span>
                <span className="block font-medium text-gray-700">{formatDate(data.creationDate)}</span>
              </div>
              <div>
                <span className="block text-gray-500">Modified:</span>
                <span className="block font-medium text-gray-700">{formatDate(data.modificationDate)}</span>
              </div>
              {data.pageCount && (
                <div className="col-span-2 mt-1">
                  <span className="text-gray-500">Page Count: </span>
                  <span className="font-medium text-gray-700">{data.pageCount}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <button className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded text-sm font-medium transition-colors" onClick={onClose}>
              Cancel
            </button>
            <button className="px-6 py-2 bg-blue-600 text-white font-bold rounded text-sm hover:bg-blue-700 shadow-sm transition-all active:scale-95" onClick={() => onSave(data)}>
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 5. CONFIRM DIALOG
// ==========================================
interface ConfirmDialogProps {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog = ({
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => (
  <div className="modal-overlay" role="alertdialog" aria-modal="true" aria-label={message}>
    <div className="modal-content" style={{ width: "380px" }}>
      <p className="text-gray-700 font-medium text-sm leading-relaxed mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button
          className="px-4 py-2 border border-gray-300 rounded text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors"
          onClick={onCancel}
        >
          {cancelLabel}
        </button>
        <button
          className="px-5 py-2 bg-red-600 text-white font-bold rounded text-sm hover:bg-red-700 transition-colors active:scale-95"
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
);

// ==========================================
// 6. PROMPT DIALOG
// ==========================================
interface PromptDialogProps {
  message: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export const PromptDialog = ({
  message,
  defaultValue = "",
  placeholder = "",
  confirmLabel = "OK",
  onConfirm,
  onCancel,
}: PromptDialogProps) => {
  const [value, setValue] = useState(defaultValue);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && value.trim()) onConfirm(value.trim());
    if (e.key === "Escape") onCancel();
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={message}>
      <div className="modal-content" style={{ width: "380px" }}>
        <p className="text-gray-700 font-medium text-sm mb-3">{message}</p>
        <input
          type="text"
          className="w-full border border-gray-300 p-2 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none mb-5"
          value={value}
          placeholder={placeholder}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <div className="flex gap-3 justify-end">
          <button
            className="px-4 py-2 border border-gray-300 rounded text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="px-5 py-2 bg-blue-600 text-white font-bold rounded text-sm hover:bg-blue-700 transition-colors active:scale-95 disabled:opacity-50"
            disabled={!value.trim()}
            onClick={() => onConfirm(value.trim())}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
