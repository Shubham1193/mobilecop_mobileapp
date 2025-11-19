import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
    FlatList,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useCommand } from '../context/CommandContext'; // Make sure this path matches your file structure

const MOCK_SHOPS = [
  { id: '1', name: 'Shop A', address: '123 Main St', category: 'Grocery', itemsCollected: 0 },
  { id: '2', name: 'Shop B', address: '456 Oak Ave', category: 'Electronics', itemsCollected: 0 },
  { id: '3', name: 'Shop C', address: '789 Pine Rd', category: 'Pharmacy', itemsCollected: 0 },
  { id: '4', name: 'Shop D', address: '321 Elm St', category: 'Grocery', itemsCollected: 0 },
];

export default function ShopsScreen() {
  const router = useRouter();
  
  // 1. Refs
  const searchRef = useRef<TextInput>(null);

  // 2. State
  const [searchQuery, setSearchQuery] = useState('');
  const [shops, setShops] = useState(MOCK_SHOPS);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredShops = shops.filter(shop =>
    shop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    shop.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
    shop.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedShop = filteredShops[selectedIndex];

  const handleCollect = () => {
    if (!selectedShop) return;
    router.push(`/shop/${selectedShop.id}`);
  };

  const handleReview = () => {
    router.push('/review');
  };

  // ---------------------------------------------------------
  // COMMAND HANDLER (Via Context Hook)
  // ---------------------------------------------------------
  useCommand((cmd) => {
    const c = cmd.toLowerCase();

    // --- COMMAND: SEARCH ---
    // Scenario A: "search" -> Focuses the box
    if (c === "search") {
        searchRef.current?.focus();
        return true; // Clear command box
    }
    // Scenario B: "search <text>" -> Sets the search query directly
    if (c.startsWith("search ")) {
        const text = cmd.substring(7); // Keep original case
        setSearchQuery(text);
        searchRef.current?.focus();
        return true; 
    }

    // --- COMMAND: NAVIGATION ---
    if (c === "next" || c === "next") {
        setSelectedIndex(prev => Math.min(prev + 1, filteredShops.length - 1));
        return true;
    }

    if (c === "previous" || c === "prev" || c === "p") {
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        return true;
    }

    // --- COMMAND: ACTIONS ---
    if (c === "collect" || c === "go" || c === "open") {
        handleCollect();
        return true;
    }

    if (c === "review") {
        handleReview();
        return true;
    }

    // Return false if command not recognized (allows user to keep typing)
    return false;
  });

  const renderShopCard = ({ item, index }: any) => (
    <View style={[
      styles.card,
      index === selectedIndex && styles.cardSelected
    ]}>
      <View style={styles.cardContent}>
        <View style={styles.shopIcon}>
          <Text style={styles.shopIconText}>{item.name.charAt(0)}</Text>
        </View>

        <View style={styles.shopInfo}>
          <Text style={styles.shopName}>{item.name}</Text>
          <Text style={styles.shopAddress}>{item.address}</Text>
          <Text style={styles.shopCategory}>{item.category}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* 
         We still use KeyboardAvoidingView so the list resizes
         when the standard Search Bar is focused, or when the 
         global command box pops up (since KAV detects keyboard height).
      */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* SEARCH HEADER */}
        <View style={styles.header}>
            <TextInput
                ref={searchRef}
                style={styles.searchInput}
                placeholder="Search shops..."
                value={searchQuery}
                onChangeText={(text) => {
                    setSearchQuery(text);
                    setSelectedIndex(0); // Reset selection on search
                }}
                placeholderTextColor="#999"
            />
        </View>

        {/* SHOP LIST */}
        <FlatList
            data={filteredShops}
            renderItem={renderShopCard}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            extraData={selectedIndex}
        />

        {/* BOTTOM BUTTON BAR */}
        <View style={styles.bottomBar}>
            <TouchableOpacity 
                style={[styles.bottomBtn, { backgroundColor: "#007AFF" }]}
                onPress={handleCollect}
            >
                <Text style={styles.bottomBtnText}>Collect</Text>
            </TouchableOpacity>

            <TouchableOpacity 
                style={[styles.bottomBtn, { backgroundColor: "#34C759" }]}
                onPress={handleReview}
            >
                <Text style={styles.bottomBtnText}>Review</Text>
            </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* 
          NOTE: The Floating Overlay is gone from here! 
          It is now handled globally in _layout.tsx 
      */}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInput: {
    height: 44,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#333',
  },
  listContent: { 
      padding: 16, 
      // We still need padding at bottom so the fixed Overlay 
      // (which lives in Layout) doesn't visually block the last item.
      paddingBottom: 100 
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 2, 
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#e8f0ff',
  },
  cardContent: { flexDirection: 'row' },
  shopIcon: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  shopIconText: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  shopInfo: { flex: 1 },
  shopName: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  shopAddress: { fontSize: 14, color: '#666' },
  shopCategory: { fontSize: 14, color: '#999' },

  // BOTTOM BAR
  bottomBar: {
    padding: 16,
    paddingBottom: 20, // Lift up slightly
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#f5f5f5', // Match bg
  },
  bottomBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  bottomBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700'
  },
});