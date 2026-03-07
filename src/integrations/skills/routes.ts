import type { FastifyPluginAsync } from 'fastify';
import { SKILL_CATALOG, type SkillDef } from './catalog.js';
import { streamAgentQuery } from './sse.js';
import { SkillRunSchema, type SkillRunBody } from './schemas.js';
import { apiKeyPreHandler } from '../../shared/lib/api-utils.js';

// Prevent concurrent resume of the same session.
// NOTE: This is process-local. In a multi-process deployment (pm2 cluster,
// multiple containers), use a distributed lock (e.g. Redis SETNX) instead.
const inFlightSessions = new Set<string>();

const skillsRoute: FastifyPluginAsync = async (fastify) => {
  // Validate auth at startup
  if (!process.env.CLAUDE_CODE_OAUTH_TOKEN && !process.env.ANTHROPIC_API_KEY) {
    fastify.log.warn('No Claude auth configured — /skills routes disabled');
    return;
  }

  // Minimal env for the agent subprocess (don't leak all server env vars)
  const agentEnv: Record<string, string> = {
    ...(process.env.CLAUDE_CODE_OAUTH_TOKEN
      ? { CLAUDE_CODE_OAUTH_TOKEN: process.env.CLAUDE_CODE_OAUTH_TOKEN }
      : {}),
    ...(process.env.ANTHROPIC_API_KEY
      ? { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY }
      : {}),
    PATH: process.env.PATH ?? '',
    HOME: process.env.HOME ?? '',
  };

  // GET /skills — list all available skills (auth-gated via x-api-key)
  fastify.get('/skills', {
    preHandler: [apiKeyPreHandler],
  }, async () =>
    Object.entries(SKILL_CATALOG).map(([path, def]) => ({
      path: `/skills/${path}`,
      command: def.command,
      category: def.category,
      description: def.description,
    }))
  );

  // Register a POST route for each skill in the catalog
  for (const [path, def] of Object.entries(SKILL_CATALOG) as [string, SkillDef][]) {
    fastify.post<{ Body: SkillRunBody }>(`/skills/${path}`, {
      schema: { body: SkillRunSchema },
      preHandler: [apiKeyPreHandler],
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    }, async (req, reply) => {
      // Prevent concurrent resume of same session
      if (req.body.sessionId) {
        if (inFlightSessions.has(req.body.sessionId)) {
          return reply.status(409).send({ error: 'Session already in use' });
        }
        inFlightSessions.add(req.body.sessionId);
      }

      const controller = new AbortController();
      req.raw.on('close', () => controller.abort());

      try {
        // The user prompt is appended after the skill command. The agent is
        // sandboxed via read-only allowedTools + dontAsk permissionMode, so
        // prompt injection cannot escalate beyond the allowed tool surface.
        await streamAgentQuery(reply, controller, {
          prompt: req.body.prompt
            ? `/${def.command} ${req.body.prompt}`
            : `/${def.command}`,
          options: {
            cwd: process.cwd(),
            abortController: controller,
            systemPrompt: 'claude_code',
            allowedTools: def.allowedTools
              ? [...def.allowedTools]
              : ['Skill', 'Read', 'Glob', 'Grep'],
            env: agentEnv,
            permissionMode: 'dontAsk',
            includePartialMessages: req.body.stream ?? false,
            resume: req.body.sessionId,
            maxTurns: req.body.maxTurns ?? 20,
            maxBudgetUsd: req.body.maxBudgetUsd,
          },
        });
      } finally {
        if (req.body.sessionId) {
          inFlightSessions.delete(req.body.sessionId);
        }
      }
    });
  }
};

export default skillsRoute;
