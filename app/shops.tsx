
import { useRouter } from 'expo-router';
import Fuse from 'fuse.js';
import { useMemo, useRef, useState } from 'react';
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
import Shops from '../assets/textstoembed/shop.json';
import { useCommand } from '../context/CommandContext';

const MOCK_SHOPS = Shops;

export default function ShopsScreen() { 
  const router = useRouter();

  const searchRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [shops, setShops] = useState(MOCK_SHOPS);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const fuse = useMemo(() => {
    const options = {
      keys: ['name', 'address'],
      threshold: 0.4,
      includeScore: true,
    };
    return new Fuse(shops, options);
  }, [shops]);

  const filteredShops = useMemo(() => {
    if (!searchQuery.trim()) {
      return shops;
    }

    const searchResults = fuse.search(searchQuery);
    return searchResults.map(result => result.item);
  }, [searchQuery, shops, fuse]);

  const selectedShop = filteredShops[selectedIndex] ?? null;

  useCommand((cmd) => {
    const c = cmd.toLowerCase().trim();

    console.log("Command received in store page :", cmd);

    if (c === "search-for-shop-name") {
      searchRef.current?.focus();
      return true;
    }

    if (c.startsWith("search-for-shop-name:")) {
      const searchText = cmd.split(":")[1]?.trim() || "";
      setSearchQuery(searchText);
      setSelectedIndex(0);
      searchRef.current?.focus();
      return true;
    }

    if (c === "next-shop") {
      setSelectedIndex(prev => Math.min(prev + 1, filteredShops.length - 1));
      return true;
    }

    if (c === "previous-shop") {
      setSelectedIndex(prev => Math.max(prev - 1, 0));
      return true;
    }

    if (c === "collect-shop-details" && selectedShop) {
      router.push(`/shop/${selectedShop.id}`);
      return true;
    }

    if (c === "review-shop-details") {
      router.push('/review');
      return true;
    }

    return false;
  } , "all-shops");

  const renderShopCard = ({ item, index }: { item: typeof MOCK_SHOPS[0], index: number }) => {
    const isSelected = index === selectedIndex;
    return (
      <TouchableOpacity onPress={() => setSelectedIndex(index)}>
        <View style={[
          styles.card,
          isSelected && styles.cardSelected
        ]}>
          <View style={styles.cardContent}>
            <View style={styles.shopIcon}>
              <Text style={styles.shopIconText}>{item.name.charAt(0)}</Text>
            </View>

            <View style={styles.shopInfo}>
              <Text style={styles.shopName}>{item.name}</Text>
              <Text style={styles.shopAddress}>{item.address}</Text>
              <Text style={styles.shopItems}>Items Collected: {item.itemsCollected}</Text>
            </View>
          </View>

          <View style={styles.cardButtons}>
            <TouchableOpacity
              style={[styles.bottomBtn, { backgroundColor: "#007AFF" }]}
              onPress={() => router.push(`/shop/${item.id}`)}
            >
              <Text style={styles.bottomBtnText}>Collect</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.bottomBtn, { backgroundColor: "#34C759" }]}
              onPress={() => router.push('/review')}
            >
              <Text style={styles.bottomBtnText}>Review</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
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
              setSelectedIndex(0);
            }}
            placeholderTextColor="#999"
          />
        </View>

        {/* SHOP LIST */}
        <FlatList
          ref={listRef}
          data={filteredShops}
          renderItem={renderShopCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          extraData={selectedIndex}
        />
      </KeyboardAvoidingView>
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
    paddingBottom: 100
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
  shopItems: { fontSize: 14, color: '#999' },

  cardButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  bottomBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  bottomBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700'
  },
});