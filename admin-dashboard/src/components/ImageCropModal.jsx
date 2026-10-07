import React, { useState, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import { X, Check } from 'lucide-react';
import { Button } from './ui/button';
import { getCroppedBlob } from '../utils/cropImage';

const ASPECTS = [
  { label: 'Free', value: undefined },
  { label: '16:9', value: 16 / 9 },
  { label: '4:3', value: 4 / 3 },
  { label: '1:1', value: 1 },
];

export default function ImageCropModal({ file, queuePosition = 1, onConfirm, onSkip, onCancel }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState(undefined);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Create the object URL once per file and always revoke it (was leaking on every render)
  const [imageUrl, setImageUrl] = useState(() => URL.createObjectURL(file));
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onCropComplete = useCallback((_croppedArea, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    try {
      const mimeType = file.type || 'image/jpeg';
      const ext = mimeType.split('/')[1] || 'jpg';
      const blob = await getCroppedBlob(imageUrl, croppedAreaPixels, mimeType);
      const croppedFile = new File([blob], `cropped-${Date.now()}.${ext}`, { type: mimeType });
      onConfirm(croppedFile);
    } catch {
      onSkip(file);
    } finally {
      setProcessing(false);
    }
  };

  const handleSkip = () => {
    onSkip(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">
            Crop Image
            {queuePosition > 1 && (
              <span className="ml-2 text-xs text-muted-foreground font-normal">
                {queuePosition} in queue
              </span>
            )}
          </h3>
          <button type="button" onClick={onCancel} className="p-1 rounded hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative h-80 bg-black">
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Aspect:</span>
            {ASPECTS.map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={() => setAspect(a.value)}
                className={`text-xs px-2 py-1 rounded border transition-colors ${
                  aspect === a.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'hover:bg-muted'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground w-10">Zoom</label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={handleSkip}>
              Skip crop
            </Button>
            <Button size="sm" onClick={handleConfirm} disabled={processing}>
              <Check className="h-3.5 w-3.5 mr-1" />
              {processing ? 'Processing...' : 'Crop & upload'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
