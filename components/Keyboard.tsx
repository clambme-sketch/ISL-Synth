import React, { useRef, useEffect, useCallback } from 'react';
import { KEYBOARD_NOTES, KEY_MAP } from '../constants';
import { getSolfegeSyllable, formatNoteName } from '../services/musicTheory';

interface KeyboardProps {
  onNoteDown: (note: string) => void;
  onNoteUp: (note: string) => void;
  highlightedNotes: Map<string, string[]>;
  octaveOffset: number;
  keyboardDisplayMode: 'noteNames' | 'notation' | 'solfege' | 'hz';
  solfegeKey: string;
  preferFlats: boolean;
  noteFrequencies: Map<string, number>;
}

const computerKeyMap = Object.entries(KEY_MAP).reduce((acc, [key, note]) => {
  if (!acc[note]) {
    acc[note] = key.toUpperCase();
  }
  return acc;
}, {} as Record<string, string>);


// --- Animated Frequency Component for "Hz" mode ---
const AnimatedDigit: React.FC<{ digit: string }> = React.memo(({ digit }) => {
    const REEL = '9876543210';
    const digitIndex = REEL.indexOf(digit);
    const yOffset = digitIndex * -1;
    return (
        <div style={{ height: '1em', lineHeight: '1em', overflow: 'hidden', display: 'inline-block' }}>
            <div
                className="transition-transform duration-500"
                style={{ transform: `translateY(${yOffset}em)`, transitionTimingFunction: 'cubic-bezier(0.2, 1, 0.3, 1)' }}
            >
                {REEL.split('').map((d) => (<div key={d} style={{ height: '1em' }}>{d}</div>))}
            </div>
        </div>
    );
});

const AnimatedFrequency: React.FC<{ freq: number | undefined; textColor: string }> = React.memo(({ freq, textColor }) => {
    const formattedFreq = freq !== undefined ? freq.toFixed(1).padStart(6, ' ') : '   -.-';
    const chars = formattedFreq.split('');
    return (
        <div className={`h-6 w-full flex items-center justify-center ${textColor}`}>
            <div className="flex items-center text-lg font-sans font-semibold tabular-nums" style={{ lineHeight: '1em' }}>
                {chars.map((char, index) => {
                    if (char === ' ') return <div key={index} style={{ width: '0.6em' }} />;
                    if (char === '.') return <div key={index} style={{ width: '0.3em' }}>.</div>;
                    if (char === '-') return <div key={index} style={{ width: '0.6em' }}>-</div>;
                    return <AnimatedDigit key={index} digit={char} />;
                })}
            </div>
            <span className="text-xs ml-1 opacity-70">Hz</span>
        </div>
    );
});


// --- Musical Notation Component Helpers ---
const transposeNote = (note: string, octaveOffset: number): string => {
    if (octaveOffset === 0) return note;
    const match = note.match(/([A-G]#?)([0-9])/);
    if (match) {
        return `${match[1]}${parseInt(match[2], 10) + octaveOffset}`;
    }
    return note;
};

const getStaffPosition = (note: string, clef: 'treble' | 'bass'): number | null => {
    const match = note.match(/([A-G])(♭|#)?([0-9])/);
    if (!match) return null;
    const noteMap: { [key: string]: number } = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
    const currentNoteValue = noteMap[match[1]] + parseInt(match[3], 10) * 7;
    const refValue = clef === 'treble' ? (noteMap['E'] + 28) : (noteMap['G'] + 14); // E4 or G2
    return (currentNoteValue - refValue) / 2;
}

// --- Musical Notation Component ---
interface MusicalNotationProps {
  note: string;
  octaveOffset: number;
  highlightTypes: string[];
  displayClef: boolean;
  clef: 'treble' | 'bass';
  keyType: 'white' | 'black';
  keyboardDisplayMode: 'noteNames' | 'notation' | 'solfege' | 'hz';
  solfegeKey: string;
  preferFlats: boolean;
  freq: number | undefined;
}

const MusicalNotation = React.memo(({ 
    note, octaveOffset, highlightTypes, displayClef, clef, keyType,
    keyboardDisplayMode, solfegeKey, preferFlats, freq
}: MusicalNotationProps) => {
    const finalNoteInternal = transposeNote(note, octaveOffset);
    const displayNote = formatNoteName(finalNoteInternal, preferFlats);
    const staffPosition = getStaffPosition(displayNote, clef);
    const shouldShowFullNotation = staffPosition !== null;

    let noteColor: string, accidentalColor: string, textColor: string;
    const isActive = highlightTypes.includes('active');
    const hasHighlight = highlightTypes.length > 0;

    if (keyType === 'white') {
        noteColor = isActive ? '#1E1E1E' : (hasHighlight ? '#FFFFFF' : '#3D3D3D');
        accidentalColor = isActive ? '#121212' : (hasHighlight ? '#FFFFFF' : '#1E1E1E');
        textColor = isActive ? 'text-synth-gray-800' : (hasHighlight ? 'text-white' : 'text-synth-gray-500');
    } else { 
        noteColor = hasHighlight ? '#FFFFFF' : '#9CA3AF';
        accidentalColor = hasHighlight ? '#FFFFFF' : '#9CA3AF';
        textColor = hasHighlight ? 'text-white' : 'text-gray-400';
    }

    if (keyboardDisplayMode === 'hz' && isActive) {
        return (
            <div className="h-6 mb-1 w-full flex items-center justify-center px-1">
                <AnimatedFrequency freq={freq} textColor={textColor} />
            </div>
        );
    }

    if (keyboardDisplayMode === 'notation' && shouldShowFullNotation) {
        const isSharp = displayNote.includes('#');
        const isFlat = displayNote.includes('♭');
        const hasClef = displayClef;
        const clefSectionWidth = hasClef ? 45 : 0;
        const staffX = clefSectionWidth;
        const lineSpacing = 3;
        const staffTopY = 4;
        const noteY = staffTopY + (4 - staffPosition) * lineSpacing;
        const noteHeadTopY = noteY - 2;
        let viewBoxY = 0;
        let viewBoxHeight = 24;

        if (noteHeadTopY < viewBoxY) {
            viewBoxY = noteHeadTopY - 2; 
            viewBoxHeight = 24 - viewBoxY;
        }

        const stemDown = staffPosition >= 2;
        const noteHeadX = staffX + ((isSharp || isFlat) ? 14 : 12);
        
        const ledgerLines: React.ReactElement[] = [];
        for (let pos = -1; pos >= staffPosition; pos--) {
            if (pos % 1 === 0) {
                const y = staffTopY + (4 - pos) * lineSpacing;
                ledgerLines.push(<line key={`ledger-down-${pos}`} x1={noteHeadX - 5} y1={y} x2={noteHeadX + 5} y2={y} stroke={noteColor} strokeWidth="0.75" />);
            }
        }
        for (let pos = 5; pos <= staffPosition; pos++) {
             if (pos % 1 === 0) {
                const y = staffTopY + (4 - pos) * lineSpacing;
                ledgerLines.push(<line key={`ledger-up-${pos}`} x1={noteHeadX - 5} y1={y} x2={noteHeadX + 5} y2={y} stroke={noteColor} strokeWidth="0.75" />);
             }
        }
        return (
            <div className="h-6 mb-1">
                <svg viewBox={`0 ${viewBoxY} ${clefSectionWidth + 30} ${viewBoxHeight}`} className="w-auto h-full">
                    {hasClef && (
                        <text x={clefSectionWidth / 2} y="11" fill={noteColor} fontSize="8.5px" fontFamily="Lexend, sans-serif" fontWeight="600" textAnchor="middle" style={{ letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                            <tspan x={clefSectionWidth / 2} dy="-4">{clef === 'treble' ? 'Treble' : 'Bass'}</tspan>
                            <tspan x={clefSectionWidth / 2} dy="9">Clef</tspan>
                        </text>
                    )}
                    <g stroke={noteColor} strokeWidth="0.5">
                        {[0, 1, 2, 3, 4].map(i => (<line key={i} x1={staffX} y1={staffTopY + i * lineSpacing} x2={staffX + 24} y2={staffTopY + i * lineSpacing} />))}
                    </g>
                    {ledgerLines}
                    {isSharp && <text x={staffX + 5} y={noteY + 2.5} fontSize="8" fill={accidentalColor} style={{ fontFamily: 'serif', fontWeight: 'bold' }}>♯</text>}
                    {isFlat && <text x={staffX + 5} y={noteY + 3} fontSize="10" fill={accidentalColor} style={{ fontFamily: 'serif', fontWeight: 'bold' }}>♭</text>}
                    <g fill={noteColor}>
                        <ellipse cx={noteHeadX} cy={noteY} rx="2.5" ry="2" transform={`rotate(-20, ${noteHeadX}, ${noteY})`} />
                        <line x1={stemDown ? noteHeadX - 2.5 : noteHeadX + 2.5} y1={noteY} x2={stemDown ? noteHeadX - 2.5 : noteHeadX + 2.5} y2={stemDown ? noteY + 11 : noteY - 11} stroke={noteColor} strokeWidth="1" />
                    </g>
                </svg>
            </div>
        );
    }
    
    const syllable = getSolfegeSyllable(displayNote, solfegeKey, preferFlats);
    if (keyboardDisplayMode === 'solfege' && syllable) {
        return <div className="h-6 mb-1 flex items-center justify-center"><span className={`text-base font-semibold ${textColor}`}>{syllable}</span></div>;
    }
    if (keyboardDisplayMode === 'noteNames') {
        return <div className="h-6 mb-1 flex items-center justify-center"><span className={`text-sm font-mono ${textColor}`}>{displayNote}</span></div>;
    }
    return <div className="h-6 mb-1"></div>;
});


const CHORD_COLORS: Record<string, { base: string, border: string }> = {
    'I':  { base: 'rgb(59 130 246)', border: 'rgb(37 99 235)' },
    'IV': { base: 'rgb(34 197 94)', border: 'rgb(22 163 74)' },
    'V':  { base: 'rgb(234 179 8)', border: 'rgb(202 138 4)' },
    'vi': { base: 'rgb(168 85 247)', border: 'rgb(147 51 234)'},
};
const CHORD_COLORS_BLACK: Record<string, { base: string, border: string }> = {
    'I':  { base: 'rgb(37 99 235)', border: 'rgb(29 78 216)' },
    'IV': { base: 'rgb(22 163 74)', border: 'rgb(21 128 61)' },
    'V':  { base: 'rgb(202 138 4)', border: 'rgb(161 98 7)' },
    'vi': { base: 'rgb(147 51 234)', border: 'rgb(126 34 206)'},
};

const getHighlightStyle = (note: string, keyType: 'white' | 'black', highlightTypes: string[]) => {
    const isActive = highlightTypes.includes('active');
    const chordHighlights = highlightTypes.filter(h => h !== 'active' && CHORD_COLORS[h]);
    
    const result = {
        baseClassName: '',
        baseStyle: {} as React.CSSProperties,
        labelClassName: '',
        labelTextClassName: '',
    };
    
    if (isActive) {
        if (keyType === 'white') {
            result.baseClassName = 'bg-synth-cyan-500 border-gray-400 border-b-synth-cyan-700 shadow-inner translate-y-px';
            result.labelClassName = 'bg-synth-cyan-400/80 border-synth-cyan-300';
            result.labelTextClassName = 'text-synth-gray-900';
        } else {
            result.baseClassName = 'bg-synth-cyan-400 border-black border-b-synth-cyan-600 shadow-inner translate-y-px';
            result.labelClassName = 'bg-synth-cyan-500/80 border-synth-cyan-300';
            result.labelTextClassName = 'text-white';
        }
        return result;
    }
    
    if (chordHighlights.length === 0) {
        if (keyType === 'white') {
            result.baseClassName = 'bg-gradient-to-b from-white to-gray-200 border-gray-300 border-b-gray-400 shadow-lg active:translate-y-px';
            result.labelClassName = 'bg-white/70 border-gray-400';
            result.labelTextClassName = 'text-synth-gray-700';
        } else {
            result.baseClassName = 'bg-gradient-to-b from-gray-800 to-black border-black shadow-md active:translate-y-px';
            result.labelClassName = 'bg-black/30 border-gray-500';
            result.labelTextClassName = 'text-gray-400';
        }
        return result;
    }
    
    const colorSet = keyType === 'white' ? CHORD_COLORS : CHORD_COLORS_BLACK;
    
    if (keyType === 'white') {
        result.labelTextClassName = chordHighlights.includes('V') ? 'text-synth-gray-900' : 'text-white';
        result.labelClassName = 'border-white/30';
    } else {
        result.labelTextClassName = 'text-white';
        result.labelClassName = 'border-white/30';
    }
    
    if (chordHighlights.length === 1) {
        const chord = chordHighlights[0];
        const colors = colorSet[chord];
        if (colors) {
            result.baseStyle = { backgroundColor: colors.base, borderBottomColor: colors.border };
            result.labelClassName += ' bg-black/20';
        }
    } else if (chordHighlights.length > 1) {
        const stripeColors = chordHighlights.map(ch => colorSet[ch]?.base).filter(Boolean);
        const numColors = stripeColors.length;
        if (numColors > 0) {
            const gradientStops = stripeColors.map((color, i) => `${color} ${(i/numColors)*100}%, ${color} ${((i+1)/numColors)*100}%`).join(', ');
            result.baseStyle = { backgroundImage: `linear-gradient(135deg, ${gradientStops})` };
        }
        result.labelClassName += ' bg-black/40';
    }
    return result;
};


interface KeyProps {
    note: string;
    style: React.CSSProperties;
    computerKey: string;
    highlightTypes: string[];
    octaveOffset: number;
    keyboardDisplayMode: 'noteNames' | 'notation' | 'solfege' | 'hz';
    solfegeKey: string;
    preferFlats: boolean;
    freq?: number;
    displayClef?: boolean;
    clef?: 'treble' | 'bass';
    onInteractionStart: (note: string) => void;
    onInteractionMove: (note: string) => void;
}

const areEqualKeyProps = (prev: KeyProps, next: KeyProps) => {
    return (
        prev.note === next.note &&
        prev.octaveOffset === next.octaveOffset &&
        prev.keyboardDisplayMode === next.keyboardDisplayMode &&
        prev.solfegeKey === next.solfegeKey &&
        prev.preferFlats === next.preferFlats &&
        prev.freq === next.freq &&
        prev.displayClef === next.displayClef &&
        prev.clef === next.clef &&
        // Shallow compare highlight arrays (they are strings)
        prev.highlightTypes.length === next.highlightTypes.length &&
        prev.highlightTypes.every((val, index) => val === next.highlightTypes[index])
    );
};


const WhiteKey = React.memo(({ note, style, computerKey, highlightTypes, octaveOffset, keyboardDisplayMode, solfegeKey, preferFlats, freq, displayClef, clef, onInteractionStart, onInteractionMove }: KeyProps) => {
    const { baseClassName, baseStyle, labelClassName, labelTextClassName } = getHighlightStyle(note, 'white', highlightTypes);
    return (
        <div
            data-note={note}
            onMouseDown={() => onInteractionStart(note)}
            onMouseEnter={() => onInteractionMove(note)}
            onTouchStart={(e) => { e.preventDefault(); onInteractionStart(note); }}
            className={`absolute top-0 bottom-0 border-x border-b-[6px] rounded-b-lg flex flex-col justify-end pb-2 cursor-pointer transition-all duration-75 transform ${baseClassName}`}
            style={{...style, ...baseStyle}}
        >
            <div className="flex flex-col items-center pointer-events-none">
                <MusicalNotation 
                    note={note} octaveOffset={octaveOffset} highlightTypes={highlightTypes}
                    displayClef={!!displayClef} clef={clef || 'treble'} keyType="white"
                    keyboardDisplayMode={keyboardDisplayMode} solfegeKey={solfegeKey} preferFlats={preferFlats} freq={freq}
                />
                {computerKey && (
                    <div className={`mt-1 w-6 h-6 flex items-center justify-center rounded-md transition-colors border ${labelClassName}`}>
                        <span className={`font-bold text-base ${labelTextClassName}`}>{computerKey}</span>
                    </div>
                )}
            </div>
        </div>
    );
}, areEqualKeyProps);


const BlackKey = React.memo(({ note, style, computerKey, highlightTypes, octaveOffset, keyboardDisplayMode, solfegeKey, preferFlats, freq, clef, onInteractionStart, onInteractionMove }: KeyProps) => {
    const { baseClassName, baseStyle, labelClassName, labelTextClassName } = getHighlightStyle(note, 'black', highlightTypes);
    return (
        <div
            data-note={note}
            onMouseDown={(e) => { e.stopPropagation(); onInteractionStart(note); }}
            onMouseEnter={(e) => { e.stopPropagation(); onInteractionMove(note); }}
            onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); onInteractionStart(note); }}
            className={`absolute top-0 h-[60%] border-x-2 border-b-[8px] rounded-b-md z-10 flex flex-col justify-end pb-2 cursor-pointer transition-all duration-75 transform ${baseClassName}`}
            style={{...style, ...baseStyle}}
        >
            <div className="flex flex-col items-center pointer-events-none">
                <MusicalNotation 
                    note={note} octaveOffset={octaveOffset} highlightTypes={highlightTypes}
                    displayClef={false} clef={clef || 'treble'} keyType="black"
                    keyboardDisplayMode={keyboardDisplayMode} solfegeKey={solfegeKey} preferFlats={preferFlats} freq={freq}
                />
                {computerKey && (
                    <div className={`mt-1 w-6 h-6 flex items-center justify-center rounded-md transition-colors border ${labelClassName}`}>
                        <span className={`font-bold text-base ${labelTextClassName}`}>{computerKey}</span>
                    </div>
                )}
            </div>
        </div>
    );
}, areEqualKeyProps);



export const Keyboard: React.FC<KeyboardProps> = ({ onNoteDown, onNoteUp, highlightedNotes, octaveOffset, keyboardDisplayMode, solfegeKey, preferFlats, noteFrequencies }) => {
  const isInteractingRef = useRef(false);
  const lastInteractedNoteRef = useRef<string | null>(null);

  const onNoteDownRef = useRef(onNoteDown);
  const onNoteUpRef = useRef(onNoteUp);
  useEffect(() => {
    onNoteDownRef.current = onNoteDown;
    onNoteUpRef.current = onNoteUp;
  }, [onNoteDown, onNoteUp]);

  const handleInteractionEnd = useCallback(() => {
    if (isInteractingRef.current) {
      isInteractingRef.current = false;
      if (lastInteractedNoteRef.current) {
        onNoteUpRef.current(lastInteractedNoteRef.current);
      }
      lastInteractedNoteRef.current = null;
    }
    window.removeEventListener('mouseup', handleInteractionEnd);
    window.removeEventListener('touchend', handleInteractionEnd);
  }, []);

  const handleInteractionStart = useCallback((note: string) => {
    isInteractingRef.current = true;
    onNoteDownRef.current(note);
    lastInteractedNoteRef.current = note;
    window.addEventListener('mouseup', handleInteractionEnd);
    window.addEventListener('touchend', handleInteractionEnd);
  }, [handleInteractionEnd]);

  const handleInteractionMove = useCallback((note: string) => {
    if (isInteractingRef.current && note !== lastInteractedNoteRef.current) {
      if (lastInteractedNoteRef.current) {
        onNoteUpRef.current(lastInteractedNoteRef.current);
      }
      onNoteDownRef.current(note);
      lastInteractedNoteRef.current = note;
    }
  }, []);

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isInteractingRef.current) return;
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    const note = element?.getAttribute('data-note');
    if (note) {
      handleInteractionMove(note);
    }
  };

  const firstKeyNote = transposeNote('C4', octaveOffset);
  const matchFirst = firstKeyNote.match(/([A-G]#?)([0-9])/);
  const firstMidi = matchFirst ? parseInt(matchFirst[2], 10) * 12 : 60;
  const firstClef: 'treble' | 'bass' = firstMidi <= 48 ? 'bass' : 'treble';
  
  const c5FinalNote = transposeNote('C5', octaveOffset);
  const matchC5 = c5FinalNote.match(/([A-G]#?)([0-9])/);
  const c5Midi = matchC5 ? parseInt(matchC5[2], 10) * 12 : 72;
  const c5Clef: 'treble' | 'bass' = c5Midi <= 48 ? 'bass' : 'treble';
  const shouldDisplayC5Clef = c5Clef !== firstClef;
  const c5NoteIndex = KEYBOARD_NOTES.findIndex(k => k.note === 'C5');

  const whiteKeys = KEYBOARD_NOTES.filter(k => k.type === 'white');
  const totalWhiteKeys = whiteKeys.length;
  let whiteKeyCounter = 0;

  return (
    <div className="relative w-full h-48 select-none" onTouchMove={handleTouchMove}>
      {KEYBOARD_NOTES.map((k, index) => {
        const { note, type } = k;
        const computerKey = computerKeyMap[note];
        const highlightTypes = highlightedNotes.get(note) || [];
        const isAfterClefChange = index >= c5NoteIndex;
        const clefForThisNote = isAfterClefChange ? c5Clef : firstClef;
        const freq = transposeNote(note, octaveOffset) ? noteFrequencies.get(transposeNote(note, octaveOffset)) : undefined;

        if (type === 'white') {
          const style = { left: `${(whiteKeyCounter / totalWhiteKeys) * 100}%`, width: `${(1 / totalWhiteKeys) * 100}%` };
          whiteKeyCounter++;
          const isFirstKey = note === 'C4';
          const shouldDisplayClef = isFirstKey || (note === 'C5' && shouldDisplayC5Clef);

          return (
            <WhiteKey 
                key={note} note={note} style={style} computerKey={computerKey} 
                highlightTypes={highlightTypes} octaveOffset={octaveOffset}
                keyboardDisplayMode={keyboardDisplayMode} solfegeKey={solfegeKey} preferFlats={preferFlats}
                freq={freq} displayClef={shouldDisplayClef} clef={clefForThisNote}
                onInteractionStart={handleInteractionStart} onInteractionMove={handleInteractionMove}
            />
          );
        }
        return null;
      })}
      
      {whiteKeyCounter = 0}
      {KEYBOARD_NOTES.map((k, index) => {
         const { note, type } = k;
         if (type === 'white') {
            whiteKeyCounter++;
            return null;
         }
         const computerKey = computerKeyMap[note];
         const highlightTypes = highlightedNotes.get(note) || [];
         const isAfterClefChange = index >= c5NoteIndex;
         const clefForThisNote = isAfterClefChange ? c5Clef : firstClef;
         const freq = transposeNote(note, octaveOffset) ? noteFrequencies.get(transposeNote(note, octaveOffset)) : undefined;
         const style = { left: `${((whiteKeyCounter - 0.35) / totalWhiteKeys) * 100}%`, width: `${(1 / totalWhiteKeys) * 100 * 0.7}%` };

         return (
             <BlackKey
                key={note} note={note} style={style} computerKey={computerKey}
                highlightTypes={highlightTypes} octaveOffset={octaveOffset}
                keyboardDisplayMode={keyboardDisplayMode} solfegeKey={solfegeKey} preferFlats={preferFlats}
                freq={freq} clef={clefForThisNote}
                onInteractionStart={handleInteractionStart} onInteractionMove={handleInteractionMove}
             />
         );
      })}
    </div>
  );
};