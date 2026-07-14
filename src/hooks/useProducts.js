import { useState, useEffect, useCallback } from 'react';
import { ProductService } from '@/core/services/ProductService';
import { logAction } from '@/lib/logger';
import { useAuth } from '@/components/AuthGuard';

/**
 * useProducts hook
 * Bridges the gap between UI components and Application business logic.
 * Handles React state, loading states, error boundaries, and orchestration.
 */
export function useProducts({ page = 1, limit = 10, searchTerm = '', sortConfig = { key: 'dateStockIn', direction: 'desc' } } = {}) {
  const { branchId } = useAuth();
  const [products, setProducts] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMetadata = useCallback(async () => {
    try {
      const meta = await ProductService.fetchMetadata();
      setCategories(meta.categories);
      setSuppliers(meta.suppliers);
    } catch (err) {
      console.error("Error fetching metadata:", err);
    }
  }, []);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  const fetchProducts = useCallback(async () => {
    if (!branchId) return; // Wait for branchId to be loaded
    setLoading(true);
    setError(null);
    try {
      const { products: fetchedProducts, count } = await ProductService.fetchProducts({
        branchId,
        page,
        limit,
        searchTerm,
        sortKey: sortConfig.key,
        sortDir: sortConfig.direction
      });
      setProducts(fetchedProducts);
      setTotalCount(count);
    } catch (err) {
      setError(err.message);
      console.error("Error fetching products:", err);
    } finally {
      setLoading(false);
    }
  }, [branchId, page, limit, searchTerm, sortConfig.key, sortConfig.direction]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const saveProduct = async (id, formData) => {
    try {
      if (!formData.BRANCH_ID || formData.BRANCH_ID === 'ALL') {
        throw new Error("BRANCH_ID is required and must be a specific branch");
      }
      const payload = { ...formData };
      await ProductService.saveProduct(id, payload);
      
      await logAction({
        action: id ? 'Updated Product' : 'Added Product',
        details: `${id ? 'Updated' : 'Added'} product: ${payload.NAME} (Code: ${payload.PRODUCT_CODE})`,
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
      const result = await ProductService.deleteProduct(id, productData);
      
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
    totalCount,
    categories,
    suppliers,
    loading,
    error,
    fetchProducts,
    saveProduct,
    deleteProduct
  };
}
