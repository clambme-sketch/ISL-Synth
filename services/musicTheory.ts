
import { ALL_NOTES_CHROMATIC, KEYBOARD_NOTES, SOLFEGE_SYLLABLES_SHARP, SOLFEGE_SYLLABLES_FLAT, SHARP_TO_FLAT, FLAT_TO_SHARP, SHARP_KEYS, FLAT_KEYS, ROMAN_NUMERALS, MAJOR_SCALE_INTERVALS, MINOR_SCALE_INTERVALS, MAJOR_SCALE_CHORD_QUALITIES, MINOR_SCALE_CHORD_QUALITIES } from '../constants';
import type { ChordMode } from '../types';

// --- MIDI and Note Mapping ---

const NOTE_TO_MIDI: { [note: string]: number } = {};
const MIDI_TO_NOTE: { [midi: number]: string } = {};

ALL_NOTES_CHROMATIC.forEach((note, index) => {
    // Standard MIDI numbering where A4 is 69. C1 in our constant map corresponds to MIDI 24.
    const midi = 24 + index;
    NOTE_TO_MIDI[note] = midi;
    MIDI_TO_NOTE[midi] = note;
});

const getNoteFromMidi = (midi: number): string | null => {
    return MIDI_TO_NOTE[midi] ?? null;
};

// --- Note Name Formatting and Normalization ---

/**
 * Returns an array of key names for UI display, preferring sharps or flats.
 */
export const getDisplayKeys = (preferFlats: boolean): string[] => {
    return preferFlats ? FLAT_KEYS : SHARP_KEYS;
};

/**
 * Normalizes a note name to its sharp equivalent for internal processing.
 * E.g., "B♭" -> "A#", "C" -> "C", "D♭4" -> "C#4"
 */
export const normalizeNoteName = (note: string): string => {
    const match = note.match(/([A-G](?:#|♭)?)(\d*)/);
    if (!match) return note; // Return original if it doesn't look like a note

    const notePart = match[1]; // e.g., "B♭"
    const octavePart = match[2] || ''; // e.g., "4" or ""

    const sharpName = FLAT_TO_SHARP[notePart];
    if (sharpName) {
        return sharpName + octavePart;
    }
    return note; // Return original if it's not a flat that needs conversion
};

/**
 * Formats an internal (sharp-based) note name for display, honoring the user's preference.
 * E.g., formatNoteName("A#4", true) -> "B♭4"
 */
export const formatNoteName = (note: string, preferFlats: boolean): string => {
    if (!preferFlats) {
        return note;
    }
    const noteName = note.slice(0, 2);
    const flatName = SHARP_TO_FLAT[noteName];
    if (flatName) {
        return flatName + note.slice(2);
    }
    return note;
};


// --- Chord Formulas (in semitones from root) ---
const CHORD_FORMULAS: { [key: string]: number[] } = {
    major: [0, 4, 7],
    dominant7: [0, 7, 10, 16], // Root, 5th, Minor 7th, Major 3rd (1 octave up) - Open Voicing
    minor: [0, 3, 7],
    diminished: [0, 3, 6],
    diminished7: [0, 3, 6, 9],
    augmented: [0, 4, 8],
};

// --- Diatonic Scale and Chord Data ---

// FIX: The values are numbers, so the type should be `number`, not `string`. This fixes multiple downstream errors.
export const NOTE_NAME_TO_CHROMATIC_INDEX: { [name: string]: number } = {
    'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11,
    'D♭': 1, 'E♭': 3, 'G♭': 6, 'A♭': 8, 'B♭': 10
};

const NOTE_CHROMA: { [noteName: string]: number } = {};
Object.keys(NOTE_NAME_TO_CHROMATIC_INDEX).forEach(name => {
    NOTE_CHROMA[name.toLowerCase()] = NOTE_NAME_TO_CHROMATIC_INDEX[name];
});
ALL_NOTES_CHROMATIC.forEach(fullNote => {
    const match = fullNote.match(/([A-G]#?)/);
    if (match) {
        NOTE_CHROMA[fullNote] = NOTE_NAME_TO_CHROMATIC_INDEX[match[1]];
    }
});

export const getSolfegeSyllable = (note: string, key: string, preferFlats: boolean): string | null => {
    const noteMatch = note.match(/([A-G](?:#|♭)?)/);
    if (!noteMatch) return null;
    
    const normalizedKey = normalizeNoteName(key);

    const noteChroma = NOTE_NAME_TO_CHROMATIC_INDEX[noteMatch[1]];
    const keyChroma = NOTE_NAME_TO_CHROMATIC_INDEX[normalizedKey];

    if (noteChroma === undefined || keyChroma === undefined) return null;

    const interval = (noteChroma - keyChroma + 12) % 12;

    const syllables = preferFlats ? SOLFEGE_SYLLABLES_FLAT : SOLFEGE_SYLLABLES_SHARP;
    
    return syllables[interval] ?? null;
};

/**
 * Formats a note chroma (e.g., "C#") for display, honoring flat preference.
 */
export const formatNoteChromaName = (chroma: string, preferFlats: boolean): string => {
    if (!preferFlats) return chroma;
    return SHARP_TO_FLAT[chroma] || chroma;
};

/**
 * Gets detailed information for a specific degree of a diatonic scale.
 * @param key The root key of the scale (e.g., "C", "G#").
 * @param degree The scale degree (1-7).
 * @param preferFlats Whether to format note names with flats.
 * @returns An object with the roman numeral, chord name, and quality, or null if invalid.
 */
export const getDiatonicChordInfo = (key: string, degree: number, preferFlats: boolean): { roman: string; name: string; quality: 'major' | 'minor' | 'diminished' } | null => {
    const normalizedKey = normalizeNoteName(key);
    const keyChromaIndex = NOTE_NAME_TO_CHROMATIC_INDEX[normalizedKey];

    if (keyChromaIndex === undefined || degree < 1 || degree > 7) {
        return null;
    }

    const degreeIndex = degree - 1;

    const rootNoteInterval = MAJOR_SCALE_INTERVALS[degreeIndex];
    if (rootNoteInterval === undefined) return null;

    const chordRootChroma = (keyChromaIndex + rootNoteInterval) % 12;
    const chordRootName = SHARP_KEYS[chordRootChroma];
    if (!chordRootName) return null;

    const displayChordRootName = formatNoteChromaName(chordRootName, preferFlats);

    const quality = MAJOR_SCALE_CHORD_QUALITIES[degreeIndex] as 'major' | 'minor' | 'diminished';
    if (!quality) return null;

    let chordName = displayChordRootName;
    if (quality === 'minor') chordName += 'm';
    if (quality === 'diminished') chordName += '°';
    
    let roman = ROMAN_NUMERALS[degreeIndex];
    if (quality === 'minor' || quality === 'diminished') {
        roman = roman.toLowerCase();
    }
    
    if (quality === 'diminished') {
        roman = `${roman}°`;
    }

    return { roman, name: chordName, quality };
};


// --- Diatonic Chord Generation ---
const getDiatonicChord = (rootNote: string, key: string, scale: 'major' | 'minor'): string[] => {
    const normalizedRootNote = normalizeNoteName(rootNote);
    const normalizedKey = normalizeNoteName(key);

    const rootMidi = NOTE_TO_MIDI[normalizedRootNote];
    const rootMatch = normalizedRootNote.match(/([A-G]#?)/);
    
    if (rootMidi === undefined || !rootMatch) {
        return [rootNote];
    }
    const rootNoteName = rootMatch[1];
    const rootChromaIndex = NOTE_NAME_TO_CHROMATIC_INDEX[rootNoteName];
    const keyChromaIndex = NOTE_NAME_TO_CHROMATIC_INDEX[normalizedKey];

    if (rootChromaIndex === undefined || keyChromaIndex === undefined) {
      return [rootNote];
    }

    const scaleIntervals = scale === 'major' ? MAJOR_SCALE_INTERVALS : MINOR_SCALE_INTERVALS;
    const chordQualities = scale === 'major' ? MAJOR_SCALE_CHORD_QUALITIES : MINOR_SCALE_CHORD_QUALITIES;

    // Generate a Set of the chromatic indices of all notes in the selected scale for an efficient check.
    const scaleNoteChromas = new Set(scaleIntervals.map(interval => (keyChromaIndex + interval) % 12));
    
    // If the root note's chroma is not in the scale, treat it as a passing diminished chord.
    if (!scaleNoteChromas.has(rootChromaIndex)) {
        const diminished7Formula = CHORD_FORMULAS['diminished7'];
        if (!diminished7Formula) return [rootNote]; // Safety check

        const chordNotes = diminished7Formula.map(interval => getNoteFromMidi(rootMidi + interval)).filter(n => n !== null) as string[];
        return chordNotes;
    }
    
    // Determine the scale degree to find the correct chord quality.
    // The '+ 12' ensures the result is positive before the modulo.
    const intervalFromKeyRoot = (rootChromaIndex - keyChromaIndex + 12) % 12;
    const scaleDegreeIndex = scaleIntervals.indexOf(intervalFromKeyRoot);
    
    // This check is a safeguard; it should not be triggered if the .has() check above passed.
    if (scaleDegreeIndex === -1) {
        return [rootNote];
    }
    
    const chordQuality = chordQualities[scaleDegreeIndex];
    const formula = CHORD_FORMULAS[chordQuality];
    
    if (!formula) {
        return [rootNote];
    }
    
    const chordNotes = formula.map(interval => getNoteFromMidi(rootMidi + interval)).filter(n => n !== null) as string[];
    return chordNotes;
};


// --- Main Exported Function ---
export const getChordNotes = (
    rootNote: string, 
    mode: ChordMode, 
    diatonicSettings: { key: string; scale: 'major' | 'minor' }
): string[] => {
    const normalizedRootNote = normalizeNoteName(rootNote);
    const rootMidi = NOTE_TO_MIDI[normalizedRootNote];
    if (rootMidi === undefined) return [rootNote];

    if (mode === 'diatonic') {
        return getDiatonicChord(rootNote, diatonicSettings.key, diatonicSettings.scale);
    }
    
    const formula = CHORD_FORMULAS[mode];
    if (!formula) return [rootNote];
    
    const chordNotes = formula.map(interval => {
        const midi = rootMidi + interval;
        return getNoteFromMidi(midi);
    }).filter(note => note !== null) as string[];
    
    return chordNotes;
};

// --- Chord Helper Function ---
export const getDiatonicChordNotesForKey = (key: string, degree: 1 | 4 | 5 | 6): string[] => {
    const normalizedKey = normalizeNoteName(key);
    const keyChromaIndex = NOTE_NAME_TO_CHROMATIC_INDEX[normalizedKey];
    if (keyChromaIndex === undefined) return [];
    
    // Major scale is used as the basis for I, IV, V, vi
    const scaleIntervals = MAJOR_SCALE_INTERVALS;
    
    // Get the root note of the desired chord
    const degreeIndex = degree === 6 ? 5 : degree - 1; // vi is the 6th note (index 5)
    const rootNoteInterval = scaleIntervals[degreeIndex];
    const chordRootChroma = (keyChromaIndex + rootNoteInterval) % 12;
    
    // Determine the chord quality
    const quality = (degree === 6) ? 'minor' : 'major';
    const formula = CHORD_FORMULAS[quality];
    if (!formula) return [];
    
    // Find the chromatic indices of all notes in the chord
    const chordNoteChromas = new Set(formula.map(interval => (chordRootChroma + interval) % 12));
    
    // Filter the keyboard notes to find all matching notes across octaves
    const notesOnKeyboard = KEYBOARD_NOTES.map(k => k.note);
    return notesOnKeyboard.filter(note => {
        const normalizedNote = normalizeNoteName(note);
        const match = normalizedNote.match(/([A-G]#?)/);
        if (!match) return false;
        const chroma = NOTE_NAME_TO_CHROMATIC_INDEX[match[1]];
        return chroma !== undefined && chordNoteChromas.has(chroma);
    });
};

/**
 * Attempts to detect a chord from a set of notes.
 * Simple algorithm checks intervals against Major, Minor, and Diminished triads.
 */
export const detectChordFromNotes = (notes: string[]): string | null => {
    if (notes.length === 0) return null;

    // 1. Convert to unique chromatic indices (0-11)
    const chromas = Array.from(new Set(notes.map(n => {
        const norm = normalizeNoteName(n);
        const match = norm.match(/([A-G]#?)/);
        return match ? NOTE_NAME_TO_CHROMATIC_INDEX[match[1]] : null;
    }).filter(c => c !== null && c !== undefined))) as number[];

    if (chromas.length === 0) return null;

    // If only one distinct note, return just that note
    if (chromas.length === 1) {
        return SHARP_KEYS[chromas[0]];
    }

    // 2. Brute force check: Treat each note as the root
    for (const root of chromas) {
        // Calculate intervals relative to this root
        const intervals = chromas.map(c => (c - root + 12) % 12).sort((a, b) => a - b);
        
        // Helper to check subset
        const has = (vals: number[]) => vals.every(v => intervals.includes(v));

        const rootName = SHARP_KEYS[root];

        // Major Triad: 0, 4, 7
        if (has([0, 4, 7])) return rootName; // e.g. "C"
        
        // Minor Triad: 0, 3, 7
        if (has([0, 3, 7])) return `${rootName}m`;

        // Diminished: 0, 3, 6
        if (has([0, 3, 6])) return `${rootName}°`;
        
        // Sus4: 0, 5, 7
        if (has([0, 5, 7])) return `${rootName}sus4`;
        
         // Sus2: 0, 2, 7
        if (has([0, 2, 7])) return `${rootName}sus2`;
    }
    
    // If no perfect triad match, just return the first note as a fallback/bass note
    return SHARP_KEYS[chromas[0]];
};
