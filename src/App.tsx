/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic, 
  Type, 
  Send, 
  Sparkles, 
  X, 
  Copy, 
  Check,
  Image as ImageIcon,
  Video as VideoIcon,
  ChevronRight,
  Loader2,
  Upload,
  ImagePlus
} from 'lucide-react';
import { generateDetailedPrompts, GeneratedPrompts, transcribeAudio, generatePromptsFromImage } from './services/promptService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [inputMode, setInputMode] = useState<'voice' | 'text' | 'image'>('voice');
  const [isRecording, setIsRecording] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [imageFile, setImageFile] = useState<{ file: File, preview: string } | null>(null);
  const [selectedStyle, setSelectedStyle] = useState('Cinematic');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState('16:9');
  const [targetType, setTargetType] = useState<'image' | 'video' | 'both'>('both');
  const [loading, setLoading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [result, setResult] = useState<GeneratedPrompts | null>(null);
  const [copied, setCopied] = useState<'image' | 'video' | null>(null);

  const recognitionRef = useRef<any>(null);

  // Load saved state on mount
  useEffect(() => {
    const savedText = localStorage.getItem('promptcraft_text');
    const savedStyle = localStorage.getItem('promptcraft_style');
    const savedRatio = localStorage.getItem('promptcraft_ratio');

    if (savedText) setTextInput(savedText);
    if (savedStyle) setSelectedStyle(savedStyle);
    if (savedRatio) setSelectedAspectRatio(savedRatio);
  }, []);

  // Auto-save on changes
  useEffect(() => {
    localStorage.setItem('promptcraft_text', textInput);
  }, [textInput]);

  useEffect(() => {
    localStorage.setItem('promptcraft_style', selectedStyle);
  }, [selectedStyle]);

  useEffect(() => {
    localStorage.setItem('promptcraft_ratio', selectedAspectRatio);
  }, [selectedAspectRatio]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Initialize Web Speech API for real-time feedback
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        
        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          setTextInput(currentTranscript);
        };

        recognition.start();
        recognitionRef.current = recognition;
      }

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await handleAudioTranscription(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleAudioTranscription = async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];
        const transcription = await transcribeAudio(base64Audio, blob.type);
        if (transcription) {
          setTextInput(transcription);
          // Auto-generate after transcription if it's substantial
          if (transcription.length > 5) {
            // We need to use the transcription directly here because setTextInput is async
            generateFromText(transcription);
          }
        }
      };
    } catch (error) {
      console.error("Transcription failed:", error);
    } finally {
      setIsTranscribing(false);
    }
  };

  const generateFromText = async (text: string) => {
    setLoading(true);
    try {
      const prompts = await generateDetailedPrompts(text, selectedStyle, "Epic", selectedAspectRatio, targetType);
      setResult(prompts);
    } catch (error) {
      console.error(error);
      alert("Failed to generate prompts.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (inputMode === 'text' && !textInput.trim()) return;
    if (inputMode === 'image' && !imageFile) return;

    setLoading(true);
    try {
      let prompts: GeneratedPrompts;
      if (inputMode === 'image' && imageFile) {
        const reader = new FileReader();
        reader.readAsDataURL(imageFile.file);
        prompts = await new Promise((resolve, reject) => {
          reader.onloadend = async () => {
            try {
              const base64Image = (reader.result as string).split(',')[1];
              const res = await generatePromptsFromImage(base64Image, imageFile.file.type, selectedStyle, selectedAspectRatio, targetType);
              resolve(res);
            } catch (err) {
              reject(err);
            }
          };
          reader.onerror = reject;
        });
      } else {
        const promptText = textInput || (inputMode === 'voice' ? "A cinematic shot of a futuristic city" : "");
        prompts = await generateDetailedPrompts(promptText, selectedStyle, "Epic", selectedAspectRatio, targetType);
      }
      setResult(prompts);
    } catch (error) {
      console.error(error);
      alert("Failed to generate prompts.");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const preview = URL.createObjectURL(file);
      setImageFile({ file, preview });
    }
  };

  const removeImage = () => {
    if (imageFile) {
      URL.revokeObjectURL(imageFile.preview);
      setImageFile(null);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const copyToClipboard = (text: string, type: 'image' | 'video') => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#F9FAFB]">
      {/* Header Section */}
      <div className="text-center mb-12 max-w-2xl">
        <motion.h1 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[44px] font-[800] tracking-tight text-[#111827] mb-4 leading-tight"
        >
          Describe your vision.
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-[18px] text-[#6B7280] leading-relaxed px-4"
        >
          Speak naturally about your vision, what's in focus, and the mood. We'll structure it into perfect image and video prompts.
        </motion.p>
      </div>

      {/* Main Interaction Card */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-[800px] bg-white rounded-[24px] border border-[#E5E7EB] card-shadow overflow-hidden flex flex-col min-h-[480px]"
      >
        {/* Card Header */}
        <div className="p-8 flex items-center justify-between border-b border-[#F3F4F6]">
          <div className="flex flex-col gap-1">
            <h2 className="text-[20px] font-semibold text-[#111827]">Prompt</h2>
            <p className="text-xs text-[#9CA3AF]">Choose your input method</p>
          </div>
          
          <div className="flex bg-[#F3F4F6] p-1 rounded-xl">
            <button 
              onClick={() => setInputMode('voice')}
              className={cn(
                "p-2 rounded-lg transition-all flex items-center justify-center",
                inputMode === 'voice' ? "bg-white shadow-sm text-[#111827]" : "text-[#9CA3AF]"
              )}
            >
              <Mic size={20} />
            </button>
            <button 
              onClick={() => setInputMode('text')}
              className={cn(
                "p-2 rounded-lg transition-all flex items-center justify-center",
                inputMode === 'text' ? "bg-white shadow-sm text-[#111827]" : "text-[#9CA3AF]"
              )}
            >
              <Type size={20} />
            </button>
            <button 
              onClick={() => setInputMode('image')}
              className={cn(
                "p-2 rounded-lg transition-all flex items-center justify-center",
                inputMode === 'image' ? "bg-white shadow-sm text-[#111827]" : "text-[#9CA3AF]"
              )}
            >
              <ImagePlus size={20} />
            </button>
          </div>
        </div>

        {/* Style & Aspect Ratio Selection */}
        <div className="px-8 py-4 bg-[#F9FAFB] border-b border-[#F3F4F6] space-y-4">
          <div className="flex items-center gap-4 overflow-x-auto no-scrollbar pb-1">
            <span className="text-xs font-bold text-[#6B7280] uppercase tracking-wider whitespace-nowrap">Style:</span>
            {['Cinematic', 'Photorealistic', 'Anime', 'Abstract', '3D Render', 'Cyberpunk'].map((style) => (
              <button
                key={style}
                onClick={() => setSelectedStyle(style)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap",
                  selectedStyle === style 
                    ? "bg-[#111827] text-white shadow-md" 
                    : "bg-white text-[#6B7280] border border-[#E5E7EB] hover:border-[#D1D5DB]"
                )}
              >
                {style}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4 overflow-x-auto no-scrollbar pb-1">
            <span className="text-xs font-bold text-[#6B7280] uppercase tracking-wider whitespace-nowrap">Ratio:</span>
            {['1:1', '16:9', '9:16', '4:3', '21:9'].map((ratio) => (
              <button
                key={ratio}
                onClick={() => setSelectedAspectRatio(ratio)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap",
                  selectedAspectRatio === ratio 
                    ? "bg-[#111827] text-white shadow-md" 
                    : "bg-white text-[#6B7280] border border-[#E5E7EB] hover:border-[#D1D5DB]"
                )}
              >
                {ratio}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4 overflow-x-auto no-scrollbar pb-1">
            <span className="text-xs font-bold text-[#6B7280] uppercase tracking-wider whitespace-nowrap">Target:</span>
            {[
              { id: 'image', label: 'Image Prompt' },
              { id: 'video', label: 'Video Prompt' },
              { id: 'both', label: 'Both' }
            ].map((target) => (
              <button
                key={target.id}
                onClick={() => setTargetType(target.id as any)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap",
                  targetType === target.id 
                    ? "bg-indigo-600 text-white shadow-md" 
                    : "bg-white text-[#6B7280] border border-[#E5E7EB] hover:border-[#D1D5DB]"
                )}
              >
                {target.label}
              </button>
            ))}
          </div>
        </div>

        {/* Card Body */}
        <div className="flex-1 flex flex-col items-center justify-center px-12 pb-8">
          <AnimatePresence mode="wait">
            {inputMode === 'voice' ? (
              <motion.div 
                key="voice-mode"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center"
              >
                <button 
                  onClick={toggleRecording}
                  disabled={isTranscribing}
                  className={cn(
                    "w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 relative",
                    isRecording ? "bg-red-500 scale-110 shadow-lg shadow-red-200" : "bg-[#111827] hover:bg-[#1F2937]",
                    isTranscribing && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isRecording && (
                    <motion.div 
                      animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-0 bg-red-500 rounded-full"
                    />
                  )}
                  {isTranscribing ? (
                    <Loader2 size={32} className="text-white animate-spin relative z-10" />
                  ) : (
                    <Mic size={32} className="text-white relative z-10" />
                  )}
                </button>
                <p className="mt-6 text-[#6B7280] font-medium">
                  {isRecording ? "Listening..." : isTranscribing ? "Transcribing..." : "Tap to start speaking"}
                </p>
                {textInput && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 text-center max-w-md bg-gray-50/50 p-4 rounded-2xl border border-gray-100"
                  >
                    <p className={cn(
                      "text-sm leading-relaxed transition-opacity duration-300",
                      isRecording ? "text-[#111827] font-medium" : "text-gray-500 italic"
                    )}>
                      {isRecording ? textInput : `"${textInput}"`}
                    </p>
                    {!isRecording && !isTranscribing && (
                      <div className="flex flex-col items-center gap-2 mt-3">
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-50 text-green-600 rounded-full text-[10px] font-bold uppercase tracking-wider border border-green-100">
                          <Check size={10} />
                          Transcription Ready
                        </div>
                        <button 
                          onClick={() => setTextInput('')}
                          className="text-xs text-indigo-500 hover:underline font-medium"
                        >
                          Clear transcription
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            ) : inputMode === 'text' ? (
              <motion.div 
                key="text-mode"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="w-full"
              >
                <textarea 
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Describe your vision here..."
                  className="w-full h-40 bg-transparent text-[20px] text-[#111827] placeholder-[#9CA3AF] resize-none border-none focus:ring-0 p-0 leading-relaxed"
                  autoFocus
                />
              </motion.div>
            ) : (
              <motion.div 
                key="image-mode"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full flex flex-col items-center"
              >
                {imageFile ? (
                  <div className="relative group">
                    <img 
                      src={imageFile.preview} 
                      alt="Preview" 
                      className="max-h-64 rounded-2xl border border-gray-200 shadow-sm"
                    />
                    <button 
                      onClick={removeImage}
                      className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-md border border-gray-100 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <label className="w-full h-64 border-2 border-dashed border-gray-200 rounded-[24px] flex flex-col items-center justify-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group">
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleImageUpload}
                    />
                    <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-white group-hover:text-indigo-500 transition-all shadow-sm">
                      <Upload size={24} />
                    </div>
                    <p className="mt-4 text-sm font-medium text-gray-500 group-hover:text-gray-700">Click to upload an image</p>
                    <p className="mt-1 text-xs text-gray-400">PNG, JPG or WEBP up to 10MB</p>
                  </label>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Card Footer */}
        <div className="p-8 pt-0 flex justify-end">
          <button 
            onClick={handleGenerate}
            disabled={loading || (inputMode === 'text' && !textInput.trim()) || (inputMode === 'image' && !imageFile)}
            className="bg-[#8E8E93] hover:bg-[#71717A] disabled:opacity-50 text-white px-8 py-4 rounded-2xl font-semibold flex items-center gap-3 transition-all active:scale-95"
          >
            {loading ? "Generating..." : "Generate Prompts"}
            <Send size={18} />
          </button>
        </div>
      </motion.div>

      {/* Results Section */}
      <AnimatePresence>
        {result && (
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-[800px] mt-8 space-y-4"
          >
            {result.explanation && (
              <div className="bg-white rounded-[24px] border border-[#E5E7EB] p-8 card-shadow">
                <div className="flex items-center gap-3 text-[#111827] mb-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                    <Sparkles size={20} />
                  </div>
                  <h3 className="font-bold text-lg">Creative Reasoning</h3>
                </div>
                <p className="text-[#6B7280] text-md leading-relaxed italic border-l-2 border-amber-200 pl-4">
                  {result.explanation}
                </p>
              </div>
            )}

            {result.imagePrompt && (
              <div className="bg-white rounded-[24px] border border-[#E5E7EB] p-8 card-shadow">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3 text-[#111827]">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                      <ImageIcon size={20} />
                    </div>
                    <h3 className="font-bold text-lg">Image Prompt</h3>
                  </div>
                  <button 
                    onClick={() => copyToClipboard(result.imagePrompt!, 'image')}
                    className="p-2 hover:bg-gray-50 rounded-lg transition-colors text-gray-400 hover:text-gray-900"
                  >
                    {copied === 'image' ? <Check size={20} className="text-green-500" /> : <Copy size={20} />}
                  </button>
                </div>
                <p className="text-[#374151] text-lg leading-relaxed bg-[#F9FAFB] p-6 rounded-2xl border border-[#F3F4F6]">
                  {result.imagePrompt}
                </p>
              </div>
            )}

            {result.videoPrompt && (
              <div className="bg-white rounded-[24px] border border-[#E5E7EB] p-8 card-shadow">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3 text-[#111827]">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                      <VideoIcon size={20} />
                    </div>
                    <h3 className="font-bold text-lg">Video Prompt</h3>
                  </div>
                  <button 
                    onClick={() => copyToClipboard(result.videoPrompt!, 'video')}
                    className="p-2 hover:bg-gray-50 rounded-lg transition-colors text-gray-400 hover:text-gray-900"
                  >
                    {copied === 'video' ? <Check size={20} className="text-green-500" /> : <Copy size={20} />}
                  </button>
                </div>
                <p className="text-[#374151] text-lg leading-relaxed bg-[#F9FAFB] p-6 rounded-2xl border border-[#F3F4F6]">
                  {result.videoPrompt}
                </p>
              </div>
            )}
            
            <button 
              onClick={() => setResult(null)}
              className="w-full py-4 text-gray-400 hover:text-gray-600 text-sm font-medium transition-colors"
            >
              Clear and start over
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action for Demo */}
      <div className="fixed bottom-8 right-8">
        <div className="bg-white px-4 py-2 rounded-full border border-[#E5E7EB] shadow-sm flex items-center gap-2 text-xs font-medium text-gray-500">
          <Sparkles size={14} className="text-indigo-500" />
          Powered by Gemini 3.1 Flash
        </div>
      </div>
    </div>
  );
}
