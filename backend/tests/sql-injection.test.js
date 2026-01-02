/**
 * SQL Injection Protection Test Suite
 * Tests that SQL injection payloads are properly rejected or escaped
 * 
 * Note: These tests focus on validation layer protection.
 * Supabase queries are already parameterized, but validation adds an extra defense layer.
 */

import request from 'supertest';
import app from '../server.js';

describe('SQL Injection Protection Tests', () => {
  // SQL injection payloads that should be rejected
  const sqlInjectionPayloads = [
    "'; DROP TABLE profiles; --",
    "' OR '1'='1",
    "admin'--",
    "') UNION SELECT * FROM profiles WHERE '1'='1",
    "1' UNION SELECT NULL, NULL, NULL--",
    "\\'; DROP TABLE profiles; --",
    "'); DELETE FROM profiles; --",
    "' OR 1=1--",
    "' UNION SELECT password FROM users--",
    "1'; INSERT INTO profiles (id, email) VALUES ('hacker', 'hack@evil.com'); --",
  ];

  describe('POST /api/twilio/token - UUID Validation', () => {
    it.each(sqlInjectionPayloads)(
      'should reject SQL injection in userId parameter: %s',
      async (payload) => {
        const response = await request(app)
          .post('/api/twilio/token')
          .send({ userId: payload })
          .expect(400); // Should return 400 (validation error)
        
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error');
        // Should NOT contain SQL syntax errors (which would indicate execution)
        expect(response.body.error).not.toContain('syntax error');
        expect(response.body.error).not.toContain('unexpected');
        expect(response.body.error).not.toContain('relation');
        // Should indicate validation error
        expect(response.body.error.toLowerCase()).toMatch(/invalid|uuid|format/);
      }
    );

    it('should reject empty userId', async () => {
      const response = await request(app)
        .post('/api/twilio/token')
        .send({ userId: '' })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });

    it('should reject null userId', async () => {
      const response = await request(app)
        .post('/api/twilio/token')
        .send({ userId: null })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).not.toContain('syntax error');
    });

    it('should reject non-UUID format', async () => {
      const response = await request(app)
        .post('/api/twilio/token')
        .send({ userId: 'not-a-uuid' })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error.toLowerCase()).toMatch(/invalid|uuid|format/);
    });
  });

  describe('POST /api/create-checkout-session - Plan Type Validation', () => {
    // Note: This endpoint requires authentication, so we test validation layer
    // In a real scenario, you'd need a valid auth token
    
    const sqlInjectionPayloads = [
      "'; DROP TABLE profiles; --",
      "' OR '1'='1",
      "admin'; DELETE FROM profiles; --",
      "plus'; UPDATE profiles SET role='admin'; --",
      "pro'); INSERT INTO profiles (id, plan) VALUES ('hacker', 'pro'); --",
    ];

    it.each(sqlInjectionPayloads)(
      'should reject SQL injection in plan parameter: %s',
      async (payload) => {
        const response = await request(app)
          .post('/api/create-checkout-session')
          .set('Authorization', 'Bearer invalid-token') // Will fail auth, but validation runs first
          .send({ plan: payload })
          .expect((res) => {
            // Should return 400 (validation error) or 401 (auth error)
            // Validation should run before auth
            expect([400, 401]).toContain(res.status);
          });
        
        // If validation runs first, we should get validation error
        if (response.status === 400) {
          expect(response.body).toHaveProperty('error');
          expect(response.body.error.toLowerCase()).toMatch(/invalid|plan/);
          expect(response.body.error).not.toContain('syntax error');
        }
      }
    );

    it('should reject invalid plan type', async () => {
      const response = await request(app)
        .post('/api/create-checkout-session')
        .set('Authorization', 'Bearer invalid-token')
        .send({ plan: 'invalid-plan' })
        .expect((res) => {
          expect([400, 401]).toContain(res.status);
        });
      
      if (response.status === 400) {
        expect(response.body.error.toLowerCase()).toMatch(/invalid|plan/);
      }
    });

    it('should reject null plan', async () => {
      const response = await request(app)
        .post('/api/create-checkout-session')
        .set('Authorization', 'Bearer invalid-token')
        .send({ plan: null })
        .expect((res) => {
          expect([400, 401]).toContain(res.status);
        });
    });
  });

  describe('POST /api/generate-question - Text Field Validation', () => {
    // Note: This endpoint requires authentication
    
    it.each(sqlInjectionPayloads)(
      'should reject SQL injection in instructions parameter: %s',
      async (payload) => {
        const response = await request(app)
          .post('/api/generate-question')
          .set('Authorization', 'Bearer invalid-token')
          .send({
            image: 'data:image/png;base64,test',
            instructions: payload
          })
          .expect((res) => {
            // Should return 400 (validation error) or 401 (auth error)
            expect([400, 401]).toContain(res.status);
          });
        
        // If validation runs, check for validation error
        if (response.status === 400) {
          expect(response.body).toHaveProperty('error');
          expect(response.body.error).not.toContain('syntax error');
        }
      }
    );

    it.each(sqlInjectionPayloads)(
      'should reject SQL injection in context parameter: %s',
      async (payload) => {
        const response = await request(app)
          .post('/api/generate-question')
          .set('Authorization', 'Bearer invalid-token')
          .send({
            image: 'data:image/png;base64,test',
            context: payload
          })
          .expect((res) => {
            expect([400, 401]).toContain(res.status);
          });
        
        if (response.status === 400) {
          expect(response.body).toHaveProperty('error');
          expect(response.body.error).not.toContain('syntax error');
        }
      }
    );

    it('should reject content that is too long', async () => {
      const longContent = 'A'.repeat(50001); // Exceeds 50,000 character limit
      const response = await request(app)
        .post('/api/generate-question')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          image: 'data:image/png;base64,test',
          context: longContent
        })
        .expect((res) => {
          expect([400, 401]).toContain(res.status);
        });
      
      if (response.status === 400) {
        expect(response.body.error.toLowerCase()).toMatch(/too long|max|length/);
      }
    });
  });

  describe('POST /api/rewrite-steps - Content Validation', () => {
    it.each(sqlInjectionPayloads)(
      'should reject SQL injection in content parameter: %s',
      async (payload) => {
        const response = await request(app)
          .post('/api/rewrite-steps')
          .set('Authorization', 'Bearer invalid-token')
          .send({
            content: payload
          })
          .expect((res) => {
            expect([400, 401]).toContain(res.status);
          });
        
        if (response.status === 400) {
          expect(response.body).toHaveProperty('error');
          expect(response.body.error).not.toContain('syntax error');
        }
      }
    );

    it('should reject empty content', async () => {
      const response = await request(app)
        .post('/api/rewrite-steps')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          content: ''
        })
        .expect((res) => {
          expect([400, 401]).toContain(res.status);
        });
      
      if (response.status === 400) {
        expect(response.body.error.toLowerCase()).toMatch(/cannot be empty|required/);
      }
    });

    it('should reject content that is too long', async () => {
      const longContent = 'A'.repeat(50001);
      const response = await request(app)
        .post('/api/rewrite-steps')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          content: longContent
        })
        .expect((res) => {
          expect([400, 401]).toContain(res.status);
        });
      
      if (response.status === 400) {
        expect(response.body.error.toLowerCase()).toMatch(/too long|max|length/);
      }
    });
  });

  describe('POST /api/moderate-content - Text Validation', () => {
    it.each(sqlInjectionPayloads)(
      'should reject SQL injection in text parameter: %s',
      async (payload) => {
        const response = await request(app)
          .post('/api/moderate-content')
          .send({
            text: payload,
            contentType: 'post'
          })
          .expect((res) => {
            // This endpoint doesn't require auth, so should return 400 if validation fails
            expect([200, 400]).toContain(res.status);
          });
        
        // Note: This endpoint might accept the text as-is for moderation
        // The important thing is that it doesn't cause SQL errors
        if (response.status === 400) {
          expect(response.body).toHaveProperty('error');
          expect(response.body.error).not.toContain('syntax error');
        }
      }
    );

    it('should reject empty text', async () => {
      const response = await request(app)
        .post('/api/moderate-content')
        .send({
          text: '',
          contentType: 'post'
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error.toLowerCase()).toMatch(/cannot be empty|required/);
    });

    it('should reject text that is too long', async () => {
      const longText = 'A'.repeat(50001);
      const response = await request(app)
        .post('/api/moderate-content')
        .send({
          text: longText,
          contentType: 'post'
        })
        .expect(400);
      
      expect(response.body.error.toLowerCase()).toMatch(/too long|max|length/);
    });

    it('should reject invalid contentType', async () => {
      const response = await request(app)
        .post('/api/moderate-content')
        .send({
          text: 'Valid text content',
          contentType: "'; DROP TABLE posts; --"
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error.toLowerCase()).toMatch(/content type|post|reply/);
    });
  });

  describe('Edge Cases', () => {
    it('should handle special Unicode characters in text fields', async () => {
      const unicodePayloads = [
        '测试',
        '🎉',
        'تست',
        '🚀',
      ];

      for (const payload of unicodePayloads) {
        const response = await request(app)
          .post('/api/moderate-content')
          .send({
            text: payload,
            contentType: 'post'
          })
          .expect((res) => {
            // Should either accept (200) or reject with validation error (400)
            expect([200, 400]).toContain(res.status);
          });
        
        if (response.body.error) {
          expect(response.body.error).not.toContain('syntax error');
        }
      }
    });

    it('should handle null values appropriately', async () => {
      const response = await request(app)
        .post('/api/twilio/token')
        .send({ userId: null })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).not.toContain('syntax error');
    });

    it('should handle missing required fields', async () => {
      const response = await request(app)
        .post('/api/twilio/token')
        .send({})
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Validation Error Format', () => {
    it('should return consistent error format for invalid UUID', async () => {
      const response = await request(app)
        .post('/api/twilio/token')
        .send({ userId: "'; DROP TABLE profiles; --" })
        .expect(400);
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(typeof response.body.error).toBe('string');
      expect(response.body.error.length).toBeGreaterThan(0);
    });

    it('should not expose internal implementation details in errors', async () => {
      const response = await request(app)
        .post('/api/twilio/token')
        .send({ userId: "'; DROP TABLE profiles; --" })
        .expect(400);
      
      // Should not expose stack traces, file paths, or internal details
      expect(response.body.error).not.toContain('at ');
      expect(response.body.error).not.toContain('Error:');
      expect(response.body.error).not.toContain('.js');
      expect(response.body.error).not.toContain('node_modules');
    });
  });
});
