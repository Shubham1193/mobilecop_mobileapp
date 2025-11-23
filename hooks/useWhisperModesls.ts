import { Directory, File, Paths } from "expo-file-system";
import {
  createDownloadResumable,
  type DownloadProgressData,
  type FileSystemDownloadResult,
} from "expo-file-system/legacy";
import { useCallback, useEffect, useState } from "react";
import type { WhisperContext } from "whisper.rn/index.js";
import { initWhisper, initWhisperVad } from "whisper.rn/index.js";

export interface WhisperModel {
  id: string;
  label: string;
  url: string;
  filename: string;
  capabilities: {
    multilingual: boolean;
    quantizable: boolean;
    tdrz?: boolean;
  };
}

export const WHISPER_MODELS: WhisperModel[] = [
  {
    id: "large-v3-turbo",
    label: "Large Multilanguae",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin",
    filename: "ggml-large-v3-turbo.bin",
    capabilities: { multilingual: true, quantizable: false },
  },
  {
    id: "tiny",
    label: "Tiny (en)",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin",
    filename: "ggml-tiny.en.bin",
    capabilities: { multilingual: false, quantizable: false },
  },
  {
    id: "base",
    label: "Base Model",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
    filename: "ggml-base.bin",
    capabilities: { multilingual: true, quantizable: false },
  },
  {
    id: "small",
    label: "Small Model",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
    filename: "ggml-small.bin",
    capabilities: { multilingual: true, quantizable: false },
  },
  {
    id: "small-tdrz",
    label: "Small (tdrz)",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en-tdrz.bin",
    filename: "ggml-small.en-tdrz.bin",
    capabilities: { multilingual: false, quantizable: false, tdrz: true },
  },
];

const VAD_MODEL_INFO = {
  id: "silero-vad",
  label: "Silero VAD",
  url: "https://huggingface.co/ggml-org/silero-v5.1.2/resolve/main/ggml-silero-v5.1.2.bin?download=true",
  filename: "ggml-silero-vad-v5.1.2.bin",
  capabilities: { multilingual: false, quantizable: false }, // Added to match interface
};

interface ModelFileInfo {
  path: string;
  size: number;
}

export function useWhisperModels() {
  const [modelFiles, setModelFiles] = useState<Record<string, ModelFileInfo>>({});
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [isDownloading, setIsDownloading] = useState(false);
  const [isInitializingModel, setIsInitializingModel] = useState(false);
  const [whisperContext, setWhisperContext] = useState<WhisperContext | null>(null);
  const [vadContext, setVadContext] = useState<any>(null);
  const [currentModelId, setCurrentModelId] = useState<string | null>(null);
  
  // New state for error handling in UI
  const [lastError, setLastError] = useState<Error | null>(null);

  const logError = (message: string, error: unknown) => {
    console.error(`[WhisperHooks] ${message}`, error);
    if (error instanceof Error) {
      setLastError(error);
    } else {
      setLastError(new Error(String(error)));
    }
  };

  const getModelDirectory = useCallback(async () => {
    try {
      const documentDirectory = Paths.document;
      if (!documentDirectory?.uri) {
        throw new Error("Document directory is not available.");
      }

      const directory = new Directory(documentDirectory, "whisper-models");
      if (!directory.exists) {
        console.log("[WhisperHooks] Creating models directory...");
        directory.create({ idempotent: true, intermediates: true });
      }
      return directory;
    } catch (error) {
      logError("Failed to access/create Whisper model directory", error);
      throw error;
    }
  }, []);

  const downloadModel = useCallback(
    async (model: WhisperModel) => {
      // Clear previous errors
      setLastError(null);

      try {
        const directory = await getModelDirectory();
        const file = new File(directory, model.filename);

        const updateModelFileInfo = () => {
          try {
            const stats = file.info();
            if (!stats.exists) throw new Error("File stat check failed: File not found");
            setModelFiles((prev) => ({
              ...prev,
              [model.id]: {
                path: file.uri,
                size: Number(stats.size) || 0,
              },
            }));
          } catch (statError) {
            logError(`Failed to stat model file ${model.id} at ${file.uri}`, statError);
            // Set size to 0 but keep path, so we know we tried
            setModelFiles((prev) => ({
              ...prev,
              [model.id]: { path: file.uri, size: 0 },
            }));
          }
        };

        // Check if file already exists
        let existingInfo;
        try {
          existingInfo = file.info();
        } catch (infoError) {
          console.warn(`[WhisperHooks] Warning: Could not read info for ${model.id}`, infoError);
          existingInfo = { exists: false };
        }

        if (existingInfo.exists) {
          console.log(`[WhisperHooks] Model ${model.id} found locally at ${file.uri}`);
          updateModelFileInfo();
          return file.uri;
        }

        setIsDownloading(true);
        console.log(`[WhisperHooks] Starting download: ${model.id} from ${model.url}`);

        const downloadResumable = createDownloadResumable(
          model.url,
          file.uri,
          undefined,
          (progressData: DownloadProgressData) => {
            const { totalBytesWritten, totalBytesExpectedToWrite } = progressData;
            const fraction =
              totalBytesExpectedToWrite > 0
                ? totalBytesWritten / totalBytesExpectedToWrite
                : 0;
            setDownloadProgress((prev) => ({
              ...prev,
              [model.id]: fraction,
            }));
            
            // Log every 20% to avoid console spam
            if (Math.floor(fraction * 10) % 2 === 0 && Math.floor(fraction * 100) % 10 === 0) {
               // Optional: lighter logging
            }
          }
        );

        const downloadResult = (await downloadResumable.downloadAsync()) as FileSystemDownloadResult | undefined;

        if (
          downloadResult &&
          (downloadResult.status === 0 || (downloadResult.status >= 200 && downloadResult.status < 300))
        ) {
          console.log(`[WhisperHooks] Successfully downloaded ${model.id}`);
          updateModelFileInfo();
          setDownloadProgress((prev) => ({ ...prev, [model.id]: 1 }));
          return file.uri;
        } else {
          throw new Error(`Download failed with HTTP status: ${downloadResult?.status}`);
        }
      } catch (error) {
        logError(`Error downloading model ${model.id}`, error);
        throw error;
      } finally {
        setIsDownloading(false);
      }
    },
    [getModelDirectory]
  );

  const initializeWhisperModel = useCallback(
    async (modelId: string, options?: { initVad?: boolean }) => {
      setLastError(null);
      const model = WHISPER_MODELS.find((m) => m.id === modelId);
      if (!model) {
        const err = new Error(`Invalid model selected: ${modelId}`);
        logError("Initialization check", err);
        throw err;
      }

      try {
        setIsInitializingModel(true);
        console.log(`[WhisperHooks] Initializing Whisper model: ${model.label}`);

        // 1. Download/Get Whisper Model Path
        const modelPath = await downloadModel(model);
        
        console.log(`[WhisperHooks] Loading Whisper context from: ${modelPath}`);
        const context = await initWhisper({
          filePath: modelPath,
          useFlashAttn: true,
          useCoreMLIos: true,
          useGpu: true
        });

        setWhisperContext(context);
        setCurrentModelId(modelId);
        console.log(`[WhisperHooks] Whisper context ready.`);

        let vadInstance = null;

        // 2. Download and Init VAD Model (if requested)
        if (options?.initVad) {
          console.log("[WhisperHooks] Initializing VAD context...");
          try {
            // Cast VAD info to WhisperModel to satisfy the download interface
            const vadPath = await downloadModel(VAD_MODEL_INFO as WhisperModel);
            
            console.log(`[WhisperHooks] Loading VAD binary from: ${vadPath}`);
            vadInstance = await initWhisperVad({
              filePath: vadPath,
              nThreads: 4,
            });

            setVadContext(vadInstance);
            console.log("[WhisperHooks] VAD context initialized successfully");
          } catch (vadError) {
            // We log VAD errors but don't necessarily fail the whole process 
            // unless strict VAD is required for your app logic
            logError("VAD initialization failed (Speech Recognition may still work)", vadError);
          }
        }

        return {
          whisperContext: context,
          vadContext: vadInstance,
        };
      } catch (error) {
        logError("Critical: Model initialization failed", error);
        // Ensure we clean up state if init failed half-way
        setWhisperContext(null);
        setCurrentModelId(null);
        throw error;
      } finally {
        setIsInitializingModel(false);
      }
    },
    [downloadModel]
  );

  const resetWhisperContext = useCallback(async () => {
    try {
      if (whisperContext) {
        console.log("[WhisperHooks] Releasing Whisper context...");
        await whisperContext.release();
      }
      // VAD doesn't usually have an explicit release in some bindings, 
      // but if it does, add it here.
      
      setWhisperContext(null);
      setVadContext(null);
      setCurrentModelId(null);
      setLastError(null);
      console.log("[WhisperHooks] Contexts reset.");
    } catch (error) {
      logError("Error during context reset", error);
    }
  }, [whisperContext]);

  const getModelById = useCallback((modelId: string) => {
    return WHISPER_MODELS.find((m) => m.id === modelId);
  }, []);

  const getCurrentModel = useCallback(() => {
    return currentModelId ? getModelById(currentModelId) : null;
  }, [currentModelId, getModelById]);

  const isModelDownloaded = useCallback(
    (modelId: string) => {
      return modelFiles[modelId] !== undefined && modelFiles[modelId].size > 0;
    },
    [modelFiles]
  );

  const getDownloadProgress = useCallback(
    (modelId: string) => {
      return downloadProgress[modelId] || 0;
    },
    [downloadProgress]
  );

  const deleteModel = useCallback(
    async (modelId: string) => {
      const fileInfo = modelFiles[modelId];
      if (!fileInfo) {
        console.warn(`[WhisperHooks] Attempted to delete non-downloaded model: ${modelId}`);
        return;
      }

      try {
        console.log(`[WhisperHooks] Deleting model file: ${fileInfo.path}`);
        const file = new File(fileInfo.path);
        
        if (file.exists) {
          file.delete();
          console.log(`[WhisperHooks] Deleted successfully.`);
        } else {
            console.warn(`[WhisperHooks] File not found on disk during delete.`);
        }

        // Cleanup State
        setModelFiles((prev) => {
          const next = { ...prev };
          delete next[modelId];
          return next;
        });
        setDownloadProgress((prev) => {
          const next = { ...prev };
          delete next[modelId];
          return next;
        });

        // If active model, release context
        if (currentModelId === modelId) {
          await resetWhisperContext();
        }
      } catch (error) {
        logError(`Failed to delete model ${modelId}`, error);
        throw error;
      }
    },
    [currentModelId, modelFiles, resetWhisperContext]
  );

  // Initial Load Effect
  useEffect(() => {
    let isMounted = true;

    const loadExistingModels = async () => {
      try {
        console.log("[WhisperHooks] Scanning for existing models...");
        const directory = await getModelDirectory();
        
        // Check standard models
        const entries = await Promise.all(
          WHISPER_MODELS.map(async (model) => {
            const file = new File(directory, model.filename);
            try {
              const fileInfo = file.info();
              if (!fileInfo.exists) return null;

              return {
                id: model.id,
                info: {
                  path: file.uri,
                  size: Number(fileInfo.size) || 0,
                },
              };
            } catch (statError) {
              console.warn(`[WhisperHooks] Failed to stat existing model ${model.id}`, statError);
              return null;
            }
          })
        );

        // Check VAD model specifically
        try {
            const vadFile = new File(directory, VAD_MODEL_INFO.filename);
            if (vadFile.exists) {
                const info = vadFile.info();
                entries.push({
                    id: VAD_MODEL_INFO.id,
                    info: { path: vadFile.uri, size: Number(info.size) || 0 }
                });
            }
        } catch (e) {
            console.warn("[WhisperHooks] Error checking VAD file existence", e);
        }

        if (!isMounted) return;

        const fileMap: Record<string, ModelFileInfo> = {};
        let count = 0;
        entries.forEach((entry) => {
          if (entry) {
            fileMap[entry.id] = entry.info;
            count++;
          }
        });

        if (count > 0) {
            console.log(`[WhisperHooks] Found ${count} existing models.`);
            setModelFiles((prev) => ({ ...prev, ...fileMap }));
        } else {
            console.log(`[WhisperHooks] No existing models found.`);
        }
      } catch (error) {
        logError("Failed to load existing Whisper models", error);
      }
    };

    loadExistingModels();

    return () => {
      isMounted = false;
    };
  }, [getModelDirectory]);

  return {
    // State
    modelFiles,
    downloadProgress,
    isDownloading,
    isInitializingModel,
    whisperContext,
    vadContext,
    currentModelId,
    lastError, // Exported for UI to see

    // Actions
    downloadModel,
    initializeWhisperModel,
    resetWhisperContext,
    deleteModel,

    // Helpers
    getModelById,
    getCurrentModel,
    isModelDownloaded,
    getDownloadProgress,

    // Constants
    availableModels: WHISPER_MODELS,
  };
}