import CommandOverlay from '@/components/CommandOverlay';
import { CommandProvider } from '@/context/CommandContext';
import { Stack, useSegments } from 'expo-router';
import { View } from 'react-native';

export default function RootLayout() {


  const segments = useSegments();
  
  // Determine page based on segments
  let currentPage = 'all-shops';
  if (segments[0] === 'shops') currentPage = 'all-shops';
  else if (segments[0] === 'shop') currentPage = 'individual-shop';
  else if (segments[0] === 'product') currentPage = 'individual-product';


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
    <CommandOverlay currentPage={currentPage} />
    </View>
    </CommandProvider>
  );
}