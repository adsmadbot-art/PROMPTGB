import React from 'react';
import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';

export const LoadingSpinner = () => {
  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-6">
      <div className="relative">
        {/* Outer rotating ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-20 h-20 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full"
        />
        
        {/* Inner pulsing icon */}
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 flex items-center justify-center text-indigo-400"
        >
          <Sparkles size={32} />
        </motion.div>
      </div>
      
      <div className="text-center space-y-2">
        <motion.h3 
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-lg font-semibold text-zinc-200"
        >
          AI is Crafting...
        </motion.h3>
        <p className="text-sm text-zinc-500 max-w-xs mx-auto">
          Analyzing your idea and expanding it into cinematic details.
        </p>
      </div>
    </div>
  );
};
