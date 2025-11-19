import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useCommand } from '../../context/CommandContext';

// Mock product data
const getProductById = (id: string) => {
  const products: any = {
    '1': { 
      id: '1', 
      name: 'Product A', 
      category: 'Electronics', 
      brand: 'Brand X', 
      manufacturer: 'Manufacturer 1',
      description: 'High-quality electronic product with advanced features.'
    },
    '2': { 
      id: '2', 
      name: 'Product B', 
      category: 'Food', 
      brand: 'Brand Y', 
      manufacturer: 'Manufacturer 2',
      description: 'Premium food product with natural ingredients.'
    },
    '3': { 
      id: '3', 
      name: 'Product C', 
      category: 'Electronics', 
      brand: 'Brand Z', 
      manufacturer: 'Manufacturer 1',
      description: 'Latest technology product for everyday use.'
    },
    '4': { 
      id: '4', 
      name: 'Product D', 
      category: 'Beverages', 
      brand: 'Brand X', 
      manufacturer: 'Manufacturer 3',
      description: 'Refreshing beverage with great taste.'
    },
  };
  
  return products[id] || null;
};

export default function ProductDetailsScreen() {
  const router = useRouter();
  const { id: productId, shopId } = useLocalSearchParams();
  
  // Create Refs for inputs
  const priceRef = useRef<TextInput>(null);
  const quantityRef = useRef<TextInput>(null);
  const notesRef = useRef<TextInput>(null);

  const [product, setProduct] = useState<any>(null);
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Track active field for visual feedback
  const [activeField, setActiveField] = useState<string | null>(null);

  useEffect(() => {
    const productData = getProductById(productId as string);
    setProduct(productData);
  }, [productId]);

  const validateInputs = () => {
    if (!price || price.trim() === '') {
      Alert.alert('Validation Error', 'Please enter a price');
      return false;
    }
    
    if (!quantity || quantity.trim() === '') {
      Alert.alert('Validation Error', 'Please enter a quantity');
      return false;
    }

    const priceNum = parseFloat(price);
    const quantityNum = parseInt(quantity);

    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid price');
      return false;
    }

    if (isNaN(quantityNum) || quantityNum <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid quantity');
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateInputs()) return;

    setIsSaving(true);

    try {
      const collectionData = {
        productId,
        shopId,
        price: parseFloat(price),
        quantity: parseInt(quantity),
        notes,
        timestamp: new Date().toISOString(),
      };

      console.log('Saving collection data:', collectionData);

      await new Promise(resolve => setTimeout(resolve, 500));

      Alert.alert(
        'Success',
        'Product data saved successfully!',
        [
          {
            text: 'OK',
            onPress: () => router.back()
          }
        ]
      );
    } catch (error) {
      console.error('Error saving data:', error);
      Alert.alert('Error', 'Failed to save product data. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Discard Changes',
      'Are you sure you want to discard your changes?',
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes', onPress: () => router.back() }
      ]
    );
  };

  // ---------------------------------------------------------
  // COMMAND HANDLER WITH TRIGGER SUPPORT
  // ---------------------------------------------------------
  useCommand((cmd) => {
    if (!cmd || cmd.trim() === '') return false;

    // Check if it's a trigger:value format
    const hasTrigger = cmd.includes(':');
    
    if (hasTrigger) {
      // Parse trigger format: "price:150" or "search:Amul"
      const [trigger, ...valueParts] = cmd.split(':');
      const value = valueParts.join(':').trim(); // Rejoin in case value contains ":"
      
      const triggerLower = trigger.toLowerCase();

      // Handle trigger-based input
      switch (triggerLower) {
        case 'price':
          setPrice(value);
          setActiveField('price');
          priceRef.current?.focus();
          console.log(`✅ Set price to: ${value}`);
          return true;

        case 'quantity':
        case 'qty':
          setQuantity(value);
          setActiveField('quantity');
          quantityRef.current?.focus();
          console.log(`✅ Set quantity to: ${value}`);
          return true;

        case 'notes':
        case 'note':
          setNotes(value);
          setActiveField('notes');
          notesRef.current?.focus();
          console.log(`✅ Set notes to: ${value}`);
          return true;

        case 'search':
          // Handle search if needed in this screen
          console.log(`🔍 Search triggered with: ${value}`);
          return true;

        default:
          console.log(`⚠️ Unknown trigger: ${trigger}`);
          return false;
      }
    }

    // Handle plain commands (no trigger)
    const c = cmd.toLowerCase();

    // --- ACTION COMMANDS ---
    if (c === 'save' || c === 'submit' || c === 'done' || c === 'collect') {
      handleSave();
      return true;
    }

    if (c === 'cancel') {
      handleCancel();
      return true;
    }

    if (c === 'back' || c === 'previous') {
      router.back();
      return true;
    }

    if (c === 'next') {
      // Go to next product or save and continue
      handleSave();
      return true;
    }

    // --- FOCUS COMMANDS (activate input mode) ---
    if (c === 'price') {
      setActiveField('price');
      priceRef.current?.focus();
      console.log('📝 Price input mode activated');
      return true;
    }

    if (c === 'qty' || c === 'quantity') {
      setActiveField('quantity');
      quantityRef.current?.focus();
      console.log('📝 Quantity input mode activated');
      return true;
    }

    if (c === 'note' || c === 'notes') {
      setActiveField('notes');
      notesRef.current?.focus();
      console.log('📝 Notes input mode activated');
      return true;
    }

    // --- LEGACY: DIRECT DATA ENTRY (backward compatibility) ---
    if (c.startsWith('price ')) {
      const value = cmd.substring(6).trim();
      setPrice(value);
      setActiveField('price');
      console.log(`✅ Set price to: ${value}`);
      return true;
    }

    if (c.startsWith('qty ') || c.startsWith('quantity ')) {
      const value = c.startsWith('qty ') ? cmd.substring(4).trim() : cmd.substring(9).trim();
      setQuantity(value);
      setActiveField('quantity');
      console.log(`✅ Set quantity to: ${value}`);
      return true;
    }

    if (c.startsWith('note ') || c.startsWith('notes ')) {
      const value = c.startsWith('note ') ? cmd.substring(5).trim() : cmd.substring(6).trim();
      setNotes(value);
      setActiveField('notes');
      console.log(`✅ Set notes to: ${value}`);
      return true;
    }

    console.log(`❌ Unrecognized command: ${cmd}`);
    return false; // Keep typing if not matched
  });

  // Clear active field after 2 seconds
  useEffect(() => {
    if (activeField) {
      const timer = setTimeout(() => setActiveField(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [activeField]);

  if (!product) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading product...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Product Information Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Product Information</Text>
            
            <View style={styles.productHeader}>
              <View style={styles.productImagePlaceholder}>
                <Text style={styles.productImageText}>
                  {product.name.charAt(0)}
                </Text>
              </View>
              <View style={styles.productHeaderInfo}>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.productInfo}>Category: {product.category}</Text>
                <Text style={styles.productInfo}>Brand: {product.brand}</Text>
                <Text style={styles.productInfo}>Manufacturer: {product.manufacturer}</Text>
              </View>
            </View>

            {product.description && (
              <Text style={styles.description}>{product.description}</Text>
            )}
          </View>

          {/* Collection Form Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Collection Details</Text>
            
            <View style={[
              styles.inputContainer,
              activeField === 'price' && styles.inputContainerActive
            ]}>
              <Text style={styles.inputLabel}>
                Price * {activeField === 'price' && '🎙️'}
              </Text>
              <TextInput
                ref={priceRef}
                style={[
                  styles.input,
                  activeField === 'price' && styles.inputActive
                ]}
                placeholder="Say: price"
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
                placeholderTextColor="#999"
              />
            </View>

            <View style={[
              styles.inputContainer,
              activeField === 'quantity' && styles.inputContainerActive
            ]}>
              <Text style={styles.inputLabel}>
                Quantity * {activeField === 'quantity' && '🎙️'}
              </Text>
              <TextInput
                ref={quantityRef}
                style={[
                  styles.input,
                  activeField === 'quantity' && styles.inputActive
                ]}
                placeholder="Say: quantity"
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="number-pad"
                placeholderTextColor="#999"
              />
            </View>

            <View style={[
              styles.inputContainer,
              activeField === 'notes' && styles.inputContainerActive
            ]}>
              <Text style={styles.inputLabel}>
                Notes {activeField === 'notes' && '🎙️'}
              </Text>
              <TextInput
                ref={notesRef}
                style={[
                  styles.input,
                  styles.textArea,
                  activeField === 'notes' && styles.inputActive
                ]}
                placeholder="Say: notes"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                placeholderTextColor="#999"
              />
            </View>
          </View>

          <Text style={styles.requiredNote}>* Required fields</Text>
          
          {/* Voice Command Help */}
          <View style={styles.helpSection}>
            <Text style={styles.helpTitle}>🎙️ Voice Commands:</Text>
            <Text style={styles.helpText}>• "price" → activate price input</Text>
            <Text style={styles.helpText}>• "quantity" → activate quantity input</Text>
            <Text style={styles.helpText}>• "notes" → activate notes input</Text>
            <Text style={styles.helpText}>• Then say the value (e.g., "150")</Text>
            <Text style={styles.helpText}>• "save" or "collect" → save data</Text>
            <Text style={styles.helpText}>• "next" → save and continue</Text>
            <Text style={styles.helpText}>• "cancel" or "back" → go back</Text>
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.cancelButton}
            onPress={handleCancel}
            disabled={isSaving}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            <Text style={styles.saveButtonText}>
              {isSaving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  productImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  productImageText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  productHeaderInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  productInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputContainerActive: {
    backgroundColor: '#FFF3E0',
    padding: 8,
    borderRadius: 8,
    marginHorizontal: -8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#333',
  },
  inputActive: {
    borderColor: '#FF9500',
    borderWidth: 2,
    backgroundColor: '#FFFBF5',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  requiredNote: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  helpSection: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 12,
    color: '#555',
    marginBottom: 4,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});