import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export default function WelcomeScreen() {
  const router = useRouter();

  useEffect(() => {
    // Simulate model initialization
    const initializeApp = async () => {
      try {
        // TODO: Initialize your ML model here
        console.log('Initializing model...');
        
        // Simulate loading time
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('Model initialized successfully');
        
        // Navigate to shops page
        router.replace('/shops');
      } catch (error) {
        console.error('Error initializing:', error);
        // Still navigate even if there's an error (optional)
        router.replace('/shops');
      }
    };

    initializeApp();
  }, []);

  return (
    <View style={styles.container}>
      {/* Logo Container */}
      <View style={styles.logoContainer}>
        {/* Replace with your actual logo */}
        <View style={styles.logoPlaceholder}>
          <Text style={styles.logoText}>Your Logo</Text>
        </View>
        <Text style={styles.appName}>Product Collector</Text>
      </View>

      {/* Loading Indicator */}
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Initializing...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 80,
  },
  logoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  loadingContainer: {
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
});