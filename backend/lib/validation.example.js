/**
 * Example usage of validation schemas in API endpoints
 * This file demonstrates how to use the validation schemas
 */

import { validateRequest, validateInput, uuidSchema, searchTermSchema, escapeLikePattern } from './validation.js';

/**
 * Example 1: Using validateRequest middleware
 */
// In your route:
// app.get('/api/user/:id', requireUser(), validateRequest(uuidSchema, 'params'), async (req, res) => {
//   // req.params.id is now validated
//   const { data, error } = await supabase
//     .from('profiles')
//     .select('*')
//     .eq('id', req.params.id)
//     .single();
//   
//   if (error) return res.status(500).json({ error: error.message });
//   res.json(data);
// });

/**
 * Example 2: Manual validation in route handler
 */
export async function exampleGetUser(req, res) {
  try {
    // Validate UUID parameter
    const validation = validateInput(uuidSchema, req.params.id);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error });
    }
    
    const userId = validation.data;
    
    // Verify authorization
    if (userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Safe query
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Example 3: Search with LIKE query
 */
export async function exampleSearch(req, res) {
  try {
    // Validate search term
    const validation = validateInput(searchTermSchema, req.query.q);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error });
    }
    
    const searchTerm = validation.data;
    // Escape wildcards (though validation should reject them)
    const escapedTerm = escapeLikePattern(searchTerm);
    
    // Safe query with escaped term
    const { data, error } = await supabase
      .from('community_discussions')
      .select('*')
      .ilike('title', `%${escapedTerm}%`)
      .limit(50);
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

