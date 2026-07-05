import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Copy, CheckCircle, Crop } from 'lucide-react';
import { api } from '../api';
import toast from 'react-hot-toast';
import ImageCropModal from './ImageCropModal';
import { insertAtCursor } from '../utils/markdownEditor';

const ImageUpload = forwardRef(function ImageUpload(
  { onInsert, textareaRef, openCropOnSelect = true },
  ref,
) {
  const [uploading, setUploading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [copied, setCopied] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const fileInputRef = useRef(null);

  useImperativeHandle(ref, () => ({
    openPicker: () => fileInputRef.current?.click(),
  }));

  const uploadFile = async (file, autoInsert = false) => {
    setUploading(true);
    try {
      const upload = await api.uploadFile(file);
      const newImage = { url: upload.url, name: file.name };
      setUploadedImages((prev) => [...prev, newImage]);
      toast.success('Image uploaded');
      if (autoInsert) {
        insertAtCursorPosition(upload.url, file.name.replace(/\.[^.]+$/, ''));
      }
      return newImage;
    } catch (error) {
      toast.error('Upload failed: ' + error.message);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleFiles = (files) => {
    if (!files.length) return;
    if (openCropOnSelect) {
      setPendingFile(files[0]);
      if (files.length > 1) {
        toast('Crop one image at a time — first selected for cropping');
      }
    } else {
      files.forEach((f) => uploadFile(f));
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'] },
    multiple: true,
    noClick: !!pendingFile,
    onDrop: handleFiles,
  });

  const { ref: dropzoneRef, ...inputProps } = getInputProps();
  const setInputRef = (node) => {
    fileInputRef.current = node;
    if (typeof dropzoneRef === 'function') dropzoneRef(node);
    else if (dropzoneRef) dropzoneRef.current = node;
  };

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
      toast.success('Image inserted at cursor');
    } else {
      onInsert((prev) => `${prev}\n${markdown}\n`);
      toast.success('Image appended to content');
    }
  };

  const copyMarkdown = async (url) => {
    const markdown = `![Image](${url})`;
    await navigator.clipboard.writeText(markdown);
    setCopied(url);
    setTimeout(() => setCopied(null), 2000);
    toast.success('Markdown copied');
  };

  const removeImage = (index) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCropConfirm = async (croppedFile) => {
    setPendingFile(null);
    await uploadFile(croppedFile, true);
  };

  const handleCropSkip = async (originalFile) => {
    setPendingFile(null);
    await uploadFile(originalFile, true);
  };

  return (
    <div className="space-y-4">
      {pendingFile && (
        <ImageCropModal
          file={pendingFile}
          onConfirm={handleCropConfirm}
          onSkip={handleCropSkip}
          onCancel={() => setPendingFile(null)}
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
        {uploading ? (
          <p className="text-muted-foreground">Uploading...</p>
        ) : isDragActive ? (
          <p className="text-primary">Drop images here...</p>
        ) : (
          <div>
            <p className="text-muted-foreground mb-1 flex items-center justify-center gap-1.5">
              <Crop className="h-3.5 w-3.5" />
              Drag & drop or click — crop before upload
            </p>
            <p className="text-xs text-muted-foreground/60">JPEG, PNG, GIF, WebP</p>
          </div>
        )}
      </div>

      {uploadedImages.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {uploadedImages.map((image, index) => (
            <div key={index} className="relative group rounded-lg overflow-hidden border">
              <img src={image.url} alt={image.name} className="w-full h-28 object-cover" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                <button
                  type="button"
                  onClick={() => insertAtCursorPosition(image.url, image.name.replace(/\.[^.]+$/, ''))}
                  className="w-full text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                >
                  Insert at cursor
                </button>
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

export default ImageUpload;
