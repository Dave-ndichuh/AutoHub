import { supabase } from '@/lib/supabase';

/**
 * ProductRepository
 * Strictly handles database access and queries.
 * Returns raw data directly from the DB.
 */
export const productRepository = {
  async getAllProducts(options = {}) {
    const { branchId = 'ALL', page = 1, limit = 10, searchTerm = '', sortKey = 'dateStockIn', sortDir = 'desc' } = options;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const sortMap = {
      productCode: 'PRODUCT_CODE',
      name: 'NAME',
      onHand: 'ON_HAND',
      status: 'STATUS',
      price: 'PRICE',
      costPrice: 'COST_PRICE',
      dateStockIn: 'DATE_STOCK_IN',
    };
    const dbSortKey = sortMap[sortKey] || 'PRODUCT_ID';

    let query = supabase
      .from('product')
      .select(`
        *,
        category(CNAME),
        supplier(COMPANY_NAME)
      `, { count: 'exact' });
      
    if (branchId !== 'ALL') {
      query = query.eq('BRANCH_ID', branchId);
    }

    if (searchTerm) {
      query = query.or(`NAME.ilike.%${searchTerm}%,PRODUCT_CODE.ilike.%${searchTerm}%,BRAND.ilike.%${searchTerm}%,MODEL.ilike.%${searchTerm}%,BARCODE.ilike.%${searchTerm}%`);
    }

    query = query.order(dbSortKey, { ascending: sortDir === 'asc' });
    query = query.range(from, to);

    const { data, count, error } = await query;
    
    if (error) throw new Error(error.message);
    return { data: data || [], count: count || 0 };
  },

  async getAllCategories() {
    const { data, error } = await supabase
      .from('category')
      .select('*')
      .order('CNAME', { ascending: true });
    
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getAllSuppliers() {
    const { data, error } = await supabase.from('supplier').select('*');
    if (error) throw new Error(error.message);
    return data || [];
  },

  async createProduct(payload) {
    const { data, error } = await supabase.from('product').insert([payload]).select();
    if (error) throw new Error(error.message);
    return data ? data[0] : null;
  },

  async updateProduct(id, payload) {
    const { data, error } = await supabase.from('product').update(payload).eq('PRODUCT_ID', id).select();
    if (error) throw new Error(error.message);
    return data ? data[0] : null;
  },

  async deleteProduct(id) {
    const { error } = await supabase.from('product').delete().eq('PRODUCT_ID', id);
    if (error) {
      if (error.code === '23503' || error.message.includes('foreign key constraint')) {
        const { error: softError } = await supabase.from('product').update({ STATUS: 'inactive' }).eq('PRODUCT_ID', id);
        if (softError) throw new Error(softError.message);
        return { archived: true };
      }
      throw new Error(error.message);
    }
    return { success: true };
  }
};
