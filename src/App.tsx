/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Image as ImageIcon, Download, RefreshCw, Palette, SlidersHorizontal, Droplet, Sparkles } from 'lucide-react';

type ColorBucket = {
  id: string;
  name: string;
  hueRange: [number, number][];
  lightRange?: [number, number];
  satRange?: [number, number];
  color: string;
};

type DetectedColor = ColorBucket & { percentage: number };

const COLOR_BUCKETS: ColorBucket[] = [
  { id: 'dark-red', name: 'Đỏ đậm', hueRange: [[345, 360], [0, 15]], lightRange: [10, 45], color: '#7F1D1D' },
  { id: 'red', name: 'Đỏ tươi', hueRange: [[345, 360], [0, 15]], lightRange: [45, 85], color: '#EF4444' },
  { id: 'brown', name: 'Nâu', hueRange: [[15, 40]], lightRange: [10, 40], color: '#78350F' },
  { id: 'orange', name: 'Cam', hueRange: [[15, 40]], lightRange: [40, 85], color: '#F97316' },
  { id: 'olive', name: 'Vàng rêu', hueRange: [[40, 65]], lightRange: [10, 40], color: '#4D7C0F' },
  { id: 'yellow', name: 'Vàng', hueRange: [[40, 65]], lightRange: [40, 85], color: '#EAB308' },
  { id: 'lime', name: 'Xanh chuối', hueRange: [[65, 85]], color: '#84CC16' },
  { id: 'dark-green', name: 'Xanh lá đậm', hueRange: [[85, 150]], lightRange: [10, 40], color: '#14532D' },
  { id: 'green', name: 'Xanh lá', hueRange: [[85, 150]], lightRange: [40, 85], color: '#22C55E' },
  { id: 'teal', name: 'Xanh cổ vịt', hueRange: [[150, 175]], color: '#0F766E' },
  { id: 'cyan', name: 'Xanh lơ', hueRange: [[175, 195]], color: '#06B6D4' },
  { id: 'sky-blue', name: 'Xanh da trời', hueRange: [[195, 215]], lightRange: [40, 85], color: '#38BDF8' },
  { id: 'dark-blue', name: 'Xanh dương đậm', hueRange: [[215, 250]], lightRange: [10, 40], color: '#1E3A8A' },
  { id: 'blue', name: 'Xanh dương', hueRange: [[215, 250]], lightRange: [40, 85], color: '#3B82F6' },
  { id: 'indigo', name: 'Chàm', hueRange: [[250, 270]], color: '#4338CA' },
  { id: 'dark-purple', name: 'Tím đậm', hueRange: [[270, 295]], lightRange: [10, 40], color: '#581C87' },
  { id: 'purple', name: 'Tím', hueRange: [[270, 295]], lightRange: [40, 85], color: '#A855F7' },
  { id: 'fuchsia', name: 'Hồng tím', hueRange: [[295, 325]], color: '#D946EF' },
  { id: 'pink', name: 'Hồng', hueRange: [[325, 345]], color: '#EC4899' },
];

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}

export default function App() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [detectedColors, setDetectedColors] = useState<DetectedColor[]>([]);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [tolerance, setTolerance] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImageSrc(url);
      setSelectedColor(null);
      setDetectedColors([]);
      setTolerance(0);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setImageSrc(url);
      setSelectedColor(null);
      setDetectedColors([]);
      setTolerance(0);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 1;
    tempCanvas.height = 1;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    tempCtx.drawImage(img, -x, -y);
    const [r, g, b, a] = tempCtx.getImageData(0, 0, 1, 1).data;

    if (a < 128) return;

    const [h, s, l] = rgbToHsl(r, g, b);

    if (s < 10 || l < 10 || l > 95) {
      setSelectedColor(null);
      return;
    }

    let matchedBucketId = null;
    for (const bucket of COLOR_BUCKETS) {
      const sMin = bucket.satRange ? bucket.satRange[0] : 15;
      const sMax = bucket.satRange ? bucket.satRange[1] : 100;
      const lMin = bucket.lightRange ? bucket.lightRange[0] : 15;
      const lMax = bucket.lightRange ? bucket.lightRange[1] : 85;

      if (s >= sMin && s <= sMax && l >= lMin && l <= lMax) {
        for (const range of bucket.hueRange) {
          if (h >= range[0] && h <= range[1]) {
            matchedBucketId = bucket.id;
            break;
          }
        }
      }
      if (matchedBucketId) break;
    }

    if (!matchedBucketId) {
      let minDiff = Infinity;
      for (const bucket of COLOR_BUCKETS) {
        for (const range of bucket.hueRange) {
          const midHue = (range[0] + range[1]) / 2;
          const diff = Math.min(Math.abs(h - midHue), 360 - Math.abs(h - midHue));
          if (diff < minDiff) {
            minDiff = diff;
            matchedBucketId = bucket.id;
          }
        }
      }
    }

    if (matchedBucketId) {
      setSelectedColor(matchedBucketId);
      setTolerance(0);
    }
  };

  const analyzeColors = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const MAX_SIZE = 300;
    let width = img.width;
    let height = img.height;
    if (width > height) {
      if (width > MAX_SIZE) {
        height *= MAX_SIZE / width;
        width = MAX_SIZE;
      }
    } else {
      if (height > MAX_SIZE) {
        width *= MAX_SIZE / height;
        height = MAX_SIZE;
      }
    }
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const colorCounts: Record<string, number> = {};
    COLOR_BUCKETS.forEach(b => colorCounts[b.id] = 0);
    let totalValidPixels = 0;

    const hueTolerance = tolerance * 0.8;
    const lightTolerance = tolerance * 0.6;
    const satTolerance = tolerance * 0.6;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i+1];
      const b = data[i+2];
      const a = data[i+3];
      if (a < 128) continue;
      
      totalValidPixels++;

      const [h, s, l] = rgbToHsl(r, g, b);
      if (s < 10 || l < 10 || l > 95) continue;

      for (const bucket of COLOR_BUCKETS) {
        const baseSMin = bucket.satRange ? bucket.satRange[0] : 15;
        const baseSMax = bucket.satRange ? bucket.satRange[1] : 100;
        const baseLMin = bucket.lightRange ? bucket.lightRange[0] : 15;
        const baseLMax = bucket.lightRange ? bucket.lightRange[1] : 85;

        const sMin = Math.max(0, baseSMin - satTolerance);
        const sMax = Math.min(100, baseSMax + satTolerance);
        const lMin = Math.max(0, baseLMin - lightTolerance);
        const lMax = Math.min(100, baseLMax + lightTolerance);

        if (sMin > sMax || lMin > lMax) continue;

        if (s >= sMin && s <= sMax && l >= lMin && l <= lMax) {
          let match = false;
          for (const range of bucket.hueRange) {
            const hMin = range[0] - hueTolerance;
            const hMax = range[1] + hueTolerance;
            if (hMin > hMax) continue;
            
            if (hMin < 0 && h >= hMin + 360) match = true;
            else if (hMax > 360 && h <= hMax - 360) match = true;
            else if (h >= hMin && h <= hMax) match = true;
            
            if (match) break;
          }
          if (match) {
            colorCounts[bucket.id]++;
            break;
          }
        }
      }
    }

    const detected = COLOR_BUCKETS.map(b => ({
      ...b,
      percentage: totalValidPixels > 0 ? (colorCounts[b.id] / totalValidPixels) * 100 : 0
    })).filter(b => b.percentage > 0.1).sort((a, b) => b.percentage - a.percentage);

    setDetectedColors(detected);
  }, [tolerance]);

  const applyFilter = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    if (!selectedColor) return;

    const bucket = COLOR_BUCKETS.find(b => b.id === selectedColor);
    if (!bucket) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const hueTolerance = tolerance * 0.8;
    const lightTolerance = tolerance * 0.6;
    const satTolerance = tolerance * 0.6;

    const baseSMin = bucket.satRange ? bucket.satRange[0] : 15;
    const baseSMax = bucket.satRange ? bucket.satRange[1] : 100;
    const baseLMin = bucket.lightRange ? bucket.lightRange[0] : 15;
    const baseLMax = bucket.lightRange ? bucket.lightRange[1] : 85;

    const sMin = Math.max(0, baseSMin - satTolerance);
    const sMax = Math.min(100, baseSMax + satTolerance);
    const lMin = Math.max(0, baseLMin - lightTolerance);
    const lMax = Math.min(100, baseLMax + lightTolerance);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i+1];
      const b = data[i+2];

      const [h, s, l] = rgbToHsl(r, g, b);
      
      let match = false;
      
      if (sMin <= sMax && lMin <= lMax && s >= sMin && s <= sMax && l >= lMin && l <= lMax) {
        for (const range of bucket.hueRange) {
          const hMin = range[0] - hueTolerance;
          const hMax = range[1] + hueTolerance;
          if (hMin > hMax) continue;
          
          if (hMin < 0 && h >= hMin + 360) match = true;
          else if (hMax > 360 && h <= hMax - 360) match = true;
          else if (h >= hMin && h <= hMax) match = true;
          
          if (match) break;
        }
      }

      if (!match) {
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        data[i] = gray;
        data[i+1] = gray;
        data[i+2] = gray;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }, [selectedColor, tolerance]);

  useEffect(() => {
    if (!imageSrc) return;
    setIsProcessing(true);
    const timer = setTimeout(() => {
      analyzeColors();
      applyFilter();
      setIsProcessing(false);
    }, 10);
    return () => clearTimeout(timer);
  }, [imageSrc, selectedColor, tolerance, analyzeColors, applyFilter]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `color-splash-${selectedColor || 'original'}.png`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 text-slate-800 font-sans selection:bg-pink-200 flex flex-col">
      <header className="bg-white/60 backdrop-blur-xl border-b border-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-pink-400 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg shadow-pink-200 text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500">
              🌈 Sân chơi cầu vồng - Color Splash
            </h1>
          </div>
          {imageSrc && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-sm font-bold text-slate-500 hover:text-pink-500 bg-white hover:bg-pink-50 px-5 py-2.5 rounded-full shadow-sm border border-pink-100 transition-all flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Ảnh khác nha!</span>
              </button>
              <button
                onClick={handleDownload}
                className="text-sm font-bold bg-gradient-to-r from-pink-400 to-purple-400 hover:from-pink-500 hover:to-purple-500 text-white px-6 py-2.5 rounded-full transition-all flex items-center gap-2 shadow-lg shadow-pink-200 hover:shadow-pink-300 hover:-translate-y-0.5"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Tải xuống nè 💖</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 flex-1 w-full flex flex-col">
        {!imageSrc ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-4 border-dashed border-pink-200 hover:border-pink-400 bg-white/50 hover:bg-white/80 rounded-[3rem] p-12 flex flex-col items-center justify-center flex-1 cursor-pointer transition-all group shadow-sm hover:shadow-md"
          >
            <div className="w-24 h-24 bg-pink-100 group-hover:bg-pink-200 rounded-full flex items-center justify-center mb-6 transition-colors shadow-inner">
              <Upload className="w-10 h-10 text-pink-500 group-hover:text-pink-600 group-hover:scale-110 transition-transform" />
            </div>
            <h2 className="text-2xl font-bold text-slate-700 mb-3">Thả ảnh vào đây nào! ✨</h2>
            <p className="text-slate-500 text-center max-w-sm text-lg">
              Kéo thả ảnh vào đây hoặc click để chọn một bức ảnh thật xinh từ máy của bạn nhé.
            </p>
          </div>
        ) : (
          <div className="space-y-8 flex-1 flex flex-col">
            <div className="relative bg-white rounded-[2.5rem] overflow-hidden border-4 border-white shadow-xl shadow-purple-100/50 flex items-center justify-center flex-1 min-h-[400px]">
              {isProcessing && (
                <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-10">
                  <div className="flex flex-col items-center gap-3 bg-white px-6 py-4 rounded-3xl shadow-xl shadow-pink-100">
                    <RefreshCw className="w-8 h-8 text-pink-400 animate-spin" />
                    <span className="text-sm font-bold text-pink-500">Đang tô màu... 🎨</span>
                  </div>
                </div>
              )}
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                className="max-w-full max-h-[60vh] object-contain cursor-crosshair hover:opacity-95 transition-opacity rounded-[2rem]"
                title="Click vào một vùng màu để chọn nha!"
              />
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Original"
                className="hidden"
              />
            </div>

            <p className="text-center text-base text-slate-500 font-medium">
              💡 <strong className="text-pink-500">Mẹo nhỏ:</strong> Click trực tiếp chiếc đũa thần (chuột) vào một vùng màu trên ảnh để lọc nhanh màu đó nha! ✨
            </p>
            
            <div className="bg-white/80 backdrop-blur-md border-2 border-white rounded-[2.5rem] p-8 shadow-xl shadow-pink-100/50 space-y-8">
              
              {/* Nút Chế độ Full Màu nổi bật */}
              <div className="flex items-center justify-between border-b border-pink-100 pb-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                    <ImageIcon className="w-6 h-6 text-pink-400" />
                    Chế độ hiển thị
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">Chọn xem ảnh gốc rực rỡ hoặc lọc theo từng màu sắc.</p>
                </div>
                <button
                  onClick={() => setSelectedColor(null)}
                  className={`flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-extrabold transition-all ${
                    selectedColor === null
                      ? 'bg-gradient-to-r from-rose-400 via-fuchsia-400 to-blue-400 text-white shadow-xl shadow-pink-200 scale-105'
                      : 'bg-slate-100 text-slate-500 hover:bg-pink-50 hover:text-pink-600'
                  }`}
                >
                  <Sparkles className="w-5 h-5" />
                  FULL MÀU (ẢNH GỐC) 🌈
                </button>
              </div>

              {/* Tolerance Slider */}
              <div className="pt-2 bg-pink-50/50 p-6 rounded-3xl border border-pink-100">
                <div className="flex items-center justify-between mb-4">
                  <label className="text-base font-bold text-slate-700 flex items-center gap-2">
                    <SlidersHorizontal className="w-5 h-5 text-pink-400" />
                    Độ mở rộng vùng màu (Tolerance)
                  </label>
                  <span className="text-sm font-bold text-pink-600 bg-pink-100 px-3 py-1.5 rounded-xl shadow-sm">
                    {tolerance > 0 ? '+' : ''}{tolerance}%
                  </span>
                </div>
                <input
                  type="range"
                  min="-20"
                  max="50"
                  step="0.5"
                  value={tolerance}
                  onChange={(e) => setTolerance(Number(e.target.value))}
                  className="w-full h-3 bg-pink-200 rounded-full appearance-none cursor-pointer accent-pink-500 shadow-inner"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-2 px-2 font-bold">
                  <span>Khắt khe hơn (-20)</span>
                  <span>Mặc định (0)</span>
                  <span>Mở rộng (+50)</span>
                </div>
                <p className="text-sm text-slate-500 mt-3 text-center">
                  Kéo sang trái để lọc màu chính xác tuyệt đối, kéo sang phải để lấy thêm các màu có sắc độ gần giống.
                </p>
              </div>

              {/* Detected Colors */}
              <div className="pt-4">
                <h3 className="text-base font-bold text-slate-700 uppercase tracking-wider mb-6 flex items-center gap-2">
                  <Droplet className="w-5 h-5 text-blue-400" />
                  Màu sắc tìm thấy trong ảnh
                </h3>
                
                {detectedColors.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                    <p className="text-slate-500 font-medium">Đang phân tích hoặc không tìm thấy màu nổi bật nào cả... 🕵️‍♀️</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 max-h-[350px] overflow-y-auto pr-3 custom-scrollbar">
                    {detectedColors.map((color, index) => (
                      <button
                        key={color.id}
                        onClick={() => setSelectedColor(color.id)}
                        className={`flex items-center justify-between px-5 py-4 rounded-2xl text-sm font-medium transition-all border-2 ${
                          selectedColor === color.id
                            ? 'bg-white border-pink-400 shadow-lg shadow-pink-100 scale-[1.02]'
                            : 'bg-white border-slate-100 hover:border-pink-200 hover:shadow-md text-slate-600'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-pink-400 font-extrabold text-base w-6 text-left">#{index + 1}</span>
                          <span
                            className="w-8 h-8 rounded-full shadow-sm border-2 border-white ring-2 ring-slate-100"
                            style={{ backgroundColor: color.color }}
                          />
                          <span className="font-bold text-base text-slate-700">{color.name}</span>
                          <span className="text-slate-400 font-mono text-xs bg-slate-100 px-2 py-1 rounded-lg">
                            {color.color}
                          </span>
                        </div>
                        <span className="text-sm font-bold bg-pink-50 text-pink-600 px-3 py-1.5 rounded-xl border border-pink-100">
                          {color.percentage.toFixed(2)}%
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*"
          className="hidden"
        />
      </main>
    </div>
  );
}
