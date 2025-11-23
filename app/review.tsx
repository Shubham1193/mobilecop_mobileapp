import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

// Mock collected data - replace with your actual data source
const MOCK_COLLECTED_DATA = [
  {
    id: '1',
    shopId: '1',
    shopName: 'Shop A',
    products: [
      { 
        productId: '1', 
        productName: 'Product A', 
        price: 29.99, 
        quantity: 5,
        notes: 'Good condition'
      },
      { 
        productId: '2', 
        productName: 'Product B', 
        price: 15.50, 
        quantity: 10,
        notes: ''
      },
    ]
  },
  {
    id: '2',
    shopId: '2',
    shopName: 'Shop B',
    products: [
      { 
        productId: '3', 
        productName: 'Product C', 
        price: 99.99, 
        quantity: 2,
        notes: 'Limited stock'
      },
    ]
  },
];

export default function ReviewScreen() {
  const router = useRouter();
  const [collectedData, setCollectedData] = useState(MOCK_COLLECTED_DATA);

  const getTotalItems = () => {
    return collectedData.reduce((total, shop) => {
      return total + shop.products.reduce((sum, product) => sum + product.quantity, 0);
    }, 0);
  };

  const getTotalValue = () => {
    return collectedData.reduce((total, shop) => {
      return total + shop.products.reduce((sum, product) => 
        sum + (product.price * product.quantity), 0
      );
    }, 0);
  };

  const renderShopSection = ({ item }: { item: typeof MOCK_COLLECTED_DATA[0] }) => (
    <View style={styles.shopSection}>
      <View style={styles.shopHeader}>
        <Text style={styles.shopName}>{item.shopName}</Text>
        <Text style={styles.shopItemCount}>
          {item.products.length} product{item.products.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {item.products.map((product, index) => (
        <View key={product.productId} style={styles.productRow}>
          <View style={styles.productInfo}>
            <Text style={styles.productName}>{product.productName}</Text>
            <Text style={styles.productDetails}>
              ${product.price.toFixed(2)} × {product.quantity} = ${(product.price * product.quantity).toFixed(2)}
            </Text>
            {product.notes && (
              <Text style={styles.productNotes}>Note: {product.notes}</Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Summary Header */}
      <View style={styles.summaryHeader}>
        <Text style={styles.summaryTitle}>Collection Summary</Text>
        
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{collectedData.length}</Text>
            <Text style={styles.statLabel}>Shops</Text>
          </View>
          
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{getTotalItems()}</Text>
            <Text style={styles.statLabel}>Items</Text>
          </View>
          
          <View style={styles.statBox}>
            <Text style={styles.statValue}>${getTotalValue().toFixed(2)}</Text>
            <Text style={styles.statLabel}>Total Value</Text>
          </View>
        </View>
      </View>

      {/* Collected Data List */}
      {collectedData.length > 0 ? (
        <FlatList
          data={collectedData}
          renderItem={renderShopSection}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No data collected yet</Text>
          <Text style={styles.emptySubText}>Start collecting products from shops</Text>
          <TouchableOpacity 
            style={styles.startButton}
            onPress={() => router.back()}
          >
            <Text style={styles.startButtonText}>Go to Shops</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Action Buttons */}
      {collectedData.length > 0 && (
        <View style={styles.actionContainer}>
          <TouchableOpacity 
            style={styles.exportButton}
            onPress={() => {
              // TODO: Implement export functionality
              console.log('Export data:', collectedData);
            }}
          >
            <Text style={styles.exportButtonText}>Export Data</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.doneButton}
            onPress={() => router.back()}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  summaryHeader: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  summaryTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  shopSection: {
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
  shopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  shopName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  shopItemCount: {
    fontSize: 14,
    color: '#666',
  },
  productRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  productDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  productNotes: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#999',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 16,
    color: '#bbb',
    marginBottom: 24,
  },
  startButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  actionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  exportButton: {
    flex: 1,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  doneButton: {
    flex: 1,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});