import React, { useRef, useEffect, useCallback } from 'react';
import { KEYBOARD_NOTES, KEY_MAP } from '../constants';
import { getSolfegeSyllable, formatNoteName } from '../services/musicTheory';

type HighlightType = 'active' | 'I' | 'IV' | 'V' | 'vi';

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
// This version animates each digit independently for a "tumbler" effect.

// A single "tumbler" for one digit. Memoized for performance.
const AnimatedDigit: React.FC<{ digit: string }> = React.memo(({ digit }) => {
    // The full reel of characters we can display.
    const REEL = '9876543210';
    const digitIndex = REEL.indexOf(digit);

    // Calculate the transform value. Each character is 1em high.
    const yOffset = digitIndex * -1;

    return (
        <div style={{ height: '1em', lineHeight: '1em', overflow: 'hidden', display: 'inline-block' }}>
            <div
                className="transition-transform duration-500"
                style={{
                    transform: `translateY(${yOffset}em)`,
                    transitionTimingFunction: 'cubic-bezier(0.2, 1, 0.3, 1)' // A smooth ease-out curve
                }}
            >
                {REEL.split('').map((d) => (
                    <div key={d} style={{ height: '1em' }}>
                        {d}
                    </div>
                ))}
            </div>
        </div>
    );
});

const AnimatedFrequency: React.FC<{ freq: number | undefined; textColor: string }> = ({ freq, textColor }) => {
    // Format the frequency to a fixed-length string (e.g., " 440.0", "  98.7").
    // Padding is crucial to prevent the layout from jumping as numbers change length.
    const formattedFreq = freq !== undefined ? freq.toFixed(1).padStart(6, ' ') : '   -.-';
    
    // Split the formatted string into individual characters for animation.
    const chars = formattedFreq.split('');

    return (
        <div className={`h-6 w-full flex items-center justify-center ${textColor}`}>
            <div className="flex items-center text-lg font-sans font-semibold tabular-nums" style={{ lineHeight: '1em' }}>
                {chars.map((char, index) => {
                    // Non-breaking space for padding, rendered as a fixed-width empty div.
                    if (char === ' ') {
                        return <div key={index} style={{ width: '0.6em' }} />;
                    }
                    // The decimal point doesn't need to animate.
                    if (char === '.') {
                        return <div key={index} style={{ width: '0.3em' }}>.</div>;
                    }
                     // The dash for "no signal" doesn't need to animate.
                    if (char === '-') {
                        return <div key={index} style={{ width: '0.6em' }}>-</div>;
                    }
                    // Render an animated tumbler for each numeral.
                    return <AnimatedDigit key={index} digit={char} />;
                })}
            </div>
            <span className="text-xs ml-1 opacity-70">Hz</span>
        </div>
    );
};


// --- Musical Notation Component Helpers ---

// Helper to transpose a note string by a given octave offset
const transposeNote = (note: string, octaveOffset: number): string => {
    if (octaveOffset === 0) return note;
    const match = note.match(/([A-G]#?)([0-9])/);
    if (match) {
        const noteName = match[1];
        const octave = parseInt(match[2], 10);
        return `${noteName}${octave + octaveOffset}`;
    }
    return note;
};

// Calculates the MIDI note number for a given note string (e.g., C4 -> 60)
const getNoteMidiValue = (note: string): number | null => {
    const match = note.match(/([A-G])(♭|#)?([0-9])/);
    if (!match) return null;

    const noteName = match[1];
    const accidental = match[2];
    const octave = parseInt(match[3], 10);

    const noteBase: { [key: string]: number } = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    
    let midiValue = noteBase[noteName];
    if (midiValue === undefined) return null;
    
    if (accidental === '#') midiValue += 1;
    if (accidental === '♭') midiValue -= 1;
    
    // MIDI note number formula: C4 is 60.
    return 12 * (octave + 1) + midiValue;
};


// Calculates staff position relative to the bottom line of the given clef
const getStaffPosition = (note: string, clef: 'treble' | 'bass'): number | null => {
    const match = note.match(/([A-G])(♭|#)?([0-9])/);
    if (!match) return null;

    const noteName = match[1];
    const octave = parseInt(match[3], 10);

    const noteMap: { [key: string]: number } = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
    const noteValue = noteMap[noteName];

    if (noteValue === undefined) return null;

    const currentNoteValue = noteValue + octave * 7;

    // Reference values for the bottom line of each staff
    // Treble clef bottom line is E4
    const TREBLE_REF_VALUE = noteMap['E'] + 4 * 7;
    // Bass clef bottom line is G2
    const BASS_REF_VALUE = noteMap['G'] + 2 * 7;
    
    const refValue = clef === 'treble' ? TREBLE_REF_VALUE : BASS_REF_VALUE;

    // Each step up in note scale (C->D) is half a step on staff. Position is relative to bottom line.
    const position = (currentNoteValue - refValue) / 2;
    return position;
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
  noteFrequencies: Map<string, number>;
}
const MusicalNotation = ({ 
    note, octaveOffset, highlightTypes, displayClef, clef, keyType,
    keyboardDisplayMode, solfegeKey, preferFlats, noteFrequencies,
}: MusicalNotationProps) => {
    const finalNoteInternal = transposeNote(note, octaveOffset);
    const displayNote = formatNoteName(finalNoteInternal, preferFlats);
    const staffPosition = getStaffPosition(displayNote, clef);

    const shouldShowFullNotation = staffPosition !== null;

    // --- Color logic based on highlight state ---
    let noteColor: string, accidentalColor: string, textColor: string;
    const isActive = highlightTypes.includes('active');
    const hasHighlight = highlightTypes.length > 0;

    if (keyType === 'white') {
        noteColor = isActive ? '#1E1E1E' : (hasHighlight ? '#FFFFFF' : '#3D3D3D');
        accidentalColor = isActive ? '#121212' : (hasHighlight ? '#FFFFFF' : '#1E1E1E');
        textColor = isActive ? 'text-synth-gray-800' : (hasHighlight ? 'text-white' : 'text-synth-gray-500');
    } else { // black key
        noteColor = hasHighlight ? '#FFFFFF' : '#9CA3AF';
        accidentalColor = hasHighlight ? '#FFFFFF' : '#9CA3AF';
        textColor = hasHighlight ? 'text-white' : 'text-gray-400';
    }

    if (keyboardDisplayMode === 'hz' && isActive) {
        const freq = noteFrequencies.get(finalNoteInternal);
        return (
            <div className="h-6 mb-1 w-full flex items-center justify-center px-1">
                <AnimatedFrequency freq={freq} textColor={textColor} />
            </div>
        );
    }

    if (keyboardDisplayMode === 'notation' && shouldShowFullNotation) {
        const isSharp = displayNote.includes('#');
        const isFlat = displayNote.includes('♭');
        // --- SVG Sizing and positioning ---
        const hasClef = displayClef;
        const clefSectionWidth = hasClef ? 45 : 0;
        const staffSectionWidth = 30; // Includes space for note, sharp, etc.
        const viewboxWidth = clefSectionWidth + staffSectionWidth;

        const clefTextX = clefSectionWidth / 2;
        const staffX = clefSectionWidth;
        
        const lineSpacing = 3;
        const staffTopY = 4; // y-coordinate of the top staff line

        // Convert staff position to an SVG y-coordinate.
        const noteY = staffTopY + (4 - staffPosition) * lineSpacing;

        // --- Dynamic ViewBox Calculation ---
        const noteHeadTopY = noteY - 2; // ry=2 for the ellipse
        let viewBoxY = 0;
        let viewBoxHeight = 24;

        // If the note head is being drawn above the default view (y < 0)...
        if (noteHeadTopY < viewBoxY) {
            // ...adjust the viewBox to start higher up, including some padding.
            viewBoxY = noteHeadTopY - 2; 
            // Expand the viewBox height to ensure the bottom isn't cut off.
            viewBoxHeight = 24 - viewBoxY;
        }

        // Stem direction logic: notes on or above the middle line (B4 in treble, D3 in bass) have stems down.
        // Middle line is at staff position 2 for both clefs.
        const stemDown = staffPosition >= 2;
        const noteHeadX = staffX + ((isSharp || isFlat) ? 14 : 12);
        const stemX = stemDown ? noteHeadX - 2.5 : noteHeadX + 2.5;
        const stemY1 = noteY;
        const stemY2 = stemDown ? noteY + 11 : noteY - 11;
        
        // Generate ledger lines
        const ledgerLines: React.ReactElement[] = [];
        // Ledger lines below the staff (position < 0)
        for (let pos = -1; pos >= staffPosition; pos--) {
            if (pos % 1 === 0) { // Only draw for integer positions (lines, not spaces)
                const y = staffTopY + (4 - pos) * lineSpacing;
                ledgerLines.push(<line key={`ledger-down-${pos}`} x1={noteHeadX - 5} y1={y} x2={noteHeadX + 5} y2={y} stroke={noteColor} strokeWidth="0.75" />);
            }
        }
        // Ledger lines above the staff (position > 4)
        for (let pos = 5; pos <= staffPosition; pos++) {
             if (pos % 1 === 0) {
                const y = staffTopY + (4 - pos) * lineSpacing;
                ledgerLines.push(<line key={`ledger-up-${pos}`} x1={noteHeadX - 5} y1={y} x2={noteHeadX + 5} y2={y} stroke={noteColor} strokeWidth="0.75" />);
             }
        }
        return (
            <div className="h-6 mb-1" aria-label={`Musical notation for ${displayNote}`}>
                <svg viewBox={`0 ${viewBoxY} ${viewboxWidth} ${viewBoxHeight}`} className="w-auto h-full" aria-hidden="true">
                    
                    {hasClef && (
                        <text
                            x={clefTextX}
                            y="11"
                            fill={noteColor}
                            fontSize="8.5px"
                            fontFamily="Lexend, sans-serif"
                            fontWeight="600"
                            textAnchor="middle"
                            style={{ letterSpacing: '0.02em', textTransform: 'uppercase' }}
                        >
                            <tspan x={clefTextX} dy="-4">{clef === 'treble' ? 'Treble' : 'Bass'}</tspan>
                            <tspan x={clefTextX} dy="9">Clef</tspan>
                        </text>
                    )}

                    <g stroke={noteColor} strokeWidth="0.5">
                        {/* Staff lines */}
                        {[0, 1, 2, 3, 4].map(i => (
                            <line key={i} x1={staffX} y1={staffTopY + i * lineSpacing} x2={staffX + 24} y2={staffTopY + i * lineSpacing} />
                        ))}
                    </g>
                    
                    {ledgerLines}

                    {isSharp && <text x={staffX + 5} y={noteY + 2.5} fontSize="8" fill={accidentalColor} style={{ fontFamily: 'serif', fontWeight: 'bold' }}>♯</text>}
                    {isFlat && <text x={staffX + 5} y={noteY + 3} fontSize="10" fill={accidentalColor} style={{ fontFamily: 'serif', fontWeight: 'bold' }}>♭</text>}
                    
                    <g fill={noteColor}>
                        {/* Note head (quarter note) */}
                        <ellipse cx={noteHeadX} cy={noteY} rx="2.5" ry="2" transform={`rotate(-20, ${noteHeadX}, ${noteY})`} />
                        {/* Note stem */}
                        <line x1={stemX} y1={stemY1} x2={stemX} y2={stemY2} stroke={noteColor} strokeWidth="1" />
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
    
    // If we show neither notation nor names, render an empty placeholder
    return <div className="h-6 mb-1"></div>;
};

const CHORD_COLORS: Record<string, { base: string, border: string }> = {
    'I':  { base: 'rgb(59 130 246)', border: 'rgb(37 99 235)' },  // blue-500
    'IV': { base: 'rgb(34 197 94)', border: 'rgb(22 163 74)' }, // green-500
    'V':  { base: 'rgb(234 179 8)', border: 'rgb(202 138 4)' },  // yellow-500
    'vi': { base: 'rgb(168 85 247)', border: 'rgb(147 51 234)'}, // purple-500
};
const CHORD_COLORS_BLACK: Record<string, { base: string, border: string }> = {
    'I':  { base: 'rgb(37 99 235)', border: 'rgb(29 78 216)' },  // blue-600
    'IV': { base: 'rgb(22 163 74)', border: 'rgb(21 128 61)' }, // green-600
    'V':  { base: 'rgb(202 138 4)', border: 'rgb(161 98 7)' },  // yellow-600
    'vi': { base: 'rgb(147 51 234)', border: 'rgb(126 34 206)'}, // purple-600
};

const getHighlightStyle = (
    note: string, 
    keyType: 'white' | 'black', 
    highlightedNotes: Map<string, string[]>
): { baseClassName: string; baseStyle: React.CSSProperties; labelClassName: string; labelTextClassName: string } => {
    
    const highlights = highlightedNotes.get(note) || [];
    const isActive = highlights.includes('active');
    const chordHighlights = highlights.filter(h => h !== 'active' && CHORD_COLORS[h]);

    const result = {
        baseClassName: '',
        baseStyle: {},
        labelClassName: '',
        labelTextClassName: '',
    };
    
    // --- ACTIVE STATE (Highest priority) ---
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
    
    // --- DEFAULT STATE (No highlights) ---
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
    
    // --- CHORD HIGHLIGHT STATE ---
    const colorSet = keyType === 'white' ? CHORD_COLORS : CHORD_COLORS_BLACK;
    
    if (keyType === 'white') {
        result.labelTextClassName = chordHighlights.includes('V') ? 'text-synth-gray-900' : 'text-white';
        result.labelClassName = 'border-white/30';
    } else {
        result.labelTextClassName = 'text-white';
        result.labelClassName = 'border-white/30';
    }
    
    // Single chord highlight: Solid color
    if (chordHighlights.length === 1) {
        const chord = chordHighlights[0];
        const colors = colorSet[chord];
        if (colors) {
            result.baseStyle = { backgroundColor: colors.base, borderBottomColor: colors.border };
            result.labelClassName += ' bg-black/20';
        }
    }
    // Multiple chord highlights: Create wide, non-repeating stripes
    else if (chordHighlights.length > 1) {
        const stripeColors = chordHighlights.map(ch => colorSet[ch]?.base).filter(Boolean);
        const numColors = stripeColors.length;
        let gradientStops = '';
        
        if (numColors > 0) {
            gradientStops = stripeColors.map((color, i) => {
                const startPercent = (i / numColors) * 100;
                const endPercent = ((i + 1) / numColors) * 100;
                return `${color} ${startPercent}%, ${color} ${endPercent}%`;
            }).join(', ');
        }

        const gradient = `linear-gradient(135deg, ${gradientStops})`;
        
        result.baseStyle = { backgroundImage: gradient };
        result.labelClassName += ' bg-black/40'; // Darken label bg for readability over stripes
    }

    return result;
};


export const Keyboard: React.FC<KeyboardProps> = ({ onNoteDown, onNoteUp, highlightedNotes, octaveOffset, keyboardDisplayMode, solfegeKey, preferFlats, noteFrequencies }) => {
  const isInteractingRef = useRef(false);
  const lastInteractedNoteRef = useRef<string | null>(null);

  // Use refs for the handlers to prevent stale closures in window event listeners
  const onNoteDownRef = useRef(onNoteDown);
  const onNoteUpRef = useRef(onNoteUp);
  useEffect(() => {
    onNoteDownRef.current = onNoteDown;
    onNoteUpRef.current = onNoteUp;
  }, [onNoteDown, onNoteUp]);

  // A single, robust handler for ending interaction (e.g., on mouseup/touchend)
  const handleInteractionEnd = useCallback(() => {
    if (isInteractingRef.current) {
      isInteractingRef.current = false;
      if (lastInteractedNoteRef.current) {
        onNoteUpRef.current(lastInteractedNoteRef.current);
      }
      lastInteractedNoteRef.current = null;
    }
    // Clean up the global listeners
    window.removeEventListener('mouseup', handleInteractionEnd);
    window.removeEventListener('touchend', handleInteractionEnd);
  }, []);

  // When interaction starts, begin tracking and attach global listeners to catch the end
  const handleInteractionStart = (note: string) => {
    isInteractingRef.current = true;
    onNoteDownRef.current(note);
    lastInteractedNoteRef.current = note;
    window.addEventListener('mouseup', handleInteractionEnd);
    window.addEventListener('touchend', handleInteractionEnd);
  };

  // Handle dragging across keys
  const handleInteractionMove = (note: string) => {
    if (isInteractingRef.current && note !== lastInteractedNoteRef.current) {
      if (lastInteractedNoteRef.current) {
        onNoteUpRef.current(lastInteractedNoteRef.current);
      }
      onNoteDownRef.current(note);
      lastInteractedNoteRef.current = note;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isInteractingRef.current) return;
    
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    const note = element?.getAttribute('data-note');

    if (note) {
      handleInteractionMove(note);
    }
  };

  const whiteKeys = KEYBOARD_NOTES.filter(k => k.type === 'white');
  const totalWhiteKeys = whiteKeys.length;
  let whiteKeyCounter = 0;

  // --- Clef Logic ---
  const firstKeyNote = transposeNote('C4', octaveOffset);
  const firstKeyMidi = getNoteMidiValue(firstKeyNote);
  const firstClef: 'treble' | 'bass' = (firstKeyMidi !== null && firstKeyMidi <= 48) ? 'bass' : 'treble';
  const c5FinalNote = transposeNote('C5', octaveOffset);
  const c5Midi = getNoteMidiValue(c5FinalNote);
  const c5Clef: 'treble' | 'bass' = (c5Midi !== null && c5Midi <= 48) ? 'bass' : 'treble';
  const shouldDisplayC5Clef = c5Clef !== firstClef;
  const c5NoteIndex = KEYBOARD_NOTES.findIndex(k => k.note === 'C5');


  return (
    <div 
        className="relative w-full h-48 select-none"
        onTouchMove={handleTouchMove}
        // MouseUp and MouseLeave are removed from here to prevent the "stuck note" bug.
        // The logic is now handled by a global window listener added on mousedown.
    >
      {KEYBOARD_NOTES.map(({ note, type }, index) => {
        const computerKey = computerKeyMap[note];

        if (type === 'white') {
          const style = { left: `${(whiteKeyCounter / totalWhiteKeys) * 100}%`, width: `${(1 / totalWhiteKeys) * 100}%` };
          whiteKeyCounter++;
          
          const { baseClassName, baseStyle, labelClassName, labelTextClassName } = getHighlightStyle(note, 'white', highlightedNotes);
          const isFirstKey = note === 'C4';
          const shouldDisplayClef = isFirstKey || (note === 'C5' && shouldDisplayC5Clef);
          const isAfterClefChange = index >= c5NoteIndex;
          const clefForThisNote = isAfterClefChange ? c5Clef : firstClef;

          return (
            <div
              key={note}
              data-note={note}
              onMouseDown={() => handleInteractionStart(note)}
              onMouseEnter={() => handleInteractionMove(note)}
              onTouchStart={(e) => { e.preventDefault(); handleInteractionStart(note); }}
              className={`absolute top-0 bottom-0 border-x border-b-[6px] rounded-b-lg flex flex-col justify-end pb-2 cursor-pointer transition-all duration-75 transform ${baseClassName}`}
              style={{...style, ...baseStyle}}
            >
              <div className="flex flex-col items-center pointer-events-none">
                <MusicalNotation 
                    note={note} 
                    octaveOffset={octaveOffset} 
                    highlightTypes={highlightedNotes.get(note) || []}
                    displayClef={shouldDisplayClef} 
                    clef={clefForThisNote} 
                    keyType="white"
                    keyboardDisplayMode={keyboardDisplayMode}
                    solfegeKey={solfegeKey}
                    preferFlats={preferFlats}
                    noteFrequencies={noteFrequencies}
                />
                {computerKey && (
                    <div className={`mt-1 w-6 h-6 flex items-center justify-center rounded-md transition-colors border ${labelClassName}`}>
                        <span className={`font-bold text-base ${labelTextClassName}`}>{computerKey}</span>
                    </div>
                )}
              </div>
            </div>
          );
        }
        return null;
      })}
      
      {whiteKeyCounter = 0}
      {KEYBOARD_NOTES.map(({ note, type }, index) => {
        const computerKey = computerKeyMap[note];
        
        if (type === 'white') {
          whiteKeyCounter++;
          return null;
        }

        const { baseClassName, baseStyle, labelClassName, labelTextClassName } = getHighlightStyle(note, 'black', highlightedNotes);
        const isAfterClefChange = index >= c5NoteIndex;
        const clefForThisNote = isAfterClefChange ? c5Clef : firstClef;
        const style = { left: `${((whiteKeyCounter - 0.35) / totalWhiteKeys) * 100}%`, width: `${(1 / totalWhiteKeys) * 100 * 0.7}%` };
        
        return (
          <div
            key={note}
            data-note={note}
            onMouseDown={(e) => { e.stopPropagation(); handleInteractionStart(note); }}
            onMouseEnter={(e) => { e.stopPropagation(); handleInteractionMove(note); }}
            onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); handleInteractionStart(note); }}
            className={`absolute top-0 h-[60%] border-x-2 border-b-[8px] rounded-b-md z-10 flex flex-col justify-end pb-2 cursor-pointer transition-all duration-75 transform ${baseClassName}`}
            style={{...style, ...baseStyle}}
          >
            <div className="flex flex-col items-center pointer-events-none">
                <MusicalNotation 
                    note={note} 
                    octaveOffset={octaveOffset} 
                    highlightTypes={highlightedNotes.get(note) || []}
                    displayClef={false} 
                    clef={clefForThisNote} 
                    keyType="black"
                    keyboardDisplayMode={keyboardDisplayMode}
                    solfegeKey={solfegeKey}
                    preferFlats={preferFlats}
                    noteFrequencies={noteFrequencies}
                />
                {computerKey && (
                    <div className={`mt-1 w-6 h-6 flex items-center justify-center rounded-md transition-colors border ${labelClassName}`}>
                        <span className={`font-bold text-base ${labelTextClassName}`}>{computerKey}</span>
                    </div>
                )}
            </div>
          </div>
        );
      })}
    </div>
  );
};