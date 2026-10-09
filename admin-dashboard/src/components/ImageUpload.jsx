import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Copy, CheckCircle, Crop, Film, Pencil } from 'lucide-react';
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
    onReplaced,
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
  // URL string while re-cropping an already-uploaded image (edit mode)
  const [editingUrl, setEditingUrl] = useState(null);
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

  /** Re-crop an already-uploaded image and replace it with the new version. */
  const handleEditConfirm = async (croppedFile) => {
    const originalUrl = editingUrl;
    setEditingUrl(null);
    setUploading(true);
    try {
      const upload = await api.uploadFile(croppedFile);
      // Swap the old URL for the new one everywhere it was used
      setUploadedImages((prev) =>
        prev.map((img) => (img.url === originalUrl ? { ...img, url: upload.url } : img))
      );
      if (onReplaced) onReplaced(originalUrl, upload.url);
      toast.success('Image updated');
    } catch (error) {
      toast.error('Re-upload failed: ' + error.message);
    } finally {
      setUploading(false);
    }
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

      {editingUrl && (
        <ImageCropModal
          file={editingUrl}
          onConfirm={handleEditConfirm}
          onCancel={() => setEditingUrl(null)}
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
              <div className="absolute inset-0 bg-black/75 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                {onInsert && (
                  <button
                    type="button"
                    onClick={() => insertAtCursorPosition(image.url, image.name)}
                    className="w-full min-h-11 text-sm bg-primary text-primary-foreground px-3 py-2 rounded-md hover:bg-primary/90"
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
                    className="w-full min-h-11 text-sm bg-secondary text-secondary-foreground px-3 py-2 rounded-md hover:bg-secondary/80"
                  >
                    Set as featured
                  </button>
                )}
                {!image.isVideo && (
                  <button
                    type="button"
                    onClick={() => setEditingUrl(image.url)}
                    className="w-full min-h-11 text-sm bg-secondary text-secondary-foreground px-3 py-2 rounded-md hover:bg-secondary/80 flex items-center justify-center gap-2"
                  >
                    <Pencil className="h-3 w-3" /> Edit / re-crop
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => copyMarkdown(image.url)}
                  className="w-full min-h-11 text-sm bg-card text-card-foreground px-3 py-2 rounded-md hover:bg-accent flex items-center justify-center gap-2"
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
                  aria-label={`Remove ${image.name}`}
                  className="absolute top-1 right-1 h-11 w-11 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/90"
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
