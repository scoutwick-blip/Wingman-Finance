import React, { useState, useRef } from 'react';
import { Camera, Upload, X, Check, Loader } from 'lucide-react';
import { extractReceiptData } from '../services/geminiService';

interface ReceiptData {
  merchant?: string;
  amount?: number;
  date?: string;
  description?: string;
  receiptImage: string;
}

interface ReceiptScannerProps {
  onReceiptScanned: (data: ReceiptData) => void;
  onCancel: () => void;
}

export default function ReceiptScanner({ onReceiptScanned, onCancel }: ReceiptScannerProps) {
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    try {
      const resizedImage = await resizeImage(file);
      setImage(resizedImage);
      setError(null);
    } catch {
      setError('Failed to process image');
    }
  };

  const handleScan = async () => {
    if (!image) return;

    setIsProcessing(true);
    setError(null);

    try {
      const extractedData = await extractReceiptData(image);

      onReceiptScanned({
        ...extractedData,
        receiptImage: image
      });
    } catch {
      setError('Failed to scan receipt. Please try again or enter details manually.');
      setIsProcessing(false);
    }
  };

  const handleRetake = () => {
    setImage(null);
    setError(null);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900 uppercase tracking-wide">SCAN RECEIPT</h2>
              <p className="text-sm text-gray-600 mt-1">Capture or upload a receipt to extract details</p>
            </div>
            <button
              onClick={onCancel}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              disabled={isProcessing}
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Image Preview or Upload Options */}
          {!image ? (
            <div className="space-y-4">
              {/* Camera Capture */}
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="w-full bg-blue-600 text-white p-8 rounded-2xl hover:bg-blue-700 transition-all flex flex-col items-center gap-4 border-4 border-transparent hover:border-blue-300"
              >
                <Camera className="w-16 h-16" />
                <div className="text-center">
                  <p className="font-bold text-lg">Take Photo</p>
                  <p className="text-sm text-blue-100">Use your device camera</p>
                </div>
              </button>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* File Upload */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-slate-600 text-white p-8 rounded-2xl hover:bg-slate-700 transition-all flex flex-col items-center gap-4 border-4 border-transparent hover:border-slate-300"
              >
                <Upload className="w-16 h-16" />
                <div className="text-center">
                  <p className="font-bold text-lg">Upload Image</p>
                  <p className="text-sm text-slate-100">Choose from your device</p>
                </div>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              {error && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-red-800">
                  {error}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Image Preview */}
              <div className="relative rounded-xl overflow-hidden border-4 border-gray-200">
                <img
                  src={image}
                  alt="Receipt"
                  className="w-full h-auto max-h-96 object-contain bg-gray-50"
                />
              </div>

              {/* Processing State */}
              {isProcessing && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 text-center">
                  <Loader className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
                  <p className="font-bold text-blue-900">Processing Receipt...</p>
                  <p className="text-sm text-blue-700">Extracting transaction details</p>
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-red-800">
                  {error}
                </div>
              )}

              {/* Action Buttons */}
              {!isProcessing && (
                <div className="flex gap-3">
                  <button
                    onClick={handleScan}
                    className="flex-1 bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 transition-colors font-bold flex items-center justify-center gap-2"
                  >
                    <Check className="w-5 h-5" />
                    Scan Receipt
                  </button>
                  <button
                    onClick={handleRetake}
                    className="px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-100 transition-colors font-medium"
                  >
                    Retake
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Instructions */}
          <div className="mt-6 bg-slate-50 rounded-xl p-4 text-sm text-gray-700">
            <p className="font-bold mb-2">Tips for best results:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Ensure receipt is well-lit and in focus</li>
              <li>Capture the entire receipt including totals</li>
              <li>Avoid shadows and glare</li>
              <li>Hold camera steady and parallel to receipt</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
