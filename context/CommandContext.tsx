import { useFocusEffect } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

interface CommandContextType {
  setHandler: (handler: ((cmd: string) => void) | null) => void; 
  handleCommandInput: (text: string) => void;
  commandText: string;
  setCommandText: (text: string) => void;
}

const CommandContext = createContext<CommandContextType | undefined>(undefined);

export function CommandProvider({ children }: { children: React.ReactNode }) {
  const handlerRef = useRef<((cmd: string) => void) | null>(null);
  
  const [commandText, setCommandText] = useState('');

  const setHandler = useCallback((newHandler: ((cmd: string) => void) | null) => {
    handlerRef.current = newHandler;
  }, []);

  const handleCommandInput = (text: string) => {
    setCommandText(text);
    if (handlerRef.current) {
      handlerRef.current(text);
    }
  };

  return (
    <CommandContext.Provider 
      value={{ 
        setHandler, 
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
export function useCommand(
  callback: (cmd: string) => boolean | void,
  debugPageName: string 
) {
  const { setHandler, setCommandText } = useCommandContext();
  
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  });

  useFocusEffect(
    useCallback(() => {
      console.log(`[CommandSystem] ✅ FOCUS: Setting handler to "${debugPageName}"`);
      
      const commandHandler = (cmd: string) => {
        if (callbackRef.current) {
          const shouldClear = callbackRef.current(cmd);
          if (shouldClear) {
            setCommandText('');
          }
        }
      };

      setHandler(commandHandler);

      return () => {
        console.log(`[CommandSystem] ❌ BLUR: Clearing handler from "${debugPageName}"`);
        setHandler(null);
      };
    }, [setHandler, setCommandText, debugPageName])
  );
}