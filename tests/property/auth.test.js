/**
 * Property-Based Tests for Server Authentication
 * 
 * Tests password hashing, JWT token generation, and middleware validation.
 */

const fc = require('fast-check');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { generateToken, authenticate, JWT_SECRET } = require('../../src/middleware/auth');

// Arbitraries for generating test data
const passwordArbitrary = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => s.length > 0 && !s.includes('\0'));

const emailArbitrary = fc.emailAddress();

const uuidArbitrary = fc.uuid();

describe('Server Authentication Properties', () => {
  /**
   * **Feature: enhanced-plan-creation, Property 15: Password Hash Security**
   * **Validates: Requirements 7.1**
   * 
   * *For any* password, the stored hash should not equal the original password 
   * and bcrypt.compare should return true for the original password.
   */
  describe('Property 15: Password Hash Security', () => {
    it('should hash passwords such that hash differs from original and compare succeeds', async () => {
      // Use lower salt rounds for testing (4 is minimum, production uses 10+)
      const TEST_SALT_ROUNDS = 4;
      
      await fc.assert(
        fc.asyncProperty(passwordArbitrary, async (password) => {
          const hash = await bcrypt.hash(password, TEST_SALT_ROUNDS);
          
          // Hash should not equal original password
          expect(hash).not.toBe(password);
          
          // Hash should be a valid bcrypt hash (starts with $2b$ or $2a$)
          expect(hash).toMatch(/^\$2[ab]\$/);
          
          // bcrypt.compare should return true for original password
          const isValid = await bcrypt.compare(password, hash);
          expect(isValid).toBe(true);
          
          // bcrypt.compare should return false for different password
          const wrongPassword = password + 'x';
          const isInvalid = await bcrypt.compare(wrongPassword, hash);
          expect(isInvalid).toBe(false);
        }),
        { numRuns: 100 }
      );
    }, 60000); // 60 second timeout for bcrypt operations
  });


  /**
   * **Feature: enhanced-plan-creation, Property 16: JWT Token Contains Required Claims**
   * **Validates: Requirements 7.3**
   * 
   * *For any* generated JWT token, decoding should reveal userId and exp (expiration) claims.
   */
  describe('Property 16: JWT Token Contains Required Claims', () => {
    it('should generate tokens with userId and expiration claims', () => {
      fc.assert(
        fc.property(uuidArbitrary, emailArbitrary, (userId, email) => {
          const token = generateToken(userId, email);
          
          // Token should be a non-empty string
          expect(typeof token).toBe('string');
          expect(token.length).toBeGreaterThan(0);
          
          // Decode the token
          const decoded = jwt.verify(token, JWT_SECRET);
          
          // Should contain userId claim
          expect(decoded.userId).toBe(userId);
          
          // Should contain email claim
          expect(decoded.email).toBe(email);
          
          // Should contain exp (expiration) claim
          expect(decoded.exp).toBeDefined();
          expect(typeof decoded.exp).toBe('number');
          
          // Expiration should be in the future
          const now = Math.floor(Date.now() / 1000);
          expect(decoded.exp).toBeGreaterThan(now);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: enhanced-plan-creation, Property 17: JWT Middleware Validation**
   * **Validates: Requirements 7.4, 7.5**
   * 
   * *For any* request to protected endpoint, missing or invalid token should result 
   * in 401 response, valid token should allow request to proceed.
   */
  describe('Property 17: JWT Middleware Validation', () => {
    // Helper to create mock request/response objects
    const createMockReqRes = (authHeader) => {
      const req = {
        headers: authHeader ? { authorization: authHeader } : {}
      };
      const res = {
        statusCode: null,
        jsonData: null,
        status: function(code) {
          this.statusCode = code;
          return this;
        },
        json: function(data) {
          this.jsonData = data;
          return this;
        }
      };
      return { req, res };
    };

    it('should reject requests with missing token', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const { req, res } = createMockReqRes(null);
          let nextCalled = false;
          const next = () => { nextCalled = true; };
          
          authenticate(req, res, next);
          
          expect(res.statusCode).toBe(401);
          expect(res.jsonData.error).toBe('Unauthorized');
          expect(nextCalled).toBe(false);
        }),
        { numRuns: 10 }
      );
    });

    it('should reject requests with invalid token format', () => {
      const invalidFormatArbitrary = fc.oneof(
        fc.string().filter(s => !s.startsWith('Bearer ')),
        fc.constant('Bearer'),
        fc.constant('Basic token123')
      );

      fc.assert(
        fc.property(invalidFormatArbitrary, (invalidAuth) => {
          const { req, res } = createMockReqRes(invalidAuth);
          let nextCalled = false;
          const next = () => { nextCalled = true; };
          
          authenticate(req, res, next);
          
          expect(res.statusCode).toBe(401);
          expect(nextCalled).toBe(false);
        }),
        { numRuns: 50 }
      );
    });

    it('should reject requests with invalid JWT token', () => {
      const invalidTokenArbitrary = fc.string({ minLength: 10, maxLength: 200 })
        .filter(s => !s.includes('.') || s.split('.').length !== 3);

      fc.assert(
        fc.property(invalidTokenArbitrary, (invalidToken) => {
          const { req, res } = createMockReqRes(`Bearer ${invalidToken}`);
          let nextCalled = false;
          const next = () => { nextCalled = true; };
          
          authenticate(req, res, next);
          
          expect(res.statusCode).toBe(401);
          expect(nextCalled).toBe(false);
        }),
        { numRuns: 50 }
      );
    });

    it('should accept requests with valid JWT token and set user on request', () => {
      fc.assert(
        fc.property(uuidArbitrary, emailArbitrary, (userId, email) => {
          const token = generateToken(userId, email);
          const { req, res } = createMockReqRes(`Bearer ${token}`);
          let nextCalled = false;
          const next = () => { nextCalled = true; };
          
          authenticate(req, res, next);
          
          // Should call next() for valid token
          expect(nextCalled).toBe(true);
          
          // Should set user on request
          expect(req.user).toBeDefined();
          expect(req.user.id).toBe(userId);
          expect(req.user.email).toBe(email);
          
          // Should not set error status
          expect(res.statusCode).toBeNull();
        }),
        { numRuns: 100 }
      );
    });

    it('should reject expired tokens', () => {
      fc.assert(
        fc.property(uuidArbitrary, emailArbitrary, (userId, email) => {
          // Create an expired token
          const expiredToken = jwt.sign(
            { userId, email },
            JWT_SECRET,
            { expiresIn: '-1s' } // Already expired
          );
          
          const { req, res } = createMockReqRes(`Bearer ${expiredToken}`);
          let nextCalled = false;
          const next = () => { nextCalled = true; };
          
          authenticate(req, res, next);
          
          expect(res.statusCode).toBe(401);
          expect(res.jsonData.message).toBe('Token expired');
          expect(nextCalled).toBe(false);
        }),
        { numRuns: 50 }
      );
    });
  });
});
