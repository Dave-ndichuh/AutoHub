'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function getStoreCatalog() {
  try {
    const { data: products, error } = await supabaseAdmin
      .from('product')
      .select('*, category(CNAME)')
      .eq('STATUS', 'active')
      .gt('ON_HAND', 0)
      .order('PRODUCT_ID', { ascending: false });

    if (error) {
      throw error;
    }

    return products.map(p => ({
      PRODUCT_ID: p.PRODUCT_ID,
      NAME: p.NAME,
      DESCRIPTION: p.DESCRIPTION,
      PRICE: p.PRICE ? Number(p.PRICE) : null,
      IMAGE_URL: p.IMAGE_URL,
      BRAND: p.BRAND,
      MODEL: p.MODEL,
      ON_HAND: p.ON_HAND,
      CATEGORY_NAME: p.category?.CNAME || 'Uncategorized',
      CATEGORY_ID: p.CATEGORY_ID
    }));
  } catch (error) {
    console.error('Error fetching store catalog:', error);
    return [];
  }
}

export async function getCategories() {
  try {
    const { data: categories, error } = await supabaseAdmin
      .from('category')
      .select('*')
      .order('CNAME', { ascending: true });

    if (error) {
      throw error;
    }

    // Deduplicate by CNAME
    const uniqueCategories = [];
    const seen = new Set();
    
    if (categories) {
      for (const cat of categories) {
        if (!seen.has(cat.CNAME)) {
          seen.add(cat.CNAME);
          uniqueCategories.push(cat);
        }
      }
    }

    return uniqueCategories;
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
}
