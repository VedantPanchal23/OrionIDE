/**
 * Orion IDE — Agent Service Tests (Complete Pipeline)
 */

const request = require('supertest');

// Mock Redis
jest.mock('../src/services/redisClient', () => {
  const store = new Map();
  return {
    getRedisClient: jest.fn(() => Promise.resolve({
      get: jest.fn((key) => Promise.resolve(store.get(key) || null)),
      set: jest.fn((key, value) => { store.set(key, value); return Promise.resolve('OK'); }),
      del: jest.fn((key) => { store.delete(key); return Promise.resolve(1); }),
      isOpen: true,
    })),
    closeRedisClient: jest.fn(),
    _store: store,
  };
});

// Mock groqService
const mockGroqChat = jest.fn();
jest.mock('../src/services/groqService', () => ({
  createClient: jest.fn(),
  chat: mockGroqChat,
}));

// Mock openRouterService
const mockORChat = jest.fn();
jest.mock('../src/services/openRouterService', () => ({
  chat: mockORChat,
}));

// Mock axios
jest.mock('axios', () => ({
  post: jest.fn(() => Promise.resolve({ data: { data: { id: 'drive-file-1' } } })),
  get: jest.fn(() => Promise.resolve({ data: { data: { exitCode: 0, stdout: 'Hello' } } })),
}));

process.env.NODE_ENV = 'test';
process.env.GROQ_API_KEY = 'test-key';
process.env.OPENROUTER_API_KEY = 'test-key';

const BaseAgent = require('../src/agents/baseAgent');
const PlannerAgent = require('../src/agents/plannerAgent');
const DesignerAgent = require('../src/agents/designerAgent');
const ImplementerAgent = require('../src/agents/implementerAgent');
const ReviewerAgent = require('../src/agents/reviewerAgent');
const FileAgent = require('../src/agents/fileAgent');
const RunAgent = require('../src/agents/runAgent');
const app = require('../src/app');
const { _store } = require('../src/services/redisClient');

// ── BaseAgent ──────────────────────────────────────────────────────────

describe('BaseAgent', () => {
  test('cannot be instantiated directly', () => {
    expect(() => new BaseAgent('test', 'model')).toThrow('BaseAgent is abstract');
  });

  test('parseJsonOutput extracts valid JSON', () => {
    class TestAgent extends BaseAgent {
      constructor() { super('Test', 'model'); }
      getSystemPrompt() { return ''; }
      async run() {}
    }
    expect(new TestAgent().parseJsonOutput('{"key":"val"}')).toEqual({ key: 'val' });
  });

  test('parseJsonOutput handles markdown fences', () => {
    class TestAgent extends BaseAgent {
      constructor() { super('Test', 'model'); }
      getSystemPrompt() { return ''; }
      async run() {}
    }
    expect(new TestAgent().parseJsonOutput('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  test('parseJsonOutput throws on empty', () => {
    class TestAgent extends BaseAgent {
      constructor() { super('Test', 'model'); }
      getSystemPrompt() { return ''; }
      async run() {}
    }
    expect(() => new TestAgent().parseJsonOutput('')).toThrow('Empty');
  });
});

// ── PlannerAgent ───────────────────────────────────────────────────────

describe('PlannerAgent', () => {
  const validPlan = {
    projectName: 'Calculator', description: 'calc', techStack: ['Python'],
    fileStructure: [{ path: 'main.py', purpose: 'entry' }],
    buildOrder: ['main.py'], estimatedFiles: 1,
  };

  test('validates valid output', () => {
    expect(new PlannerAgent().validateOutput(validPlan).projectName).toBe('Calculator');
  });

  test('rejects missing fields', () => {
    expect(() => new PlannerAgent().validateOutput({})).toThrow('missing');
  });

  test('run calls Groq and returns plan', async () => {
    mockGroqChat.mockResolvedValue(JSON.stringify(validPlan));
    const result = await new PlannerAgent().run('Build calc', 's1');
    expect(result.projectName).toBe('Calculator');
  });
});

// ── DesignerAgent ──────────────────────────────────────────────────────

describe('DesignerAgent', () => {
  const validDesign = {
    folders: [{ path: 'src/', purpose: 'Source' }],
    files: [{ path: 'src/main.py', purpose: 'Entry', language: 'Python', exports: [], imports: [], dependsOn: [] }],
    implementationOrder: ['src/main.py'],
  };

  test('validates valid output', () => {
    expect(new DesignerAgent().validateOutput(validDesign).files.length).toBe(1);
  });

  test('rejects implementationOrder missing files', () => {
    expect(() => new DesignerAgent().validateOutput({ ...validDesign, implementationOrder: [] })).toThrow('missing file');
  });

  test('run calls Groq with planner output', async () => {
    mockGroqChat.mockResolvedValue(JSON.stringify(validDesign));
    const result = await new DesignerAgent().run({ projectName: 'Test' }, 's2');
    expect(result.implementationOrder).toContain('src/main.py');
  });
});

// ── ImplementerAgent ───────────────────────────────────────────────────

describe('ImplementerAgent', () => {
  const impl = new ImplementerAgent();

  test('cleanCode removes markdown fences', () => {
    expect(impl.cleanCode('```python\nprint("hi")\n```')).toBe('print("hi")');
  });

  test('cleanCode passes through plain code', () => {
    expect(impl.cleanCode('print("hi")')).toBe('print("hi")');
  });

  test('runFile calls OpenRouter and returns code', async () => {
    mockORChat.mockResolvedValue('def add(a, b):\n    return a + b');
    const designerOutput = {
      projectName: 'Calc',
      files: [{ path: 'calc.py', purpose: 'Math functions', language: 'Python', exports: ['add'], imports: [], dependsOn: [] }],
    };
    const result = await impl.runFile(designerOutput, 0, [], 's3');
    expect(result.filePath).toBe('calc.py');
    expect(result.code).toContain('def add');
  });

  test('runFile throws for out-of-range index', async () => {
    await expect(impl.runFile({ files: [] }, 0, [], 's3')).rejects.toThrow('out of range');
  });
});

// ── ReviewerAgent ──────────────────────────────────────────────────────

describe('ReviewerAgent', () => {
  const rev = new ReviewerAgent();

  const validReview = {
    approved: true, score: 8,
    issues: [{ severity: 'suggestion', description: 'Add docstrings', line: 1 }],
    summary: 'Good code',
  };

  test('validates valid review output', () => {
    expect(rev.validateOutput(validReview).approved).toBe(true);
  });

  test('rejects invalid score', () => {
    expect(() => rev.validateOutput({ ...validReview, score: 15 })).toThrow('1-10');
  });

  test('review calls Groq and returns validated review', async () => {
    mockGroqChat.mockResolvedValue(JSON.stringify(validReview));
    const result = await rev.review('main.py', 'print("hi")', 'Python', 'Entry', 's4');
    expect(result.approved).toBe(true);
    expect(result.score).toBe(8);
  });

  test('review with rejected output', async () => {
    const rejected = { approved: false, score: 4, issues: [{ severity: 'critical', description: 'Missing error handling', line: null }], summary: 'Needs work' };
    mockGroqChat.mockResolvedValue(JSON.stringify(rejected));
    const result = await rev.review('main.py', 'x=1', 'Python', 'Entry', 's5');
    expect(result.approved).toBe(false);
    expect(result.score).toBe(4);
  });
});

// ── FileAgent ──────────────────────────────────────────────────────────

describe('FileAgent', () => {
  test('writeFile calls drive-service', async () => {
    const fa = new FileAgent();
    const result = await fa.writeFile('user-1', 'src/main.py', 'print("hi")', 's6', 'folder-1');
    expect(result.success).toBe(true);
    expect(result.filePath).toBe('src/main.py');
  });

  test('run() throws not implemented', async () => {
    await expect(new FileAgent().run()).rejects.toThrow('writeFile');
  });
});

// ── RunAgent ───────────────────────────────────────────────────────────

describe('RunAgent', () => {
  const validRunConfig = {
    mainFile: 'main.py', pistonLanguage: 'python',
    pistonVersion: '*', runCommand: 'python main.py',
    explanation: 'Run the main entry point',
  };

  test('validates valid run config', () => {
    expect(new RunAgent().validateOutput(validRunConfig).mainFile).toBe('main.py');
  });

  test('determineCommand calls Groq', async () => {
    mockGroqChat.mockResolvedValue(JSON.stringify(validRunConfig));
    const result = await new RunAgent().determineCommand('Build calc', { implementationOrder: ['main.py'] }, [{ path: 'main.py', code: '' }], 's7');
    expect(result.pistonLanguage).toBe('python');
  });
});

// ── Routes ─────────────────────────────────────────────────────────────

describe('Agent Routes', () => {
  beforeEach(() => { jest.clearAllMocks(); _store.clear(); });

  test('POST /agents/pipeline/start creates session', async () => {
    mockGroqChat.mockResolvedValue(JSON.stringify({
      projectName: 'Calc', description: 'calc', techStack: ['Python'],
      fileStructure: [{ path: 'main.py', purpose: 'entry' }],
      buildOrder: ['main.py'], estimatedFiles: 1,
    }));

    const res = await request(app)
      .post('/agents/pipeline/start')
      .set('X-User-Id', 'user-1')
      .send({ goal: 'Build a Python calculator' })
      .expect(201);

    expect(res.body.data.sessionId).toBeDefined();
    expect(res.body.data.session.currentStep).toBe(1);
  });

  test('POST /agents/pipeline/start requires goal', async () => {
    await request(app).post('/agents/pipeline/start').send({}).expect(400);
  });

  test('GET /agents/pipeline/:id returns 404', async () => {
    await request(app).get('/agents/pipeline/unknown').expect(404);
  });

  test('GET /health returns ok', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body.service).toBe('agent-service');
  });
});
