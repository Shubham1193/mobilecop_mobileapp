import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
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
import Products from '../../assets/textstoembed/products.json';
import { useCommand } from '../../context/CommandContext';
// import { Keyboard } from 'react-native';r

export default function ProductDetailsScreen() {
  const router = useRouter();
  const { id: productId, shopId } = useLocalSearchParams();

  const priceRef = useRef<TextInput>(null);
  const quantityRef = useRef<TextInput>(null);
  const notesRef = useRef<TextInput>(null);

  const [product, setProduct] = useState<any>(null);
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [activeField, setActiveField] = useState<string | null>(null);
  const focusField = (field: string, ref: React.RefObject<TextInput>) => {
    setActiveField(field);
    // setTimeout(() => {
    //     ref.current?.focus();
    // }, 100);
  };
  useEffect(() => {
    if (productId) {
      const productData = Products.find(p => String(p.id) === String(productId));
      
      if (productData) {
        setProduct(productData);
      } else {
        Alert.alert("Error", "Product not found");
        router.back();
      }
    }
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
  useCommand((cmd) => {
    console.log("Product detail command received:", cmd);
    if (!cmd || cmd.trim() === '') return false;

    const c = cmd.toLowerCase().trim();

    // --- ACTION COMMANDS ---
    if (c === "add-price") {
      focusField('price', priceRef);
      return true;
    }
    if (c === "add-quantity") {
      focusField('quantity', quantityRef);
      return true;
    }
    if (c === "add-note") {
      focusField('notes', notesRef);
      return true;
    }

    if (c === "save-details") {
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
      handleSave();
      return true;
    }

    // --- TRIGGER FORMAT SUPPORT ---
    
    // add-price:120
    if (c.startsWith("add-price:")) {
      const value = cmd.substring(cmd.indexOf(":") + 1).trim();
      setPrice(value);
      focusField('price', priceRef);
      Keyboard.dismiss(); // Ensure keyboard closes if it was open
      return true;
    }

    // add-quantity:5
    if (c.startsWith("add-quantity:")) {
      const value = cmd.substring(cmd.indexOf(":") + 1).trim();
      setQuantity(value);
      focusField('quantity', quantityRef); 
      Keyboard.dismiss(); // Ensure keyboard closes if it was open
      return true;
    }

    // add-note:example text
    if (c.startsWith("add-note:") || c.startsWith("notes:") || c.startsWith("note:")) {
      const value = cmd.substring(cmd.indexOf(":") + 1).trim();
      setNotes(value);
      focusField('notes', notesRef);
      return true;
    }
    
    return false;
  },"individual-product");

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
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Product Information</Text>

            <View style={styles.productHeader}>
              <View style={styles.productImagePlaceholder}>
                 {product.image ? (
                    <Image source={{ uri: product.image }} style={{width: 80, height: 80, borderRadius: 8}} />
                 ) : (
                    <Text style={styles.productImageText}>
                      {product.name ? product.name.charAt(0) : '?'}
                    </Text>
                 )}
              </View>
              <View style={styles.productHeaderInfo}>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.productInfo}>Category: {product.category}</Text>
                <Text style={styles.productInfo}>Brand: {product.brand}</Text>
                <Text style={styles.productInfo}>Manufacturer: {product.manufacturer}</Text>
              </View>
            </View>

            {product.description ? (
              <Text style={styles.description}>{product.description}</Text>
            ) : null}
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

            
          </View>

          <Text style={styles.requiredNote}>* Required fields</Text>

          {/* Voice Command Help */}
       
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
    bottom: 150,
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