// Voice Agent with Chunk-based Recording & Pre-roll Buffer
import { Ionicons } from '@expo/vector-icons';
import { decode as b64d, encode as b64e } from 'base-64';
import ExpoAudioStudio from 'expo-audio-studio';
import * as FileSystem from 'expo-file-system/legacy';
import { writeAsStringAsync } from 'expo-file-system/legacy';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Easing,
    Keyboard,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
// import soundex from 'soundex-code';
import { useCommandContext } from '../context/CommandContext';
import { useCommandSearch } from '../hooks/useCommandSearch';
import { useWhisperModels } from '../hooks/useWhisperModesls';

// const route = useRoute();
// const currentPage = route.name; // e.g., 'all-shops', 'individual-shop', 'individual-product'


// ─────────────────────────────────────────────────────────────
// WAV Header Creation & Chunk Processing Utils
// ─────────────────────────────────────────────────────────────
const createWavHeader = (
    dataLength: number,
    sampleRate: number = 16000,
    numChannels: number = 1,
    bitsPerSample: number = 16
): Uint8Array => {
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const chunkSize = 36 + dataLength;

    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);

    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, chunkSize, true);
    view.setUint32(8, 0x57415645, false); // "WAVE"
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, dataLength, true);

    return new Uint8Array(buffer);
};

const chunksToWav = async (base64Chunks: string[], filename: string): Promise<string> => {
    if (base64Chunks.length === 0) {
        throw new Error('No audio chunks to process');
    }

    console.log(`[ChunksToWav] Processing ${base64Chunks.length} chunks...`);

    const decodedChunks = base64Chunks.map((chunk, index) => {
        try {
            const binaryString = b64d(chunk);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            return bytes;
        } catch (error) {
            console.error(`Error decoding chunk ${index}:`, error);
            throw error;
        }
    });

    const totalLength = decodedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const pcmData = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of decodedChunks) {
        pcmData.set(chunk, offset);
        offset += chunk.length;
    }

    const wavHeaderBytes = createWavHeader(totalLength);
    const completeWavData = new Uint8Array(44 + totalLength);
    completeWavData.set(wavHeaderBytes, 0);
    completeWavData.set(pcmData, 44);

    // Convert to base64 in chunks to avoid memory issues
    const chunkSize = 1024 * 1024;
    const base64Parts: string[] = [];

    for (let i = 0; i < completeWavData.length; i += chunkSize) {
        const chunk = completeWavData.slice(i, Math.min(i + chunkSize, completeWavData.length));
        const binaryString = Array.from(chunk, (byte) => String.fromCharCode(byte)).join('');
        base64Parts.push(b64e(binaryString));
    }

    const wavFileBase64 = base64Parts.join('');

    console.log(`[ChunksToWav] Writing WAV file (${wavFileBase64.length} base64 chars)`);

    await writeAsStringAsync(filename, wavFileBase64, { encoding: 'base64' });

    return filename;
};

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const INPUT_COMMANDS = [
    'search-for-shop-name',
    'add-name',
    'add-category',
    'add-brand',
    'add-manufacturer',
    'add-price',
    'add-quantity',
];

const SILENCE_FINAL_MS = 800;
const RESTART_DELAY_MS = 200;
const PRE_ROLL_SEC = 5; // Pre-roll buffer duration in seconds
const SAMPLE_RATE = 16000;
const BYTES_PER_SAMPLE = 2; // 16-bit audio
const CHUNK_DURATION_MS = 100; // Approximate chunk duration

// Calculate how many chunks to keep for pre-roll
const PRE_ROLL_CHUNKS = Math.ceil((PRE_ROLL_SEC * 1000) / CHUNK_DURATION_MS);


// soundex('phonetics'); // 'P532'
// soundex('Ashcraft'); // 'A261'
// soundex('Lissajous'); // 'L222'
// soundex('Smith') === soundex('Schmit'); // true

// soundex('Ashcraftersson', 6); // 'A26136'
// soundex('A', 6); // 'A000'

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
type CommandOverlayProps = {
    currentPage: string;
};


export default function CommandOverlay({ currentPage }: CommandOverlayProps) {
    console.log("current page is ", currentPage)


    const { handleCommandInput } = useCommandContext();
    // --- UI Helper Logic ---
    const formatContext = (name: string) => name ? name.replace(/-/g, ' ').toUpperCase() : 'AI AGENT';

    // Dynamic Theme Color based on state
    // Dynamic Theme Color based on state


    const { searchCommand, isReady: isEmbeddingReady, downloadProgress: embeddingProgress } = useCommandSearch();

    // Status States
    const [isRecording, setIsRecording] = useState(false);
    const [isLooping, setIsLooping] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [vadStatus, setVadStatus] = useState('Idle');
    const [matched, setMatched] = useState<string | null>(null);

    const [rawasr, setRawasr] = useState('None')
    const [correctedasr, setCorrectedasr] = useState('None')
    const [command, setCommand] = useState(null)

    // Trigger Mode
    const [activeTrigger, setActiveTrigger] = useState<string | null>(null);
    const activeTriggerRef = useRef<string | null>(null);

    const setTriggerMode = (mode: string | null) => {
        setActiveTrigger(mode);
        activeTriggerRef.current = mode;
    };

    // UI State
    const [mainDisplay, setMainDisplay] = useState<string>('Tap mic to start');
    const [isInputMatch, setIsInputMatch] = useState(false);

    // Playback States
    const [lastRecordingUri, setLastRecordingUri] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    // Model States
    const [isInitializing, setIsInitializing] = useState(false);

    // ─────────────────────────────────────────────────────────────
    // Chunk Recording Refs
    // ─────────────────────────────────────────────────────────────
    const preRollBufferRef = useRef<string[]>([]);
    const recordingChunksRef = useRef<string[]>([]);
    const isCapturingRef = useRef(false);
    const chunkListenerRef = useRef<any>(null);


    const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const voiceSubRef = useRef<any>(null);
    const playerStatusSubRef = useRef<any>(null);
    const stopCalledRef = useRef(false);
    const isLoopingRef = useRef(false);

    const { whisperContext, initializeWhisperModel, isInitializingModel } = useWhisperModels();


    const currentPageRef = useRef(currentPage);

    useEffect(() => {
        currentPageRef.current = currentPage;
    }, [currentPage]);

    const initializeModel = async () => {
        try {
            setIsInitializing(true);
            await initializeWhisperModel('base', { initVad: false });
        } catch (err) {
            console.error('Model init failed:', err);
            Alert.alert('Error', 'Could not initialize Whisper model.');
        } finally {
            setIsInitializing(false);
        }
    };

    useEffect(() => {
        if (!whisperContext && !isInitializingModel && !isInitializing) {
            initializeModel();
        }
        return () => {
            stopLoop();
            cleanupListeners();
        };
    }, []);

    const cleanupListeners = () => {
        if (voiceSubRef.current) voiceSubRef.current.remove();
        if (playerStatusSubRef.current) playerStatusSubRef.current.remove();
        if (chunkListenerRef.current) chunkListenerRef.current.remove();
        ExpoAudioStudio.removeAllListeners('onAudioChunk');
    };

    // Keyboard Animation
    const keyboardHeight = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
        const onShow = (event: any) =>
            Animated.timing(keyboardHeight, {
                toValue: event.endCoordinates.height,
                duration: 250,
                easing: Easing.out(Easing.ease),
                useNativeDriver: false,
            }).start();
        const onHide = () =>
            Animated.timing(keyboardHeight, {
                toValue: 0,
                duration: 250,
                easing: Easing.out(Easing.ease),
                useNativeDriver: false,
            }).start();

        Keyboard.addListener(showEvent, onShow);
        Keyboard.addListener(hideEvent, onHide);
    }, [keyboardHeight]);

    // Player Listeners
    useEffect(() => {
        try {
            playerStatusSubRef.current = ExpoAudioStudio.addListener('onPlayerStatusChange', (event) => {
                setIsPlaying(Boolean(event?.isPlaying));
            });
        } catch (e) {
            playerStatusSubRef.current = null;
        }
    }, []);

    // ─────────────────────────────────────────────────────────────
    // Chunk Handler - Manages pre-roll buffer and recording
    // ─────────────────────────────────────────────────────────────
    const handleAudioChunk = (chunk: { base64: string }) => {
        if (!chunk?.base64) return;

        if (isCapturingRef.current) {
            // We're capturing speech - add to recording chunks
            recordingChunksRef.current.push(chunk.base64);
        } else {
            // Not capturing yet - maintain circular pre-roll buffer
            preRollBufferRef.current.push(chunk.base64);
            // Keep only the last PRE_ROLL_CHUNKS
            if (preRollBufferRef.current.length > PRE_ROLL_CHUNKS) {
                preRollBufferRef.current.shift();
            }
        }
    };

    // ─────────────────────────────────────────────────────────────
    // Start Capturing (when voice detected)
    // ─────────────────────────────────────────────────────────────
    const startCapturing = () => {
        if (isCapturingRef.current) return;

        console.log('[VAD] Voice detected - starting capture with pre-roll');
        isCapturingRef.current = true;

        // Include pre-roll buffer in recording
        recordingChunksRef.current = [...preRollBufferRef.current];
        preRollBufferRef.current = [];

        console.log(`[VAD] Pre-roll chunks included: ${recordingChunksRef.current.length}`);
    };

    // ─────────────────────────────────────────────────────────────
    // Stop Capturing & Process (when silence detected)
    // ─────────────────────────────────────────────────────────────
    const stopCapturingAndProcess = async () => {
        if (!isCapturingRef.current) return;

        console.log('[VAD] Silence detected - stopping capture');
        isCapturingRef.current = false;

        const chunks = [...recordingChunksRef.current];
        recordingChunksRef.current = [];
        preRollBufferRef.current = [];

        if (chunks.length === 0) {
            console.log('[VAD] No chunks captured');
            setMatched('No audio captured');
            return;
        }

        console.log(`[VAD] Processing ${chunks.length} chunks`);
        setVadStatus('Agent-Processing....');
        setMainDisplay('Agent-Processing....');

        try {
            const wavPath = `${FileSystem.cacheDirectory}voice_${Date.now()}.wav`;
            await chunksToWav(chunks, wavPath);
            console.log('[VAD] WAV file created:', wavPath);

            setLastRecordingUri(wavPath);
            await transcribeFile(wavPath);

            // NOTE: Don't delete the file here - keep it for playback
            // File will be overwritten on next recording
        } catch (error) {
            console.error('[VAD] Chunk processing error:', error);
            setMatched('Processing failed');
            setMainDisplay('Error');
        }
    };

    // ─────────────────────────────────────────────────────────────
    // Transcribe & Process
    // ─────────────────────────────────────────────────────────────
    const transcribeFile = async (filePath: string) => {
        if (!whisperContext) return;

        let cleanFilePath = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
        // console.log(soundex('Smith') === soundex('Schmit') ,  " photontic matching "); // true
        setVadStatus('Transcribing...');
        if (!activeTriggerRef.current) setIsInputMatch(false);

        try {
            const fileInfo = await FileSystem.getInfoAsync(cleanFilePath);
            if (!fileInfo.exists) throw new Error('File not found');

            const { promise } = whisperContext.transcribe(cleanFilePath, { language: 'en' });
            const { result } = await promise;
            const text = result.trim();
            // DESTRUCTURE the new object
            const { command, correctedText } = await searchCommand(text, currentPageRef.current);


            console.log(`Raw: ${text} | Corrected: ${correctedText} | Command: ${command}`);
            setRawasr(text)
            setCorrectedasr(correctedText)
            setCommand(command)


            if (command) {
                // COMMAND FOUND
                if (INPUT_COMMANDS.includes(command)) {
                    setTriggerMode(command);
                    setIsInputMatch(true);
                    setMainDisplay(command.toUpperCase());
                    handleCommandInput(command);
                    setMatched(`Trigger: ${command}`);
                } else {
                    setTriggerMode(null);
                    setIsInputMatch(false);
                    setMainDisplay(command.toUpperCase());
                    handleCommandInput(command);
                    setMatched(`Command: ${command}`);
                }
            } else {
                // NO COMMAND FOUND
                if (activeTriggerRef.current) {
                    // We are filling an input (e.g. "Add Name")
                    // USE CORRECTED TEXT HERE
                    const trigger = activeTriggerRef.current;
                    setIsInputMatch(true);

                    // Now we send "Maaza" instead of "Mazam"
                    handleCommandInput(`${trigger}:${correctedText}`);
                    setMainDisplay(`${trigger}: ${correctedText}`);
                    setMatched(`Input for ${trigger}: ${correctedText}`);
                } else {
                    setMatched('Ignored');
                    // Display the cleaned up text
                    setMainDisplay(correctedText);
                }
            }
        } catch (error: any) {
            console.error('Transcription FAILED:', error);
            setMatched('Transcription failed');
            setMainDisplay('Error');
        }
    };

    // ─────────────────────────────────────────────────────────────
    // Main Loop Control
    // ─────────────────────────────────────────────────────────────
    const toggleListening = async () => {
        if (isLoopingRef.current) {
            await stopLoop();
            setMainDisplay('Paused');
            setIsInputMatch(false);
            setTriggerMode(null);
        } else {
            startLoop();
        }
    };

    const startLoop = async () => {
        setIsLooping(true);
        isLoopingRef.current = true;
        await startVAD();
    };

    const stopLoop = async () => {
        setIsLooping(false);
        isLoopingRef.current = false;
        setVadStatus('Idle');
        if (isRecording) {
            await stopVAD();
        }
    };

    // ─────────────────────────────────────────────────────────────
    // VAD / Recording with Chunks
    // ─────────────────────────────────────────────────────────────
    const checkPermissions = async () => {
        try {
            const perm = (ExpoAudioStudio as any).requestMicrophonePermission
                ? await (ExpoAudioStudio as any).requestMicrophonePermission()
                : { granted: true };
            return !(perm && (perm.granted === false || (perm !== true && !perm.granted)));
        } catch (err) {
            return false;
        }
    };

    const startVAD = async () => {
        if (isRecording || !whisperContext) return;
        if (!isLoopingRef.current) return;

        const ok = await checkPermissions();
        if (!ok) {
            stopLoop();
            Alert.alert('Permission', 'Microphone access needed.');
            return;
        }

        stopCalledRef.current = false;
        setIsRecording(true);
        setVadStatus('Agent-Waiting...');

        // Reset chunk buffers
        preRollBufferRef.current = [];
        recordingChunksRef.current = [];
        isCapturingRef.current = false;

        if (activeTriggerRef.current) {
            setMainDisplay(`Input: ${activeTriggerRef.current.toUpperCase()}`);
            setIsInputMatch(true);
        } else {
            setMainDisplay('Agent-Waiting...');
            setIsInputMatch(false);
        }

        setIsSpeaking(false);

        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }

        try {
            // Configure audio session for iOS
            if (Platform.OS === 'ios') {
                await ExpoAudioStudio.configureAudioSession({
                    category: 'playAndRecord',
                    mode: 'default',
                    options: {
                        defaultToSpeaker: true,
                        allowBluetooth: true,
                        allowBluetoothA2DP: true,
                    },
                });
                await ExpoAudioStudio.activateAudioSession();
            }

            // Enable chunk listening
            ExpoAudioStudio.setListenToChunks(true);

            // Setup chunk listener
            if (chunkListenerRef.current) {
                chunkListenerRef.current.remove();
            }
            chunkListenerRef.current = ExpoAudioStudio.addListener('onAudioChunk', handleAudioChunk);

            // Configure VAD
            await ExpoAudioStudio.setVoiceActivityThreshold(0.5);
            await ExpoAudioStudio.setVADEventMode('onChange');
            await ExpoAudioStudio.setVADEnabled(true);

            // Start recording (this enables the audio stream)
            ExpoAudioStudio.startRecording();

            // Setup VAD listener
            voiceSubRef.current = ExpoAudioStudio.addListener('onVoiceActivityDetected', (event: any) => {
                const isVoiceDetected = Boolean(event?.isVoiceDetected);
                setIsSpeaking(isVoiceDetected);

                const modeText = activeTriggerRef.current ? ` (${activeTriggerRef.current})` : '';
                setVadStatus(isVoiceDetected ? `Speaking...${modeText}` : `Agent-Waiting...${modeText}`);

                if (isVoiceDetected) {
                    // Voice detected - start capturing
                    setMainDisplay('Speaking...');
                    startCapturing();

                    if (silenceTimerRef.current) {
                        clearTimeout(silenceTimerRef.current);
                        silenceTimerRef.current = null;
                    }
                } else {
                    // Silence detected - schedule stop
                    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

                    if (isCapturingRef.current) {
                        silenceTimerRef.current = setTimeout(async () => {
                            await stopVAD();
                        }, SILENCE_FINAL_MS);
                    }
                }
            });

            console.log('[VAD] Started with chunk recording enabled');
        } catch (error) {
            console.error('VAD start error:', error);
            await stopLoop();
        }
    };

    const stopVAD = async () => {
        if (!isRecording && stopCalledRef.current) return;
        stopCalledRef.current = true;

        if (voiceSubRef.current) voiceSubRef.current.remove();
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

        setIsRecording(false);
        setIsSpeaking(false);
        setVadStatus('Agent-Processing....');

        try {
            // Stop recording
            ExpoAudioStudio.stopRecording();

            // Disable chunk listening
            ExpoAudioStudio.setListenToChunks(false);
            if (chunkListenerRef.current) {
                chunkListenerRef.current.remove();
                chunkListenerRef.current = null;
            }

            // Process captured chunks
            if (isCapturingRef.current || recordingChunksRef.current.length > 0) {
                await stopCapturingAndProcess();
            } else {
                setMatched('No speech detected');
                setMainDisplay('No speech');
            }
        } catch (err) {
            console.error('Stop VAD error:', err);
            setMatched('Error processing audio');
        } finally {
            stopCalledRef.current = false;

            if (isLoopingRef.current) {
                setVadStatus('Restarting...');
                setTimeout(() => {
                    startVAD();
                }, RESTART_DELAY_MS);
            } else {
                setVadStatus('Idle');
            }
        }
    };

    const handlePlayback = async () => {
        if (!lastRecordingUri) {
            console.log('[Playback] No recording URI available');
            return;
        }

        try {
            // Check if file exists
            const fileInfo = await FileSystem.getInfoAsync(lastRecordingUri);
            if (!fileInfo.exists) {
                console.log('[Playback] File does not exist:', lastRecordingUri);
                Alert.alert('Error', 'Recording file not found');
                return;
            }

            console.log('[Playback] File exists, size:', fileInfo.size);

            if (isPlaying) {
                console.log('[Playback] Stopping playback');
                ExpoAudioStudio.stopPlaying();
            } else {
                console.log('[Playback] Starting playback:', lastRecordingUri);
                const result = ExpoAudioStudio.startPlaying(lastRecordingUri);
                console.log('[Playback] Result:', result);
            }
        } catch (e) {
            console.error('[Playback] Error:', e);
            Alert.alert('Playback Error', String(e));
        }
    };

    const isWhisperReady = !!whisperContext && !isInitializingModel && !isInitializing;
    const isSystemReady = isWhisperReady && isEmbeddingReady;

    // Determine mic background and ring color based on status
    // let micBackgroundColor = '#9E9E9E'; // default grey
    // let micRingColor = '#64B5F6'; // default light blue
    // Determine mic background and ring color based on status
    let micBackgroundColor = '#9E9E9E'; // default grey
    let micRingColor = '#64B5F6'; // default blue

    if (isSystemReady) {
        const statusLower = vadStatus.toLowerCase();
        if (statusLower.includes('speaking')) {
            micBackgroundColor = '#D32F2F'; // red
            micRingColor = '#FF5252';
        } else if (statusLower.includes('listening')) {
            micBackgroundColor = '#1976D2'; // blue
            micRingColor = '#64B5F6';
        } else if (statusLower.includes('transcribing')) {
            micBackgroundColor = '#FFB300'; // amber/yellow
            micRingColor = '#FFC107';
        } else if (statusLower.includes('paused')) {
            micBackgroundColor = '#9E9E9E'; // grey
            micRingColor = '#B0BEC5';
        }
    }

    return (
        <Animated.View
        style={[
            styles.agentContainer,
            { bottom: Animated.add(20, keyboardHeight) }
        ]}
        pointerEvents="box-none"
    >
        {/* Context Badge */}
        <View style={styles.contextBadge}>
            <Ionicons name="sparkles" size={10} color="#fff" style={{ marginRight: 4 }} />
            <Text style={styles.contextText}>Data-Collection Agent</Text>
        </View>

        {/* Main Card */}
        <View style={[styles.card, { borderColor: isInputMatch ? '#FFB74D' : '#fff' }]}>

            {/* TOP ROW: Header Info + Mic Button */}
            <View style={styles.topRow}>
                <View style={styles.headerInfo}>
                    <View style={styles.contextRow}>
                        <Text style={styles.pageText}>{formatContext(currentPage)}</Text>
                        {lastRecordingUri && (
                            <TouchableOpacity onPress={handlePlayback} style={styles.miniPlayBtn}>
                                <Ionicons name={isPlaying ? "stop" : "play"} size={12} color="#119ada" />
                            </TouchableOpacity>
                        )}
                    </View>
                    {/* Main Prompt Text */}
                    <Text
                        style={[
                            styles.mainText,
                            isInputMatch && { color: '#E65100' },
                            !isLooping && { color: '#888' }
                        ]}
                        numberOfLines={2}
                    >
                        {mainDisplay}
                    </Text>
                </View>

                {/* Compact Mic Button */}
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={toggleListening}
                    disabled={!isSystemReady}
                    style={styles.micContainer}
                >
                    <View
                        style={[
                            styles.micRing,
                            {
                                borderColor: micRingColor,
                                opacity: isLooping ? 0.4 : 0,
                                transform: [{ scale: isSpeaking ? 1.1 : 1 }],
                            },
                        ]}
                    />
                    <View style={[styles.micButton, { backgroundColor: micBackgroundColor }]}>
                        {!isSystemReady ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Ionicons
                                name={isLooping ? (isSpeaking ? 'mic' : 'mic-outline') : 'mic-off'}
                                size={20}
                                color="#fff"
                            />
                        )}
                    </View>
                </TouchableOpacity>
            </View>

            {/* PROCESS PIPELINE (Shows if we have any input) */}
            {(rawasr || command) && (
                <View style={styles.pipelineContainer}>
                    
                    {/* Step 1: Raw Input */}
                    <View style={styles.logRow}>
                        <View style={styles.timelineLeft}>
                            <View style={[styles.dot, { backgroundColor: '#999' }]} />
                            <View style={styles.line} />
                        </View>
                        <View style={styles.contentRight}>
                            <Text style={styles.label}>RAW INPUT</Text>
                            <Text style={styles.logText}>{rawasr || 'Agent-Waiting...'}</Text>
                        </View>
                    </View>

                    {/* Step 2: Phonic Match */}
                    <View style={styles.logRow}>
                        <View style={styles.timelineLeft}>
                            <View style={[styles.dot, { backgroundColor: '#FF9800' }]} />
                            {/* Always show line now, because Step 3 (Action OR Input) always exists if Step 2 exists */}
                            <View style={styles.line} />
                        </View>
                        <View style={styles.contentRight}>
                            <Text style={[styles.label, { color: '#F57C00' }]}>PHONIC MATCH</Text>
                            <Text style={styles.logText}>{correctedasr || 'Agent-Processing....'}</Text>
                        </View>
                    </View>

                    {/* Step 3: EITHER Action OR Data Input Fill */}
                    <View style={styles.logRow}>
                        <View style={styles.timelineLeft}>
                            {/* Icon changes based on Success (Command) vs Info (Data Entry) */}
                            <Ionicons 
                                name={command ? "checkmark-circle" : "pencil"} 
                                size={14} 
                                color={command ? "#4CAF50" : "#119ada"} 
                                style={{ marginLeft: -3 }} 
                            />
                        </View>
                        
                        <View style={styles.contentRight}>
                            {command ? (
                                // Case A: Command Found (Green Action)
                                <>
                                    <View style={[styles.badge, { backgroundColor: '#4CAF50' }]}>
                                        <Ionicons name="flash" size={8} color="#fff" style={{ marginRight: 4 }} />
                                        <Text style={styles.badgeText}>ACTION EXECUTED</Text>
                                    </View>
                                    <Text style={[styles.finalText, { color: '#2E7D32' }]}>{command}</Text>
                                </>
                            ) : (
                                // Case B: No Command -> Filled Input Box (Blue Data Entry)
                                <View style={styles.inputBoxWrapper}>
                                    <View style={[styles.badge, { backgroundColor: '#119ada' }]}>
                                        <Ionicons name="create" size={8} color="#fff" style={{ marginRight: 4 }} />
                                        <Text style={styles.badgeText}>FILLING DATA</Text>
                                    </View>
                                    <View style={styles.simulatedInput}>
                                        <Text style={[styles.finalText, { color: '#0277BD' }]}>
                                            {correctedasr || rawasr || "..."}
                                        </Text>
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>

                </View>
            )}
        </View>
    </Animated.View>
    );

}


const styles = StyleSheet.create({
    agentContainer: {
        position: 'absolute',
        left: 16,
        right: 16,
        alignItems: 'center',
        zIndex: 9999,
    },
    contextBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginBottom: -10,
        zIndex: 10,
        backgroundColor: '#ff6f5c',
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 5,
    },
    contextText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },

    card: {
        width: '100%',
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 16,
        paddingTop: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 8,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },

    /* Top Row */
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
    headerInfo: { flex: 1, paddingRight: 10 },
    contextRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    pageText: { color: "#aaa", fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
    miniPlayBtn: { marginLeft: 8 },
    mainText: { fontSize: 16, fontWeight: '600', color: '#222', lineHeight: 22 },

    /* Mic Button */
    micContainer: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
    micRing: { position: 'absolute', width: 44, height: 44, borderRadius: 22, borderWidth: 2 },
    micButton: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 2 }, elevation: 3 },

    /* Pipeline Styles */
    pipelineContainer: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f5f5f5' },
    logRow: { flexDirection: 'row', marginBottom: 0 }, // Reduced bottom margin, let content handle it
    timelineLeft: { width: 16, alignItems: 'center', marginRight: 8, paddingTop: 4 },
    dot: { width: 8, height: 8, borderRadius: 4, marginBottom: 2 },
    line: { width: 1, flex: 1, backgroundColor: '#e0e0e0', minHeight: 15 }, // Guaranteed min-height connecting lines
    contentRight: { flex: 1, paddingBottom: 12 }, // Padding bottom here separates the rows
    label: { fontSize: 9, color: '#999', fontWeight: '700', marginBottom: 2 },
    logText: { fontSize: 13, color: '#444', fontWeight: '500', lineHeight: 18 },
    
    /* Shared Badge Styles (Green Action & Blue Input) */
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginBottom: 4,
    },
    badgeText: { fontSize: 9, color: '#fff', fontWeight: '800' },
    finalText: { fontSize: 14, fontWeight: 'bold' },

    /* Input Box Specific Styles */
    inputBoxWrapper: {
        marginTop: 0,
    },
    simulatedInput: {
        backgroundColor: '#F0F8FF', // Light Alice Blue
        borderWidth: 1,
        borderColor: '#B3E5FC',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 6,
        marginTop: 2,
    }
});