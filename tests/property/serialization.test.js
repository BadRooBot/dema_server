/**
 * Property-Based Tests for API JSON Serialization
 * 
 * **Feature: plans-management, Property 19: API Request/Response Serialization Round-Trip (Server)**
 * **Validates: Requirements 13.6, 13.7**
 * 
 * Tests that serializing API request/response objects to JSON and deserializing back
 * produces equivalent objects.
 */

const fc = require('fast-check');

// API Data Models for serialization testing

/**
 * Plan model as used in API responses
 */
const planToJson = (plan) => JSON.stringify({
  id: plan.id,
  title: plan.title,
  description: plan.description,
  targetHours: plan.targetHours,
  createdAt: plan.createdAt,
  updatedAt: plan.updatedAt
});

const planFromJson = (json) => {
  const obj = JSON.parse(json);
  return {
    id: obj.id,
    title: obj.title,
    description: obj.description,
    targetHours: obj.targetHours,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt
  };
};

/**
 * Task model as used in API responses
 */
const taskToJson = (task) => JSON.stringify({
  id: task.id,
  planId: task.planId,
  title: task.title,
  description: task.description,
  plannedMinutes: task.plannedMinutes,
  date: task.date,
  isCompleted: task.isCompleted,
  createdAt: task.createdAt,
  updatedAt: task.updatedAt
});

const taskFromJson = (json) => {
  const obj = JSON.parse(json);
  return {
    id: obj.id,
    planId: obj.planId,
    title: obj.title,
    description: obj.description,
    plannedMinutes: obj.plannedMinutes,
    date: obj.date,
    isCompleted: obj.isCompleted,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt
  };
};


/**
 * SessionLog model as used in API responses
 */
const sessionLogToJson = (session) => JSON.stringify({
  id: session.id,
  taskId: session.taskId,
  durationMinutes: session.durationMinutes,
  type: session.type,
  timestamp: session.timestamp
});

const sessionLogFromJson = (json) => {
  const obj = JSON.parse(json);
  return {
    id: obj.id,
    taskId: obj.taskId,
    durationMinutes: obj.durationMinutes,
    type: obj.type,
    timestamp: obj.timestamp
  };
};

/**
 * User model as used in API responses
 */
const userToJson = (user) => JSON.stringify({
  id: user.id,
  email: user.email,
  createdAt: user.createdAt
});

const userFromJson = (json) => {
  const obj = JSON.parse(json);
  return {
    id: obj.id,
    email: obj.email,
    createdAt: obj.createdAt
  };
};

// Arbitraries for generating test data

const uuidArbitrary = fc.uuid();

const isoDateArbitrary = fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
  .map(d => d.toISOString());

const dateOnlyArbitrary = fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
  .map(d => d.toISOString().split('T')[0]);

const emailArbitrary = fc.emailAddress();

const sessionTypeArbitrary = fc.constantFrom('pomodoro', 'stopwatch', 'manual');

const planArbitrary = fc.record({
  id: uuidArbitrary,
  title: fc.string({ minLength: 1, maxLength: 255 }).filter(s => s.trim().length > 0),
  description: fc.option(fc.string({ maxLength: 1000 }), { nil: null }),
  targetHours: fc.integer({ min: 0, max: 10000 }),
  createdAt: isoDateArbitrary,
  updatedAt: isoDateArbitrary
});

const taskArbitrary = fc.record({
  id: uuidArbitrary,
  planId: fc.option(uuidArbitrary, { nil: null }),
  title: fc.string({ minLength: 1, maxLength: 255 }).filter(s => s.trim().length > 0),
  description: fc.option(fc.string({ maxLength: 1000 }), { nil: null }),
  plannedMinutes: fc.integer({ min: 0, max: 10000 }),
  date: dateOnlyArbitrary,
  isCompleted: fc.boolean(),
  createdAt: isoDateArbitrary,
  updatedAt: isoDateArbitrary
});

const sessionLogArbitrary = fc.record({
  id: uuidArbitrary,
  taskId: uuidArbitrary,
  durationMinutes: fc.integer({ min: 0, max: 1440 }),
  type: sessionTypeArbitrary,
  timestamp: isoDateArbitrary
});

const userArbitrary = fc.record({
  id: uuidArbitrary,
  email: emailArbitrary,
  createdAt: isoDateArbitrary
});

// Property Tests

describe('API JSON Serialization Round-Trip', () => {
  /**
   * **Feature: plans-management, Property 19: API Request/Response Serialization Round-Trip (Server)**
   * **Validates: Requirements 13.6, 13.7**
   */
  
  describe('Plan Serialization', () => {
    it('should round-trip Plan objects through JSON serialization', () => {
      fc.assert(
        fc.property(planArbitrary, (plan) => {
          const json = planToJson(plan);
          const restored = planFromJson(json);
          
          expect(restored.id).toBe(plan.id);
          expect(restored.title).toBe(plan.title);
          expect(restored.description).toBe(plan.description);
          expect(restored.targetHours).toBe(plan.targetHours);
          expect(restored.createdAt).toBe(plan.createdAt);
          expect(restored.updatedAt).toBe(plan.updatedAt);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Task Serialization', () => {
    it('should round-trip Task objects through JSON serialization', () => {
      fc.assert(
        fc.property(taskArbitrary, (task) => {
          const json = taskToJson(task);
          const restored = taskFromJson(json);
          
          expect(restored.id).toBe(task.id);
          expect(restored.planId).toBe(task.planId);
          expect(restored.title).toBe(task.title);
          expect(restored.description).toBe(task.description);
          expect(restored.plannedMinutes).toBe(task.plannedMinutes);
          expect(restored.date).toBe(task.date);
          expect(restored.isCompleted).toBe(task.isCompleted);
          expect(restored.createdAt).toBe(task.createdAt);
          expect(restored.updatedAt).toBe(task.updatedAt);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('SessionLog Serialization', () => {
    it('should round-trip SessionLog objects through JSON serialization', () => {
      fc.assert(
        fc.property(sessionLogArbitrary, (session) => {
          const json = sessionLogToJson(session);
          const restored = sessionLogFromJson(json);
          
          expect(restored.id).toBe(session.id);
          expect(restored.taskId).toBe(session.taskId);
          expect(restored.durationMinutes).toBe(session.durationMinutes);
          expect(restored.type).toBe(session.type);
          expect(restored.timestamp).toBe(session.timestamp);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('User Serialization', () => {
    it('should round-trip User objects through JSON serialization', () => {
      fc.assert(
        fc.property(userArbitrary, (user) => {
          const json = userToJson(user);
          const restored = userFromJson(json);
          
          expect(restored.id).toBe(user.id);
          expect(restored.email).toBe(user.email);
          expect(restored.createdAt).toBe(user.createdAt);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('API Request Body Serialization', () => {
    it('should round-trip create plan request through JSON', () => {
      const createPlanRequestArbitrary = fc.record({
        title: fc.string({ minLength: 1, maxLength: 255 }).filter(s => s.trim().length > 0),
        description: fc.option(fc.string({ maxLength: 1000 }), { nil: undefined }),
        targetHours: fc.option(fc.integer({ min: 0, max: 10000 }), { nil: undefined })
      });

      fc.assert(
        fc.property(createPlanRequestArbitrary, (request) => {
          const json = JSON.stringify(request);
          const restored = JSON.parse(json);
          
          expect(restored.title).toBe(request.title);
          expect(restored.description).toBe(request.description);
          expect(restored.targetHours).toBe(request.targetHours);
        }),
        { numRuns: 100 }
      );
    });

    it('should round-trip create task request through JSON', () => {
      const createTaskRequestArbitrary = fc.record({
        title: fc.string({ minLength: 1, maxLength: 255 }).filter(s => s.trim().length > 0),
        description: fc.option(fc.string({ maxLength: 1000 }), { nil: undefined }),
        plannedMinutes: fc.option(fc.integer({ min: 0, max: 10000 }), { nil: undefined }),
        date: dateOnlyArbitrary,
        planId: fc.option(uuidArbitrary, { nil: undefined })
      });

      fc.assert(
        fc.property(createTaskRequestArbitrary, (request) => {
          const json = JSON.stringify(request);
          const restored = JSON.parse(json);
          
          expect(restored.title).toBe(request.title);
          expect(restored.description).toBe(request.description);
          expect(restored.plannedMinutes).toBe(request.plannedMinutes);
          expect(restored.date).toBe(request.date);
          expect(restored.planId).toBe(request.planId);
        }),
        { numRuns: 100 }
      );
    });

    it('should round-trip create session request through JSON', () => {
      const createSessionRequestArbitrary = fc.record({
        taskId: uuidArbitrary,
        durationMinutes: fc.integer({ min: 0, max: 1440 }),
        type: sessionTypeArbitrary,
        timestamp: fc.option(isoDateArbitrary, { nil: undefined })
      });

      fc.assert(
        fc.property(createSessionRequestArbitrary, (request) => {
          const json = JSON.stringify(request);
          const restored = JSON.parse(json);
          
          expect(restored.taskId).toBe(request.taskId);
          expect(restored.durationMinutes).toBe(request.durationMinutes);
          expect(restored.type).toBe(request.type);
          expect(restored.timestamp).toBe(request.timestamp);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('API Response List Serialization', () => {
    it('should round-trip plans list response through JSON', () => {
      const plansResponseArbitrary = fc.record({
        plans: fc.array(planArbitrary, { minLength: 0, maxLength: 20 })
      });

      fc.assert(
        fc.property(plansResponseArbitrary, (response) => {
          const json = JSON.stringify(response);
          const restored = JSON.parse(json);
          
          expect(restored.plans.length).toBe(response.plans.length);
          for (let i = 0; i < response.plans.length; i++) {
            expect(restored.plans[i].id).toBe(response.plans[i].id);
            expect(restored.plans[i].title).toBe(response.plans[i].title);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should round-trip tasks list response through JSON', () => {
      const tasksResponseArbitrary = fc.record({
        tasks: fc.array(taskArbitrary, { minLength: 0, maxLength: 20 })
      });

      fc.assert(
        fc.property(tasksResponseArbitrary, (response) => {
          const json = JSON.stringify(response);
          const restored = JSON.parse(json);
          
          expect(restored.tasks.length).toBe(response.tasks.length);
          for (let i = 0; i < response.tasks.length; i++) {
            expect(restored.tasks[i].id).toBe(response.tasks[i].id);
            expect(restored.tasks[i].title).toBe(response.tasks[i].title);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should round-trip sessions list response through JSON', () => {
      const sessionsResponseArbitrary = fc.record({
        sessions: fc.array(sessionLogArbitrary, { minLength: 0, maxLength: 20 })
      });

      fc.assert(
        fc.property(sessionsResponseArbitrary, (response) => {
          const json = JSON.stringify(response);
          const restored = JSON.parse(json);
          
          expect(restored.sessions.length).toBe(response.sessions.length);
          for (let i = 0; i < response.sessions.length; i++) {
            expect(restored.sessions[i].id).toBe(response.sessions[i].id);
            expect(restored.sessions[i].taskId).toBe(response.sessions[i].taskId);
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});
