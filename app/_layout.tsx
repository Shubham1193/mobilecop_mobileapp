import CommandOverlay from '@/components/CommandOverlay';
import { CommandProvider } from '@/context/CommandContext';
import { Stack } from 'expo-router';
import { View } from 'react-native';

export default function RootLayout() {
  return (
    <CommandProvider>
      <View style={{ flex: 1 }}>
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#007AFF',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen 
        name="index" 
        options={{ 
          headerShown: false 
        }} 
      />
      <Stack.Screen 
        name="shops" 
        options={{ 
          title: 'Shops',
          headerLeft: () => null, // Prevent back to welcome
        }} 
      />
      <Stack.Screen 
        name="review" 
        options={{ 
          title: 'Collection Summary',
          presentation: 'modal',
        }} 
      />
      <Stack.Screen 
        name="shop/[id]" 
        options={{ 
          title: 'Products',
        }} 
      />
      <Stack.Screen 
        name="product/[id]" 
        options={{ 
          title: 'Product Details',
        }} 
      />
    </Stack>
    <CommandOverlay />
    </View>
    </CommandProvider>
  );
}