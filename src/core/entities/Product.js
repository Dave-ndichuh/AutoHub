/**
 * Product Entity / Data Mapper
 * Standardizes the shape of a product object across the application.
 * Isolates the rest of the application from specific database column naming if necessary.
 */

export const mapToProductEntity = (dbRow) => {
  return {
    id: dbRow.PRODUCT_ID,
    productCode: dbRow.PRODUCT_CODE,
    name: dbRow.NAME,
    description: dbRow.DESCRIPTION || '',
    onHand: Number(dbRow.ON_HAND) || 0,
    price: Number(dbRow.PRICE) || 0,
    costPrice: Number(dbRow.COST_PRICE) || 0,
    categoryId: dbRow.CATEGORY_ID || '',
    categoryName: dbRow.category?.CNAME || '',
    supplierId: dbRow.SUPPLIER_ID || '',
    supplierName: dbRow.supplier?.COMPANY_NAME || '',
    status: dbRow.STATUS || 'active',
    uom: dbRow.UOM || 'pcs',
    reorderThreshold: Number(dbRow.REORDER_THRESHOLD) || 5,
    barcode: dbRow.BARCODE || '',
    imageUrl: dbRow.IMAGE_URL || '',
    taxRate: Number(dbRow.TAX_RATE) || 16.0,
    brand: dbRow.BRAND || '',
    model: dbRow.MODEL || '',
    weight: dbRow.WEIGHT || '',
    dateStockIn: dbRow.DATE_STOCK_IN,
    updatedAt: dbRow.UPDATED_AT,
    branchId: dbRow.BRANCH_ID,
    // Keep raw data for backward compatibility during transition
    _raw: dbRow
  };
};

export const mapFromProductForm = (formData) => {
  return {
    PRODUCT_CODE: formData.PRODUCT_CODE,
    NAME: formData.NAME,
    DESCRIPTION: formData.DESCRIPTION,
    ON_HAND: Number(formData.ON_HAND) || 0,
    PRICE: Number(formData.PRICE) || 0,
    CATEGORY_ID: formData.CATEGORY_ID || null,
    SUPPLIER_ID: formData.SUPPLIER_ID || null,
    STATUS: formData.STATUS || 'active',
    UOM: formData.UOM || 'pcs',
    REORDER_THRESHOLD: Number(formData.REORDER_THRESHOLD) || 5,
    COST_PRICE: Number(formData.COST_PRICE) || 0,
    BARCODE: formData.BARCODE || '',
    IMAGE_URL: formData.IMAGE_URL || '',
    TAX_RATE: Number(formData.TAX_RATE) || 16.0,
    BRAND: formData.BRAND || '',
    MODEL: formData.MODEL || '',
    WEIGHT: formData.WEIGHT || '',
    BRANCH_ID: formData.BRANCH_ID || 1,
    DATE_STOCK_IN: new Date().toISOString()
  };
};
