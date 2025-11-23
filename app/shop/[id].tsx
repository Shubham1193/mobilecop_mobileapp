import { useLocalSearchParams, useRouter } from 'expo-router';
import Fuse from 'fuse.js'; // <-- NEW: Import Fuse.js
import { useEffect, useMemo, useRef, useState } from 'react'; // <-- Import useMemo
import {
    FlatList,
    Image,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import Products from '../../assets/textstoembed/products.json';
import { useCommand } from '../../context/CommandContext';

export default function ShopProductsScreen() {
    const router = useRouter();
    const { id: shopId } = useLocalSearchParams();

    const nameRef = useRef<TextInput>(null);
    const categoryRef = useRef<TextInput>(null);
    const brandRef = useRef<TextInput>(null);
    const manufacturerRef = useRef<TextInput>(null);
    const listRef = useRef<FlatList>(null);

    const [products, setProducts] = useState(Products);
    const [nameFilter, setNameFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [brandFilter, setBrandFilter] = useState('');
    const [manufacturerFilter, setManufacturerFilter] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);

    const fuse = useMemo(() => {
        const options: Fuse.IFuseOptions<typeof Products[0]> = {
            keys: ['name', 'category', 'brand', 'manufacturer'],
            threshold: 0.4,
            ignoreLocation: true,
            distance: 1000,
        };
        return new Fuse(products, options);
    }, [products]);
    const filteredProducts = useMemo(() => {
        const andQuery = [];
        if (nameFilter.trim()) andQuery.push({ name: nameFilter.trim() });
        if (categoryFilter.trim()) andQuery.push({ category: categoryFilter.trim() });
        if (brandFilter.trim()) andQuery.push({ brand: brandFilter.trim() });
        if (manufacturerFilter.trim()) andQuery.push({ manufacturer: manufacturerFilter.trim() });

        if (andQuery.length === 0) {
            return products;
        }

        const searchResults = fuse.search({ $and: andQuery });

        return searchResults.map(result => result.item);
    }, [products, fuse, nameFilter, categoryFilter, brandFilter, manufacturerFilter]);


    const selectedIndexRef = useRef(selectedIndex);
    const filteredProductsRef = useRef(filteredProducts);

    useEffect(() => {
        selectedIndexRef.current = selectedIndex;
        filteredProductsRef.current = filteredProducts;
    }, [selectedIndex, filteredProducts]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [nameFilter, categoryFilter, brandFilter, manufacturerFilter]);

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

    const handleProductPress = (productId: number) => {
        console.log("Navigating to product:", productId);
        router.push({
            pathname: '/product/[id]',
            params: { id: productId, shopId: shopId as string }
        });
    };

    useCommand((cmd) => {
        console.log("coomamd recvied individual page")
        const c = cmd.toLowerCase().trim();
        console.log("Command received:", c);

        const currentList = filteredProductsRef.current;
        const currentIndex = selectedIndexRef.current;

        if (c === "add-information" || c === "add information") {
            const selectedProduct = currentList[currentIndex];
            if (selectedProduct) {
                handleProductPress(selectedProduct.id);
                return true;
            }
        }
        if(c === 'clear-filters'){
            clearFilters()
        }

        if (c === "next-product") {
            setSelectedIndex(prev => Math.min(prev + 1, currentList.length - 1));
            return true;
        }
        if (c === "previous-product") {
            setSelectedIndex(prev => Math.max(prev - 1, 0));
            return true;
        }
        if (c === "back") {
            router.back();
            return true;
        }
        if (c === "add-name") { nameRef.current?.focus(); return true; }
        if (c === "add-category") { categoryRef.current?.focus(); return true; }
        if (c === "add-brand") { brandRef.current?.focus(); return true; }
        if (c === "add-manufacturer") { manufacturerRef.current?.focus(); return true; }
        
        if (c.startsWith("add-name:")) { setNameFilter(cmd.substring(cmd.indexOf(":") + 1).trim()); return true; }
        if (c.startsWith("add-category:")) { setCategoryFilter(cmd.substring(cmd.indexOf(":") + 1).trim()); return true; }
        if (c.startsWith("add-brand:")) { setBrandFilter(cmd.substring(cmd.indexOf(":") + 1).trim()); return true; }
        if (c.startsWith("add-manufacturer:")) { setManufacturerFilter(cmd.substring(cmd.indexOf(":") + 1).trim()); return true; }

        return false;
    }, "individual-shop");

    const renderProductCard = ({ item, index }: { item: typeof Products[0], index: number }) => (
        <TouchableOpacity
            style={[styles.card, index === selectedIndex && styles.cardSelected]}
            onPress={() => {
                setSelectedIndex(index);
                handleProductPress(item.id);
            }}
            activeOpacity={0.7}
        >
            <View style={styles.productImageContainer}>
                {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.productImage} resizeMode="cover" />
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
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <View style={styles.filterContainer}>
                    <Text style={styles.filterTitle}>Filters</Text>
                    <View style={styles.filterRow}>
                        <TextInput ref={nameRef} style={styles.filterInput} placeholder="Name" value={nameFilter} onChangeText={setNameFilter} placeholderTextColor="#999" />
                        <TextInput ref={categoryRef} style={styles.filterInput} placeholder="Category" value={categoryFilter} onChangeText={setCategoryFilter} placeholderTextColor="#999" />
                    </View>
                    <View style={styles.filterRow}>
                        <TextInput ref={brandRef} style={styles.filterInput} placeholder="Brand" value={brandFilter} onChangeText={setBrandFilter} placeholderTextColor="#999" />
                        <TextInput ref={manufacturerRef} style={styles.filterInput} placeholder="Manufacturer" value={manufacturerFilter} onChangeText={setManufacturerFilter} placeholderTextColor="#999" />
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
                    keyExtractor={(item) => item.id.toString()}
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