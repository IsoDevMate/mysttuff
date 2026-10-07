import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Copy, CheckCircle, Crop, Film } from 'lucide-react';
import { api } from '../api';
import toast from 'react-hot-toast';
import ImageCropModal from './ImageCropModal';
import { insertAtCursor } from '../utils/markdownEditor';

const IMAGE_ACCEPT = { 'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'] };
const VIDEO_ACCEPT = { 'video/*': ['.mp4', '.webm', '.mov'] };

/**
 * Media upload dropzone with a multi-file queue.
 *
 * - All selected files are uploaded (images go through the crop modal one at a time;
 *   videos upload directly).
 * - With `autoInsert`, every finished upload is inserted at the textarea cursor
 *   immediately — uploading an image now means it actually lands in the article.
 */
const MediaUpload = forwardRef(function MediaUpload(
  {
    onInsert,
    onSetFeatured,
    onUploaded,
    textareaRef,
    openCropOnSelect = true,
    autoInsert = false,
    allowVideos = false,
    allowMultiple = true,
  },
  ref,
) {
  const [uploading, setUploading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [copied, setCopied] = useState(null);
  // Queue of image files waiting to pass through the crop modal
  const [cropQueue, setCropQueue] = useState([]);
  const fileInputRef = useRef(null);
  const uploadingRef = useRef(false);
  const lastInsertRef = useRef(autoInsert);

  useImperativeHandle(ref, () => ({
    openPicker: () => fileInputRef.current?.click(),
    uploadFiles: (files, opts = {}) => handleFiles(files, opts),
  }));

  const insertAtCursorPosition = (url, alt = 'Image') => {
    const markdown = `![${alt}](${url})`;
    const el = textareaRef?.current;

    if (el) {
      const { newValue, cursorPos } = insertAtCursor(el, `\n${markdown}\n`);
      onInsert(newValue);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(cursorPos, cursorPos);
      });
    } else {
      onInsert((prev) => `${prev}\n${markdown}\n`);
    }
  };

  const uploadFile = async (file, { insert = false } = {}) => {
    try {
      const upload = await api.uploadFile(file);
      const isVideo = (file.type || '').startsWith('video/');
      const name = file.name.replace(/\.[^.]+$/, '');
      const newMedia = { url: upload.url, name, isVideo };
      setUploadedImages((prev) => [...prev, newMedia]);
      if (insert && onInsert && !isVideo) {
        insertAtCursorPosition(upload.url, name);
      } else if (insert && onInsert && isVideo) {
        // videos can't be markdown images — append a link instead
        onInsert((prev) => `${prev}\n[Video: ${name}](${upload.url})\n`);
      }
      onUploaded?.(upload.url, newMedia);
      return newMedia;
    } catch (error) {
      toast.error(`Upload failed (${file.name}): ` + error.message);
      return null;
    }
  };

  /** Upload everything that doesn't need cropping (videos / crop disabled), then queue images. */
  const handleFiles = (files, opts = {}) => {
    if (!files.length) return;
    const insert = opts.insert ?? autoInsert;
    lastInsertRef.current = insert;
    const skipCrop = !!opts.skipCrop;
    const list = allowMultiple ? [...files] : [files[0]];

    const direct = [];
    const images = [];
    for (const f of list) {
      const isVideo = (f.type || '').startsWith('video/');
      (isVideo || !openCropOnSelect || skipCrop ? direct : images).push(f);
    }

    setUploading(true);
    uploadingRef.current = true;

    (async () => {
      for (const f of direct) {
        await uploadFile(f, { insert });
      }
      if (images.length) {
        if (insert && images.length > 1) {
          toast(`${images.length} images queued — crop & upload each one`);
        }
        setCropQueue(images);
      } else {
        setUploading(false);
        uploadingRef.current = false;
        if (direct.length) toast.success(`Uploaded ${direct.length} file${direct.length > 1 ? 's' : ''}`);
      }
    })();
  };

  const finishCropStep = async (file) => {
    const rest = cropQueue.slice(1);
    setCropQueue(rest);
    try {
      const result = await uploadFile(file, { insert: lastInsertRef.current });
      if (!rest.length) {
        setUploading(false);
        uploadingRef.current = false;
        if (result) toast.success('Upload complete');
      }
    } catch {
      if (!rest.length) {
        setUploading(false);
        uploadingRef.current = false;
      }
    }
  };

  const handleCropConfirm = async (croppedFile) => finishCropStep(croppedFile);
  const handleCropSkip = async (originalFile) => finishCropStep(originalFile);
  const handleCropCancel = () => {
    setCropQueue([]);
    setUploading(false);
    uploadingRef.current = false;
  };

  const accept = allowVideos ? { ...IMAGE_ACCEPT, ...VIDEO_ACCEPT } : IMAGE_ACCEPT;

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept,
    multiple: allowMultiple,
    noClick: cropQueue.length > 0,
    onDrop: handleFiles,
  });

  const { ref: dropzoneRef, ...inputProps } = getInputProps();
  const setInputRef = (node) => {
    fileInputRef.current = node;
    if (typeof dropzoneRef === 'function') dropzoneRef(node);
    else if (dropzoneRef) dropzoneRef.current = node;
  };

  const copyMarkdown = async (url) => {
    await navigator.clipboard.writeText(`![Image](${url})`);
    setCopied(url);
    setTimeout(() => setCopied(null), 2000);
    toast.success('Markdown copied');
  };

  const removeImage = (index) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {cropQueue.length > 0 && (
        <ImageCropModal
          file={cropQueue[0]}
          queuePosition={cropQueue.length}
          onConfirm={handleCropConfirm}
          onSkip={handleCropSkip}
          onCancel={handleCropCancel}
        />
      )}

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/30 hover:border-muted-foreground/60'
        }`}
      >
        <input {...inputProps} ref={setInputRef} />
        <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
        {uploading || cropQueue.length > 0 ? (
          <p className="text-muted-foreground">
            Uploading… {cropQueue.length > 0 ? `${cropQueue.length} image${cropQueue.length > 1 ? 's' : ''} left to crop` : ''}
          </p>
        ) : isDragActive ? (
          <p className="text-primary">Drop files here…</p>
        ) : (
          <div>
            <p className="text-muted-foreground mb-1 flex items-center justify-center gap-1.5">
              <Crop className="h-3.5 w-3.5" />
              Drag & drop or click — upload multiple, crop before upload
            </p>
            <p className="text-xs text-muted-foreground/60">
              JPEG, PNG, GIF, WebP{allowVideos ? ' · MP4, WebM, MOV' : ''}
            </p>
          </div>
        )}
      </div>

      {uploadedImages.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {uploadedImages.map((image, index) => (
            <div key={index} className="relative group rounded-lg overflow-hidden border">
              {image.isVideo ? (
                <div className="w-full h-28 bg-muted flex items-center justify-center">
                  <Film className="h-8 w-8 text-muted-foreground" />
                </div>
              ) : (
                <img src={image.url} alt={image.name} className="w-full h-28 object-cover" />
              )}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                {onInsert && (
                  <button
                    type="button"
                    onClick={() => insertAtCursorPosition(image.url, image.name)}
                    className="w-full text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                  >
                    Insert at cursor
                  </button>
                )}
                {onSetFeatured && (
                  <button
                    type="button"
                    onClick={() => {
                      onSetFeatured(image.url);
                      toast.success('Set as featured hero image');
                    }}
                    className="w-full text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                  >
                    Set as featured
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => copyMarkdown(image.url)}
                  className="w-full text-xs bg-white/20 text-white px-2 py-1 rounded hover:bg-white/30 flex items-center justify-center gap-1"
                >
                  {copied === image.url ? (
                    <><CheckCircle className="h-3 w-3" /> Copied!</>
                  ) : (
                    <><Copy className="h-3 w-3" /> Copy markdown</>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5 hover:bg-red-700"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <p className="text-xs truncate px-1 py-0.5 bg-background/80 absolute bottom-0 left-0 right-0">
                {image.name}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

export default MediaUpload;
