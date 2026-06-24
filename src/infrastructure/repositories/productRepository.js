import { supabase } from '@/lib/supabase';

/**
 * ProductRepository
 * Strictly handles database access and queries.
 * Returns raw data directly from the DB.
 */
export const productRepository = {
  async getAllProducts() {
    const { data, error } = await supabase
      .from('product')
      .select(`
        *,
        category(CNAME),
        supplier(COMPANY_NAME)
      `)
      .order('PRODUCT_ID', { ascending: false });
    
    if (error) throw new Error(error.message);
    return data || [];
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
    if (error) throw new Error(error.message);
    return true;
  }
};
