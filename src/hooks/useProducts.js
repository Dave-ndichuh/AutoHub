import { useState, useEffect, useCallback } from 'react';
import { ProductService } from '@/core/services/ProductService';
import { logAction } from '@/lib/logger';

/**
 * useProducts hook
 * Bridges the gap between UI components and Application business logic.
 * Handles React state, loading states, error boundaries, and orchestration.
 */
export function useProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ProductService.fetchAllData();
      setProducts(data.products);
      setCategories(data.categories);
      setSuppliers(data.suppliers);
    } catch (err) {
      setError(err.message);
      console.error("Error fetching products:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const saveProduct = async (id, formData) => {
    try {
      await ProductService.saveProduct(id, formData);
      
      await logAction({
        action: id ? 'Updated Product' : 'Added Product',
        details: `${id ? 'Updated' : 'Added'} product: ${formData.NAME} (Code: ${formData.PRODUCT_CODE})`,
        severity: 'info'
      });
      
      await fetchProducts();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const deleteProduct = async (id, productData) => {
    try {
      const result = await ProductService.deleteProduct(id);
      
      if (productData) {
        await logAction({
          action: result?.archived ? 'Archived Product' : 'Deleted Product',
          details: `${result?.archived ? 'Archived' : 'Deleted'} product: ${productData.name} (Code: ${productData.productCode})`,
          severity: result?.archived ? 'warning' : 'danger'
        });
      }
      
      await fetchProducts();
      return { success: true, archived: result?.archived };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  return {
    products,
    categories,
    suppliers,
    loading,
    error,
    fetchProducts,
    saveProduct,
    deleteProduct
  };
}
