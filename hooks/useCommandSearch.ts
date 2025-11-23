const INPUT_COMMANDS = [
  'search-for-shop-name',
  'add-name',
  'add-category',
  'add-brand',
  'add-manufacturer',
  'add-price',
  'add-quantity',
];

import { useEffect, useRef, useState } from 'react';
import { ALL_MINILM_L6_V2, useTextEmbeddings } from 'react-native-executorch';
import commandsJson from '../assets/textstoembed/commands.json';
import productsJson from '../assets/textstoembed/products.json';
import { correctASR } from '../assets/textstoembed/uniquevocab';

// ----------------------------
// Math Helpers
// ----------------------------
const dotProduct = (a: number[], b: number[]) =>
  a.reduce((sum, val, i) => sum + val * b[i], 0);

const calcMagnitude = (a: number[]) =>
  Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));

const cosineSimilarity = (a: number[], b: number[], magB?: number) => {
  const dot = dotProduct(a, b);
  const normA = calcMagnitude(a);
  const normB = magB || calcMagnitude(b);
  if (normA === 0 || normB === 0) return 0;
  return dot / (normA * normB);
};

// ----------------------------
// Types
// ----------------------------
type CommandIndexItem = {
  command: string;
  page: string;
  description: string;
  embedding: number[];
  magnitude: number;
};

type ProductIndexItem = {
  product: typeof productsJson[0];
  embedding: number[];
  magnitude: number;
};

type SearchResult = {
  command: string | null;
  correctedText: string;
};

// ----------------------------
// Custom Hook
// ----------------------------
export function useCommandSearch() {
  const model = useTextEmbeddings({ model: ALL_MINILM_L6_V2 });
  const [isIndexReady, setIsIndexReady] = useState(false);
  const commandIndexRef = useRef<CommandIndexItem[]>([]);
  const productIndexRef = useRef<ProductIndexItem[]>([]);
  
  // Track the last successfully executed command to handle inputs
  const lastTriggerCommandRef = useRef<string | null>(null);

  // --------------------------------------------------------------
  // Build Embedding Index (One-time only)
  // --------------------------------------------------------------
  useEffect(() => {
    const buildIndex = async () => {
      if (!model.isReady || isIndexReady) return;

      try {
        console.log("Building command index...");
        const cmdArr: CommandIndexItem[] = [];

        for (const item of commandsJson) {
          const vector = await model.forward(item.description);
          cmdArr.push({
            command: item.command,
            page: item.page,
            description: item.description,
            embedding: vector,
            magnitude: calcMagnitude(vector),
          });
        }
        commandIndexRef.current = cmdArr;

        console.log("Building product index...");
        const prodArr: ProductIndexItem[] = [];

        for (const prod of productsJson) {
          const text = `${prod.name} ${prod.brand} ${prod.manufacturer}`;
          const vector = await model.forward(text);
          prodArr.push({
            product: prod,
            embedding: vector,
            magnitude: calcMagnitude(vector),
          });
        }
        productIndexRef.current = prodArr;
        setIsIndexReady(true);
      } catch (e) {
        console.error("Failed building index:", e);
      }
    };

    buildIndex();
  }, [model.isReady]);

  // --------------------------------------------------------------
  // Search Logic
  // --------------------------------------------------------------
  const searchCommand = async (
    text: string,
    currentPage: string,
    threshold = 0.32,
  ): Promise<SearchResult> => {
    if (!isIndexReady || !model.isReady) {
      return { command: null, correctedText: text };
    }

    try {
      console.log("Current page:", currentPage);
      
      // 1. Initial Correction (General context)
      const initialCorrectedText = correctASR(text); 
      console.log(`ASR Input: "${text}" -> Phonetically Corrected: "${initialCorrectedText}"`);

      const inputVector = await model.forward(initialCorrectedText);

      // Filter commands allowed on current page
      const commandPool = commandIndexRef.current.filter(
        cmd => cmd.page === currentPage || cmd.page === "global"
      );

      let bestMatch: CommandIndexItem | null = null;
      let bestScore = -1;

      if (commandPool.length > 0) {
        for (const command of commandPool) {
          const score = cosineSimilarity(
            inputVector,
            command.embedding,
            command.magnitude
          );

          if (score > bestScore) {
            bestScore = score;
            bestMatch = command;
          }
        }
      }

      console.log(
        `Command Search => Best Match: "${bestMatch?.command}" | Score: ${bestScore.toFixed(3)}`
      );

      // -----------------------------------------------------------
      // CASE A: High Confidence Command Found
      // -----------------------------------------------------------
      if (bestScore >= threshold && bestMatch) {
        const matchedCommand = bestMatch.command;

        // Check if this command acts as a trigger for future input
        if (INPUT_COMMANDS.includes(matchedCommand)) {
          console.log(`Trigger command detected: ${matchedCommand}`);
          lastTriggerCommandRef.current = matchedCommand;
        } else {
          // If it's a navigation or action command, we might want to clear the input focus
          // or keep it depending on your UX. Assuming reset for non-input commands:
          // lastTriggerCommandRef.current = null; 
        }

        return { 
          command: matchedCommand, 
          correctedText: initialCorrectedText 
        };
      }

      // -----------------------------------------------------------
      // CASE B: Low Confidence -> Check Previous Trigger
      // -----------------------------------------------------------
      console.log("❌ Below threshold. Checking previous trigger command...");
      const lastTrigger = lastTriggerCommandRef.current;

      if (lastTrigger && INPUT_COMMANDS.includes(lastTrigger)) {
        
        let context: 'product' | 'shop' | undefined = undefined;

        if (lastTrigger === 'search-for-shop-name') {
          context = 'shop';
        } else if (['add-name', 'add-brand', 'add-manufacturer', 'add-category'].includes(lastTrigger)) {
          context = 'product';
        } else {
          // for 'add-price' and 'add-quantity', context remains undefined
          context = undefined;
        }

        console.log(`Falling back to input for trigger: "${lastTrigger}" with context: "${context || 'none'}"`);

        // Re-run ASR correction with the specific context
        // @ts-ignore: Assuming correctASR accepts a second argument based on requirements
        const contextCorrectedText = correctASR(text, context);

        return {
          command: null, // Return the trigger command so UI knows which field to fill
          correctedText: contextCorrectedText
        };
      }

      // -----------------------------------------------------------
      // CASE C: No Command & No Active Trigger
      // -----------------------------------------------------------
      return { 
        type: 'none', 
        command: null, 
        correctedText: initialCorrectedText 
      };

    } catch (err) {
      console.error("searchCommand error:", err);
      return { type: 'none', command: null, correctedText: text };
    }
  };

  return {
    searchCommand,
    isReady: model.isReady && isIndexReady,
    error: model.error,
    downloadProgress: model.downloadProgress
  };
}