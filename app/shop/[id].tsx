import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    FlatList,
    Image,
    Keyboard, // Imported to dismiss keyboard on navigation
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useCommand } from '../../context/CommandContext'; // Ensure path is correct

// Mock products data
const MOCK_PRODUCTS = [
    {
        id: '1',
        name: 'Product A',
        category: 'Electronics',
        brand: 'Brand X',
        manufacturer: 'Manufacturer 1',
        imageUrl: null
    },
    {
        id: '2',
        name: 'Product B',
        category: 'Food',
        brand: 'Brand Y',
        manufacturer: 'Manufacturer 2',
        imageUrl: null
    },
    {
        id: '3',
        name: 'Product C',
        category: 'Electronics',
        brand: 'Brand Z',
        manufacturer: 'Manufacturer 1',
        imageUrl: null
    },
    {
        id: '4',
        name: 'Product D',
        category: 'Beverages',
        brand: 'Brand X',
        manufacturer: 'Manufacturer 3',
        imageUrl: null
    },
];

export default function ShopProductsScreen() {
    const router = useRouter();
    const { id: shopId } = useLocalSearchParams();

    // 1. Input Refs
    const nameRef = useRef<TextInput>(null);
    const categoryRef = useRef<TextInput>(null);
    const brandRef = useRef<TextInput>(null);
    const manufacturerRef = useRef<TextInput>(null);
    const listRef = useRef<FlatList>(null);

    // 2. State
    const [products, setProducts] = useState(MOCK_PRODUCTS);
    const [nameFilter, setNameFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [brandFilter, setBrandFilter] = useState('');
    const [manufacturerFilter, setManufacturerFilter] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);

    const filteredProducts = products.filter(product => {
        const matchesName = product.name.toLowerCase().includes(nameFilter.toLowerCase());
        const matchesCategory = product.category.toLowerCase().includes(categoryFilter.toLowerCase());
        const matchesBrand = product.brand.toLowerCase().includes(brandFilter.toLowerCase());
        const matchesManufacturer = product.manufacturer.toLowerCase().includes(manufacturerFilter.toLowerCase());
        return matchesName && matchesCategory && matchesBrand && matchesManufacturer;
    });

    // Reset selection on filter change
    useEffect(() => {
        setSelectedIndex(0);
    }, [nameFilter, categoryFilter, brandFilter, manufacturerFilter]);

    // Scroll to selected item
    useEffect(() => {
        if (filteredProducts.length > 0 && listRef.current) {
            setTimeout(() => {
                listRef.current?.scrollToIndex({
                    index: selectedIndex,
                    animated: true,
                    viewPosition: 0.5
                });
            }, 100);
        }
    }, [selectedIndex]);

    const clearFilters = () => {
        setNameFilter('');
        setCategoryFilter('');
        setBrandFilter('');
        setManufacturerFilter('');
    };

    const handleProductPress = (productId: string) => {
        router.push({
            pathname: '/product/[id]',
            params: { id: productId, shopId: shopId as string }
        });
    };

    // ---------------------------------------------------------
    // NEW: REGISTER COMMANDS VIA HOOK
    // ---------------------------------------------------------
    useCommand((cmd) => {
        const c = cmd.toLowerCase();

        // --- ACTION: COLLECT / OPEN ---
        if (c === "collect-detail" || c === "collect" || c === "open" || c === "select" || c === "go") {
            const selected = filteredProducts[selectedIndex];
            if (selected) {
                Keyboard.dismiss(); // Close keyboard before moving
                handleProductPress(selected.id);
                return true; // Clear command box
            }
        }

        // --- NAVIGATION ---
        if (c === "next" || c === "n") {
            setSelectedIndex(prev => Math.min(prev + 1, filteredProducts.length - 1));
            return true;
        }
        if (c === "prev" || c === "previous" || c === "p") {
            setSelectedIndex(prev => Math.max(prev - 1, 0));
            return true;
        }
        if (c === "back") {
            router.back();
            return true;
        }
        if (c === "clear") {
            clearFilters();
            return true;
        }

        // --- FOCUS COMMANDS ---
        if (c === "name") {
            nameRef.current?.focus();
            return true;
        }
        if (c === "cat" || c === "category") {
            categoryRef.current?.focus();
            return true;
        }
        if (c === "brand") {
            brandRef.current?.focus();
            return true;
        }
        if (c === "man" || c === "manufacturer") {
            manufacturerRef.current?.focus();
            return true;
        }

        // --- DIRECT SETTING COMMANDS ---
        if (c.startsWith("name ")) {
            setNameFilter(cmd.substring(5));
            return true;
        }
        if (c.startsWith("cat ")) {
            setCategoryFilter(cmd.substring(4));
            return true;
        }
        if (c.startsWith("brand ")) {
            setBrandFilter(cmd.substring(6));
            return true;
        }
        if (c.startsWith("man ")) {
            setManufacturerFilter(cmd.substring(4));
            return true;
        }

        return false; // Keep typing if command not matched
    });

    const renderProductCard = ({ item, index }: { item: typeof MOCK_PRODUCTS[0], index: number }) => (
        <TouchableOpacity
            style={[styles.card, index === selectedIndex && styles.cardSelected]}
            onPress={() => {
                setSelectedIndex(index);
                handleProductPress(item.id);
            }}
            activeOpacity={0.7}
        >
            <View style={styles.productImageContainer}>
                {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={styles.productImage} resizeMode="cover" />
                ) : (
                    <View style={[styles.productImagePlaceholder, index === selectedIndex && { backgroundColor: '#005BB5' }]}>
                        <Text style={styles.productImagePlaceholderText}>{item.name.charAt(0)}</Text>
                    </View>
                )}
            </View>
            <View style={styles.productInfo}>
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.productDetail}>Category: {item.category}</Text>
                <Text style={styles.productDetail}>Brand: {item.brand}</Text>
                <Text style={styles.productDetail}>Manufacturer: {item.manufacturer}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* 
                KeyboardAvoidingView ensures the list pushes up when you 
                type in the Filters or the Global Command Overlay.
            */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <View style={styles.filterContainer}>
                    <Text style={styles.filterTitle}>Filters</Text>
                    <View style={styles.filterRow}>
                        <TextInput
                            ref={nameRef}
                            style={styles.filterInput}
                            placeholder="Name (cmd: name)"
                            value={nameFilter}
                            onChangeText={setNameFilter}
                            placeholderTextColor="#999"
                        />
                        <TextInput
                            ref={categoryRef}
                            style={styles.filterInput}
                            placeholder="Category (cmd: cat)"
                            value={categoryFilter}
                            onChangeText={setCategoryFilter}
                            placeholderTextColor="#999"
                        />
                    </View>
                    <View style={styles.filterRow}>
                        <TextInput
                            ref={brandRef}
                            style={styles.filterInput}
                            placeholder="Brand (cmd: brand)"
                            value={brandFilter}
                            onChangeText={setBrandFilter}
                            placeholderTextColor="#999"
                        />
                        <TextInput
                            ref={manufacturerRef}
                            style={styles.filterInput}
                            placeholder="Manufacturer (cmd: man)"
                            value={manufacturerFilter}
                            onChangeText={setManufacturerFilter}
                            placeholderTextColor="#999"
                        />
                    </View>
                    {(nameFilter || categoryFilter || brandFilter || manufacturerFilter) ? (
                        <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
                            <Text style={styles.clearButtonText}>Clear Filters</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>

                <FlatList
                    ref={listRef}
                    data={filteredProducts}
                    renderItem={renderProductCard}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    extraData={selectedIndex}
                    keyboardShouldPersistTaps="handled"
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No products found</Text>
                            <Text style={styles.emptySubText}>Try adjusting your filters</Text>
                        </View>
                    }
                />
            </KeyboardAvoidingView>

            {/* NO LOCAL OVERLAY HERE - IT IS IN _layout.tsx */}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    filterContainer: {
        backgroundColor: '#fff',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    filterTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 12 },
    filterRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
    filterInput: {
        flex: 1,
        height: 44,
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        paddingHorizontal: 12,
        fontSize: 14,
        color: '#333',
    },
    clearButton: {
        alignSelf: 'flex-start',
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: '#FF3B30',
        borderRadius: 6,
        marginTop: 4,
    },
    clearButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
    listContent: { 
        padding: 16, 
        // Extra padding at bottom to ensure the Global Overlay doesn't hide the last item
        paddingBottom: 100 
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        flexDirection: 'row',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    cardSelected: { borderColor: '#007AFF', backgroundColor: '#e8f0ff' },
    productImageContainer: { marginRight: 12 },
    productImage: { width: 80, height: 80, borderRadius: 8 },
    productImagePlaceholder: {
        width: 80,
        height: 80,
        borderRadius: 8,
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    productImagePlaceholderText: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
    productInfo: { flex: 1, justifyContent: 'center' },
    productName: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 6 },
    productDetail: { fontSize: 13, color: '#666', marginBottom: 2 },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
    emptyText: { fontSize: 18, fontWeight: '600', color: '#999', marginBottom: 8 },
    emptySubText: { fontSize: 14, color: '#bbb' },
});