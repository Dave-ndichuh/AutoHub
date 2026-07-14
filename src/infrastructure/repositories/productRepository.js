import { supabase } from '@/lib/supabase';

/**
 * ProductRepository
 * Strictly handles database access and queries.
 * Returns raw data directly from the DB.
 */
export const productRepository = {
  async getAllProducts(branchId = 'ALL') {
    let query = supabase
      .from('product')
      .select(`
        *,
        category(CNAME),
        supplier(COMPANY_NAME)
      `)
      .order('PRODUCT_ID', { ascending: false });
      
    if (branchId !== 'ALL') {
      query = query.eq('BRANCH_ID', branchId);
    }

    const { data, error } = await query;
    
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
