import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Image } from 'lucide-react';
import { api } from '../api';
import toast from 'react-hot-toast';

export default function ImageUpload({ onImageUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    multiple: true,
    onDrop: async (acceptedFiles) => {
      setUploading(true);
      
      try {
        const uploads = await Promise.all(
          acceptedFiles.map(file => api.uploadFile(file))
        );
        
        const newImages = uploads.map((upload, index) => ({
          url: upload.url,
          name: acceptedFiles[index].name
        }));
        
        setUploadedImages(prev => [...prev, ...newImages]);
        toast.success(`Uploaded ${uploads.length} image(s)`);
      } catch (error) {
        toast.error('Upload failed');
      } finally {
        setUploading(false);
      }
    }
  });

  const copyToClipboard = (url) => {
    navigator.clipboard.writeText(`![Image](${url})`);
    toast.success('Markdown copied to clipboard');
    if (onImageUploaded) onImageUploaded(url);
  };

  const removeImage = (index) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        {uploading ? (
          <p className="text-gray-600">Uploading...</p>
        ) : isDragActive ? (
          <p className="text-blue-600">Drop the images here...</p>
        ) : (
          <div>
            <p className="text-gray-600 mb-2">Drag & drop images here, or click to select</p>
            <p className="text-sm text-gray-500">Supports: JPEG, PNG, GIF, WebP</p>
          </div>
        )}
      </div>

      {uploadedImages.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {uploadedImages.map((image, index) => (
            <div key={index} className="relative group">
              <img
                src={image.url}
                alt={image.name}
                className="w-full h-32 object-cover rounded-lg"
              />
              <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                <button
                  onClick={() => copyToClipboard(image.url)}
                  className="bg-blue-500 text-white p-2 rounded mr-2 hover:bg-blue-600"
                  title="Copy markdown"
                >
                  <Image className="h-4 w-4" />
                </button>
                <button
                  onClick={() => removeImage(index)}
                  className="bg-red-500 text-white p-2 rounded hover:bg-red-600"
                  title="Remove"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
