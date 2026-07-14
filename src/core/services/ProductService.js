import { productRepository } from '@/infrastructure/repositories/productRepository';
import { mapToProductEntity, mapFromProductForm } from '@/core/entities/Product';

/**
 * ProductService
 * Pure business logic layer. Orchestrates repositories and handles business rules.
 */
export const ProductService = {
  async fetchAllData(branchId = 'ALL') {
    // Fetch products, categories, and suppliers concurrently
    const [rawProducts, categories, suppliers] = await Promise.all([
      productRepository.getAllProducts(branchId),
      productRepository.getAllCategories(),
      productRepository.getAllSuppliers()
    ]);

    // Map raw database rows to domain entities
    const products = rawProducts.map(mapToProductEntity);

    return { products, categories, suppliers };
  },

  async saveProduct(id, formData) {
    const payload = mapFromProductForm(formData);
    
    // In update mode, DATE_STOCK_IN usually shouldn't be overridden unless intended, 
    // but preserving the original behavior of the controller.
    if (id) {
      delete payload.DATE_STOCK_IN; // Ensure we don't overwrite creation date on update
      return await productRepository.updateProduct(id, payload);
    } else {
      return await productRepository.createProduct(payload);
    }
  },

  async deleteProduct(id) {
    return await productRepository.deleteProduct(id);
  }
};
