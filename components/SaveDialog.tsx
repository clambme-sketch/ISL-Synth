
import React, { useState, useEffect, useRef } from 'react';

interface SaveDialogProps {
  isOpen: boolean;
  title: string;
  defaultValue: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export const SaveDialog: React.FC<SaveDialogProps> = ({ isOpen, title, defaultValue, onConfirm, onCancel }) => {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      // Focus input on open
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(value || defaultValue);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-synth-gray-800 p-6 rounded-xl border border-synth-gray-600 shadow-2xl w-full max-w-md transform transition-all scale-100">
        <h3 className="text-xl font-bold text-white mb-4">{title}</h3>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="filename" className="block text-sm font-medium text-synth-gray-400 mb-1">
              Name
            </label>
            <input
              ref={inputRef}
              id="filename"
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full bg-synth-gray-900 border border-synth-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[rgb(var(--accent-500))] focus:ring-1 focus:ring-[rgb(var(--accent-500))]"
              placeholder="Enter file name..."
            />
          </div>
          
          <div className="flex justify-end gap-3 mt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-bold text-synth-gray-400 hover:text-white bg-transparent hover:bg-synth-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 text-sm font-bold text-synth-gray-900 bg-[rgb(var(--accent-500))] hover:bg-[rgb(var(--accent-400))] rounded-lg shadow-lg shadow-[rgba(var(--accent-500),0.2)] transition-all transform active:scale-95"
            >
              Save File
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
