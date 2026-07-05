import React, { useState, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Copy, CheckCircle } from 'lucide-react';
import { api } from '../api';
import toast from 'react-hot-toast';

/**
 * ImageUpload
 * Props:
 *   onInsert(markdown, url) — called when user clicks "Insert at cursor"
 *   textareaRef             — ref to the content textarea for cursor insertion
 */
export default function ImageUpload({ onInsert, textareaRef }) {
  const [uploading, setUploading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [copied, setCopied] = useState(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'] },
    multiple: true,
    onDrop: async (acceptedFiles) => {
      setUploading(true);
      try {
        const uploads = await Promise.all(acceptedFiles.map((f) => api.uploadFile(f)));
        const newImages = uploads.map((upload, i) => ({
          url: upload.url,
          name: acceptedFiles[i].name,
        }));
        setUploadedImages((prev) => [...prev, ...newImages]);
        toast.success(`${uploads.length} image(s) uploaded`);
      } catch (error) {
        toast.error('Upload failed: ' + error.message);
      } finally {
        setUploading(false);
      }
    },
  });

  const insertAtCursor = (url) => {
    const markdown = `![Image](${url})`;
    if (textareaRef?.current) {
      const el = textareaRef.current;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const before = el.value.slice(0, start);
      const after = el.value.slice(end);
      const newValue = before + '\n' + markdown + '\n' + after;
      // Trigger React synthetic change
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
      ).set;
      nativeInputValueSetter.call(el, newValue);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      // Move cursor after inserted markdown
      const newCursor = start + markdown.length + 2;
      el.setSelectionRange(newCursor, newCursor);
      el.focus();
      toast.success('Image inserted at cursor');
    }
    if (onInsert) onInsert(markdown, url);
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

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/30 hover:border-muted-foreground/60'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
        {uploading ? (
          <p className="text-muted-foreground">Uploading...</p>
        ) : isDragActive ? (
          <p className="text-primary">Drop images here...</p>
        ) : (
          <div>
            <p className="text-muted-foreground mb-1">Drag & drop or click to select images</p>
            <p className="text-xs text-muted-foreground/60">JPEG, PNG, GIF, WebP</p>
          </div>
        )}
      </div>

      {uploadedImages.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {uploadedImages.map((image, index) => (
            <div key={index} className="relative group rounded-lg overflow-hidden border">
              <img
                src={image.url}
                alt={image.name}
                className="w-full h-28 object-cover"
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                <button
                  type="button"
                  onClick={() => insertAtCursor(image.url)}
                  className="w-full text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                  title="Insert at cursor position in editor"
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
}
