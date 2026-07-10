export const formatTransId = (transId) => {
  if (!transId) return '';
  const idStr = String(transId);
  return idStr.includes('-') ? idStr.split('-')[0].toUpperCase() : idStr.toUpperCase();
};

export const formatItemName = (product) => {
  if (!product) return 'Unknown Part';
  const code = product.PRODUCT_CODE || product.productCode || product.code;
  const brand = product.BRAND || product.brand;
  const model = product.MODEL || product.model;
  const name = product.NAME || product.name || product.DESCRIPTION || product.description;
  
  const metaParts = [];
  if (code) metaParts.push(code);
  
  const brandModel = [];
  if (brand) brandModel.push(brand);
  if (model) brandModel.push(model);
  if (brandModel.length > 0) metaParts.push(brandModel.join(' '));
  
  const metaString = metaParts.join(' - ');
  
  if (name && metaString) {
    if (name === metaString) return name;
    return `${name}\n(${metaString})`;
  }
  
  return name || metaString || 'Unknown Part';
};
