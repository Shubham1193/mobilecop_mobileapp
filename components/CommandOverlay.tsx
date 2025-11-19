import { Ionicons } from '@expo/vector-icons';
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from 'expo-audio';
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
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

import { useWhisperModels } from '../../datacolletion/hooks/useWhisperModesls';
import { useCommandContext } from '../context/CommandContext';

/* ---------------------------------------------------------
   🔥 TINY OFFLINE EMBEDDING MODEL (character trigram)
----------------------------------------------------------*/

const COMMANDS = ["collect", "next", "previous", "price", "save", "search" , 'quantity'];
const INPUT_COMMANDS = ['price', 'quantity', 'search'];

function textToVector(str: string) {
    const v: Record<string, number> = {};
    const s = str.toLowerCase().replace(/[^a-z ]/g, "");

    for (let i = 0; i < s.length - 2; i++) {
        const tri = s.substring(i, i + 3);
        v[tri] = (v[tri] || 0) + 1;
    }
    return v;
}

function cosineSim(a: any, b: any) {
    let dot = 0, na = 0, nb = 0;
    for (const k in a) {
        if (b[k]) dot += a[k] * b[k];
        na += a[k] * a[k];
    }
    for (const k in b) nb += b[k] * b[k];
    return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-6);
}

function matchCommand(input: string) {
    if (!input) return null;

    const vInput = textToVector(input);
    let best = null;
    let bestScore = 0;

    for (const cmd of COMMANDS) {
        const vCmd = textToVector(cmd);
        const score = cosineSim(vInput, vCmd);

        if (score > bestScore) {
            bestScore = score;
            best = cmd;
        }
    }

    return bestScore >= 0.25 ? { command: best, score: bestScore } : null;
}

/* ---------------------------------------------------------
   COMPONENT
----------------------------------------------------------*/

export default function CommandOverlay() {
    const { commandText, handleCommandInput } = useCommandContext();

    const [isRecording, setIsRecording] = useState(false);
    const [matched, setMatched] = useState<string | null>(null);
    const [rawSpeech, setRawSpeech] = useState<string>("");
    const [activeTrigger, setActiveTrigger] = useState<string | null>(null);

    const isHeldRef = useRef(false);
    const realtimeStopperRef = useRef<(() => Promise<void>) | null>(null);

    const {
        whisperContext,
        initializeWhisperModel,
        isInitializingModel,
    } = useWhisperModels();

    // Initialize model
    useEffect(() => {
        if (!whisperContext) initializeModel();
    }, []);

    const initializeModel = async () => {
        try {
            await initializeWhisperModel("base", { initVad: false });
        } catch (err) {
            console.error("Model init failed:", err);
            Alert.alert("Error", "Could not initialize Whisper model.");
        }
    };

    /* Keyboard animation */
    const keyboardHeight = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const onShow = (event: any) => {
            Animated.timing(keyboardHeight, {
                toValue: event.endCoordinates.height,
                duration: 250,
                easing: Easing.out(Easing.ease),
                useNativeDriver: false,
            }).start();
        };

        const onHide = () => {
            Animated.timing(keyboardHeight, {
                toValue: 0,
                duration: 250,
                easing: Easing.out(Easing.ease),
                useNativeDriver: false,
            }).start();
        };

        const showListener = Keyboard.addListener(showEvent, onShow);
        const hideListener = Keyboard.addListener(hideEvent, onHide);

        return () => {
            showListener.remove();
            hideListener.remove();
        };
    }, []);

    /* Permissions */
    const checkPermissions = async () => {
        try {
            const s = await getRecordingPermissionsAsync();
            if (s.granted) return true;
            const ns = await requestRecordingPermissionsAsync();
            return ns.granted;
        } catch (err) {
            return false;
        }
    };

    /* Start transcription */
    const startTranscription = async () => {
        isHeldRef.current = true;

        if (!whisperContext) {
            Alert.alert("Wait", "Model is loading...");
            return;
        }

        const hasPermission = await checkPermissions();
        if (!hasPermission) {
            Alert.alert("Permission Needed", "Microphone access is required.");
            return;
        }

        setIsRecording(true);
        setRawSpeech("");
        setMatched(null);

        try {
            const { stop, subscribe } = await whisperContext.transcribeRealtime({
                realtimeAudioSec: 300,
                realtimeAudioSliceSec: 20,
                realtimeAudioMinSec: 2,
                audioSessionOnStartIos: {
                    category: "PlayAndRecord" as any,
                    options: ["MixWithOthers" as any],
                    mode: "Default" as any,
                },
                audioSessionOnStopIos: "restore" as any,
            });

            realtimeStopperRef.current = stop;

            if (!isHeldRef.current) {
                await stopTranscription();
                return;
            }

            subscribe((event: any) => {
                const text = event?.data?.result?.trim();
                if (!text) return;

                // Show raw speech in UI
                setRawSpeech(text);

                // Try to match as a command first
                const match = matchCommand(text);

                if (match) {
                    // ✅ Recognized as a command
                    const recognizedCommand = match.command;

                    // Check if it's an INPUT_COMMAND
                    if (INPUT_COMMANDS.includes(recognizedCommand)) {
                        // Set active trigger mode
                        setActiveTrigger(recognizedCommand);
                        handleCommandInput(recognizedCommand); // Send command
                        setMatched(`${recognizedCommand} (mode active)`);
                    } else {
                        // Regular command (collect, next, previous, save)
                        setActiveTrigger(null); // Clear trigger
                        handleCommandInput(recognizedCommand);
                        setMatched(recognizedCommand);
                    }
                } else {
                    // ❌ No command match
                    if (activeTrigger) {
                        // We're in input mode - treat as text input
                        handleCommandInput(`${activeTrigger}:${text}`);
                        setMatched(`text for ${activeTrigger}: "${text}"`);
                        // Keep trigger active for multiple inputs
                    } else {
                        // No active trigger - ignore
                        handleCommandInput("");
                        setMatched("ignored (no active field)");
                    }
                }
            });

        } catch (error) {
            console.error("Transcription start error:", error);
            setIsRecording(false);
        }
    };

    const stopTranscription = async () => {
        isHeldRef.current = false;
        setIsRecording(false);

        if (realtimeStopperRef.current) {
            try {
                await realtimeStopperRef.current();
                console.log("Stopped recording");
            } catch (err) {
                console.error("Stop error:", err);
            }
            realtimeStopperRef.current = null;
        }
    };

    const isModelReady = !!whisperContext && !isInitializingModel;

    return (
        <Animated.View
            style={[styles.overlay, { bottom: Animated.add(20, keyboardHeight) }]}
            pointerEvents="box-none"
        >
            <View style={styles.inputContainer}>
                <TextInput
                    value={commandText}
                    onChangeText={handleCommandInput}
                    placeholder={
                        isRecording ? "Listening..." :
                            isModelReady ? "Type or hold mic…" :
                                "Loading model…"
                    }
                    placeholderTextColor={isRecording ? "#0A84FF" : "#aaa"}
                    editable={!isRecording}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[
                        styles.overlayInput,
                        isRecording && styles.recordingInput,
                        activeTrigger && styles.inputModeActive
                    ]}
                />

                <TouchableOpacity
                    activeOpacity={0.7}
                    onPressIn={startTranscription}
                    onPressOut={stopTranscription}
                    disabled={!isModelReady}
                    style={[
                        styles.micButton,
                        isRecording && styles.micButtonActive,
                        !isModelReady && styles.micButtonDisabled
                    ]}
                >
                    {!isModelReady ? (
                        <ActivityIndicator size="small" color="#666" />
                    ) : isRecording ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Ionicons name="mic" size={20} color="#fff" />
                    )}
                </TouchableOpacity>
            </View>

            {/* Show status */}
            <View style={{ marginTop: 10 }}>
                {activeTrigger && (
                    <Text style={{ fontSize: 12, color: "#FF9500", fontWeight: 'bold' }}>
                        📝 Input Mode: {activeTrigger.toUpperCase()}
                    </Text>
                )}
                <Text style={{ fontSize: 12, color: "#333" }}>
                    🎙 Raw: {rawSpeech || "—"}
                </Text>
                <Text style={{ 
                    fontSize: 12, 
                    color: matched?.includes('ignored') ? '#999' : 
                           matched?.includes('mode active') ? '#FF9500' :
                           matched?.includes('text for') ? 'green' : 
                           matched === "no match" ? "red" : "green" 
                }}>
                    🔍 {matched || "—"}
                </Text>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        right: 16,
        width: 260,
        backgroundColor: '#fff',
        padding: 8,
        margin: 25,
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        zIndex: 9999,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    overlayInput: {
        flex: 1,
        fontSize: 14,
        padding: 8,
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        color: '#333',
        height: 40,
    },
    recordingInput: {
        backgroundColor: '#e3f2fd',
        color: '#0A84FF',
    },
    inputModeActive: {
        backgroundColor: '#FFF3E0',
        borderWidth: 2,
        borderColor: '#FF9500',
    },
    micButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#ccc',
        justifyContent: 'center',
        alignItems: 'center',
    },
    micButtonActive: {
        backgroundColor: '#0A84FF',
        transform: [{ scale: 1.1 }]
    },
    micButtonDisabled: {
        backgroundColor: '#eee',
        opacity: 0.5,
    }
});