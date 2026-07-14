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
