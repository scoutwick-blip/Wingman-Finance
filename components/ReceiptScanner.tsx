import React, { useState, useRef } from 'react';
import { Camera, Upload, X, Check, Loader, ChevronDown, ChevronUp } from 'lucide-react';
import { extractReceiptData } from '../services/geminiService';

interface ReceiptLineItem {
  name: string;
  quantity: number;
  price: number;
}

interface ReceiptData {
  merchant?: string;
  amount?: number;
  date?: string;
  description?: string;
  receiptImage: string;
  lineItems?: ReceiptLineItem[];
  subtotal?: number;
  tax?: number;
  tip?: number;
  paymentMethod?: string;
  category?: string;
}

interface ReceiptScannerProps {
  onReceiptScanned: (data: ReceiptData) => void;
  onCancel: () => void;
  currency?: string;
}

export default function ReceiptScanner({ onReceiptScanned, onCancel, currency = '$' }: ReceiptScannerProps) {
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<Omit<ReceiptData, 'receiptImage'> | null>(null);
  const [showLineItems, setShowLineItems] = useState(false);
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
      setExtractedData(null);
    } catch {
      setError('Failed to process image');
    }
  };

  const handleScan = async () => {
    if (!image) return;

    setIsProcessing(true);
    setError(null);

    try {
      const data = await extractReceiptData(image);
      setExtractedData(data);
    } catch {
      setError('Failed to scan receipt. Please try again or enter details manually.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = () => {
    if (!image || !extractedData) return;
    onReceiptScanned({
      ...extractedData,
      receiptImage: image
    });
  };

  const handleRetake = () => {
    setImage(null);
    setError(null);
    setExtractedData(null);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-semibold uppercase tracking-wide"
                style={{ color: 'var(--color-text-primary)' }}>SCAN RECEIPT</h2>
              <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                Capture or upload a receipt to extract details
              </p>
            </div>
            <button
              onClick={onCancel}
              className="p-2 rounded-lg transition-colors"
              style={{ color: 'var(--color-text-tertiary)' }}
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
                className="w-full p-8 rounded-2xl transition-all flex flex-col items-center gap-4 border-4 border-transparent text-white"
                style={{ backgroundColor: 'var(--color-bg-sidebar)' }}
              >
                <Upload className="w-16 h-16" />
                <div className="text-center">
                  <p className="font-bold text-lg">Upload Image</p>
                  <p className="text-sm opacity-70">Choose from your device</p>
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
                <div className="rounded-xl p-4"
                  style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '2px solid rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>
                  {error}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Image Preview */}
              <div className="relative rounded-xl overflow-hidden"
                style={{ border: '4px solid var(--color-border-card)' }}>
                <img
                  src={image}
                  alt="Receipt"
                  className="w-full h-auto max-h-64 object-contain"
                  style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
                />
              </div>

              {/* Processing State */}
              {isProcessing && (
                <div className="rounded-xl p-6 text-center"
                  style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '2px solid rgba(59, 130, 246, 0.2)' }}>
                  <Loader className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: 'var(--color-accent)' }} />
                  <p className="font-bold" style={{ color: 'var(--color-text-primary)' }}>Processing Receipt...</p>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Extracting items, totals, and details</p>
                </div>
              )}

              {/* Extracted Data Preview */}
              {extractedData && (
                <div className="rounded-xl p-5 space-y-4"
                  style={{ backgroundColor: 'var(--color-bg-tertiary)', border: '2px solid var(--color-border-card)' }}>
                  <h3 className="font-bold text-sm uppercase tracking-wider"
                    style={{ color: 'var(--color-text-secondary)' }}>
                    Extracted Details
                  </h3>

                  {/* Main info grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {extractedData.merchant && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>Merchant</p>
                        <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{extractedData.merchant}</p>
                      </div>
                    )}
                    {extractedData.amount != null && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>Total</p>
                        <p className="font-bold text-lg" style={{ color: 'var(--color-accent)' }}>{currency}{extractedData.amount.toFixed(2)}</p>
                      </div>
                    )}
                    {extractedData.date && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>Date</p>
                        <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{extractedData.date}</p>
                      </div>
                    )}
                    {extractedData.category && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>Category</p>
                        <p className="font-semibold" style={{ color: '#10b981' }}>{extractedData.category}</p>
                      </div>
                    )}
                  </div>

                  {extractedData.description && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>Description</p>
                      <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{extractedData.description}</p>
                    </div>
                  )}

                  {/* Subtotal / Tax / Tip breakdown */}
                  {(extractedData.subtotal != null || extractedData.tax != null || extractedData.tip != null) && (
                    <div className="rounded-lg p-3 space-y-1" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                      {extractedData.subtotal != null && (
                        <div className="flex justify-between text-sm">
                          <span style={{ color: 'var(--color-text-secondary)' }}>Subtotal</span>
                          <span style={{ color: 'var(--color-text-primary)' }}>{currency}{extractedData.subtotal.toFixed(2)}</span>
                        </div>
                      )}
                      {extractedData.tax != null && extractedData.tax > 0 && (
                        <div className="flex justify-between text-sm">
                          <span style={{ color: 'var(--color-text-secondary)' }}>Tax</span>
                          <span style={{ color: 'var(--color-text-primary)' }}>{currency}{extractedData.tax.toFixed(2)}</span>
                        </div>
                      )}
                      {extractedData.tip != null && extractedData.tip > 0 && (
                        <div className="flex justify-between text-sm">
                          <span style={{ color: 'var(--color-text-secondary)' }}>Tip</span>
                          <span style={{ color: 'var(--color-text-primary)' }}>{currency}{extractedData.tip.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Payment Method */}
                  {extractedData.paymentMethod && (
                    <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                      Paid with: <span className="font-semibold" style={{ color: 'var(--color-text-secondary)' }}>{extractedData.paymentMethod}</span>
                    </div>
                  )}

                  {/* Line Items (collapsible) */}
                  {extractedData.lineItems && extractedData.lineItems.length > 0 && (
                    <div>
                      <button
                        onClick={() => setShowLineItems(!showLineItems)}
                        className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider w-full"
                        style={{ color: 'var(--color-accent)' }}
                      >
                        {showLineItems ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {extractedData.lineItems.length} Line Item{extractedData.lineItems.length > 1 ? 's' : ''}
                      </button>
                      {showLineItems && (
                        <div className="mt-2 space-y-1 rounded-lg p-3" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                          {extractedData.lineItems.map((item, i) => (
                            <div key={i} className="flex justify-between text-sm">
                              <span style={{ color: 'var(--color-text-primary)' }}>
                                {item.quantity > 1 ? `${item.quantity}x ` : ''}{item.name}
                              </span>
                              <span className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                                {currency}{item.price.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="rounded-xl p-4"
                  style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '2px solid rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>
                  {error}
                </div>
              )}

              {/* Action Buttons */}
              {!isProcessing && (
                <div className="flex gap-3">
                  {extractedData ? (
                    <>
                      <button
                        onClick={handleConfirm}
                        className="flex-1 bg-emerald-600 text-white px-6 py-3 rounded-xl hover:bg-emerald-700 transition-colors font-bold flex items-center justify-center gap-2"
                      >
                        <Check className="w-5 h-5" />
                        Use This Data
                      </button>
                      <button
                        onClick={handleScan}
                        className="px-6 py-3 rounded-xl transition-colors font-medium"
                        style={{ border: '2px solid var(--color-border-card)', color: 'var(--color-text-secondary)' }}
                      >
                        Re-scan
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleScan}
                      className="flex-1 bg-emerald-600 text-white px-6 py-3 rounded-xl hover:bg-emerald-700 transition-colors font-bold flex items-center justify-center gap-2"
                    >
                      <Check className="w-5 h-5" />
                      Scan Receipt
                    </button>
                  )}
                  <button
                    onClick={handleRetake}
                    className="px-6 py-3 rounded-xl transition-colors font-medium"
                    style={{ border: '2px solid var(--color-border-card)', color: 'var(--color-text-secondary)' }}
                  >
                    Retake
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Instructions */}
          <div className="mt-6 rounded-xl p-4 text-sm"
            style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
            <p className="font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>Tips for best results:</p>
            <ul className="list-disc list-inside space-y-1" style={{ color: 'var(--color-text-secondary)' }}>
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
