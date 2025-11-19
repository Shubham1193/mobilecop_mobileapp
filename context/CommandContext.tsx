import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

type CommandHandler = (command: string) => void;

interface CommandContextType {
  registerHandler: (handler: CommandHandler) => void;
  unregisterHandler: () => void;
  handleCommandInput: (text: string) => void;
  commandText: string;
  setCommandText: (text: string) => void;
}

const CommandContext = createContext<CommandContextType | undefined>(undefined);

export function CommandProvider({ children }: { children: React.ReactNode }) {
  const [handler, setHandler] = useState<CommandHandler | null>(null);
  const [commandText, setCommandText] = useState('');

  // We use a ref to track the handler to prevent state updates if the handler is identical
  // but for this specific error, the fix is in the hook below.
  
  const registerHandler = useCallback((newHandler: CommandHandler) => {
    setHandler(() => newHandler);
  }, []);

  const unregisterHandler = useCallback(() => {
    setHandler(null);
  }, []);

  const handleCommandInput = (text: string) => {
    setCommandText(text);
    if (handler) {
      handler(text);
    }
  };

  return (
    <CommandContext.Provider 
      value={{ 
        registerHandler, 
        unregisterHandler, 
        handleCommandInput, 
        commandText, 
        setCommandText 
      }}
    >
      {children}
    </CommandContext.Provider>
  );
}

export function useCommandContext() {
  const context = useContext(CommandContext);
  if (!context) throw new Error('useCommandContext must be used within CommandProvider');
  return context;
}

// ============================================================
// THE FIXED HOOK
// ============================================================
export function useCommand(callback: (cmd: string) => boolean | void) {
  const { registerHandler, unregisterHandler, setCommandText } = useCommandContext();
  
  // 1. Use a Ref to store the latest callback.
  // This allows us to access the fresh state from the screen 
  // without triggering the useEffect to re-run.
  const callbackRef = useRef(callback);

  // 2. Update the ref whenever the passed callback changes (on every render)
  useEffect(() => {
    callbackRef.current = callback;
  });

  // 3. Register the handler ONLY ONCE when the component mounts.
  useEffect(() => {
    console.log("Registering command handler"); // Debug log
    
    registerHandler((cmd) => {
      // When a command comes in, call whatever is currently in the ref
      if (callbackRef.current) {
        const shouldClear = callbackRef.current(cmd);
        if (shouldClear) {
          setCommandText('');
        }
      }
    });

    return () => {
      console.log("Unregistering command handler"); // Debug log
      unregisterHandler();
    };
    // Notice: 'callback' is NOT in the dependency array anymore.
    // This breaks the infinite loop.
  }, [registerHandler, unregisterHandler, setCommandText]);
}