import { productRepository } from '@/infrastructure/repositories/productRepository';
import { mapToProductEntity, mapFromProductForm } from '@/core/entities/Product';

/**
 * ProductService
 * Pure business logic layer. Orchestrates repositories and handles business rules.
 */
export const ProductService = {
  async fetchProducts(options = {}) {
    const { data: rawProducts, count } = await productRepository.getAllProducts(options);
    const products = rawProducts.map(mapToProductEntity);
    return { products, count };
  },

  async fetchMetadata() {
    const [categories, suppliers] = await Promise.all([
      productRepository.getAllCategories(),
      productRepository.getAllSuppliers()
    ]);
    return { categories, suppliers };
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

  async deleteProduct(id, productData) {
    const result = await productRepository.deleteProduct(id);
    
    // If the delete was successful (not archived) and there is an imageUrl, delete it from UploadThing
    if (result.success && productData?.imageUrl) {
      try {
        await fetch('/api/uploadthing/delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fileUrl: productData.imageUrl,
            branchId: productData.branchId
          })
        });
      } catch (err) {
        console.error("Failed to delete image from UploadThing:", err);
      }
    }
    
    return result;
  }
};
