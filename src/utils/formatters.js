export const formatTransId = (transId) => {
  if (!transId) return '';
  const idStr = String(transId);
  return idStr.includes('-') ? idStr.split('-')[0].toUpperCase() : idStr.toUpperCase();
};

export const formatItemName = (product) => {
  if (!product) return 'Unknown Part';
  const parts = [];
  const code = product.PRODUCT_CODE || product.productCode;
  const brand = product.BRAND || product.brand;
  const name = product.NAME || product.name;
  
  if (code) parts.push(code);
  if (brand) parts.push(brand);
  if (name) parts.push(name);
  return parts.join(' - ') || 'Unknown Part';
};
