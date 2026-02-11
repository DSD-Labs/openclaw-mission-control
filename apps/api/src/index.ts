import Fastify from 'fastify';
import cors from 'fastify-cors';
import { z } from 'zod';
import { env } from './env.js';
import { prisma } from './db.js';

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
});

app.get('/health', async () => ({ ok: true }));

// --- Agents ---
app.get('/api/agents', async () => prisma.agent.findMany({ orderBy: { updatedAt: 'desc' } }));

app.post('/api/agents', async (req) => {
  const Body = z.object({
    name: z.string().min(1),
    role: z.string().min(1),
    soulMd: z.string().default(''),
    model: z.string().optional(),
    enabled: z.boolean().default(true),
    skillsAllow: z.any().default([])
  });
  const body = Body.parse(req.body);
  return prisma.agent.create({ data: body });
});

// --- Tasks (Kanban) ---
app.get('/api/tasks', async () => prisma.task.findMany({ orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }] }));

app.post('/api/tasks', async (req) => {
  const Body = z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    status: z.enum(['BACKLOG','READY','DOING','BLOCKED','REVIEW','DONE']).default('BACKLOG'),
    priority: z.number().int().default(0),
    ownerAgentId: z.string().optional()
  });
  const body = Body.parse(req.body);
  return prisma.task.create({ data: body });
});

app.patch('/api/tasks/:id', async (req) => {
  const Params = z.object({ id: z.string().min(1) });
  const Body = z.object({
    title: z.string().min(1).optional(),
    description: z.string().optional().nullable(),
    status: z.enum(['BACKLOG','READY','DOING','BLOCKED','REVIEW','DONE']).optional(),
    priority: z.number().int().optional(),
    ownerAgentId: z.string().optional().nullable()
  });
  const { id } = Params.parse(req.params);
  const patch = Body.parse(req.body);
  return prisma.task.update({ where: { id }, data: patch });
});

// --- Conversations + Turns ---
app.post('/api/conversations', async (req) => {
  const Body = z.object({
    type: z.enum(['TASK','WAR_ROOM']),
    taskId: z.string().optional()
  });
  const body = Body.parse(req.body);
  return prisma.conversation.create({ data: body });
});

app.get('/api/conversations/:id', async (req) => {
  const Params = z.object({ id: z.string().min(1) });
  const { id } = Params.parse(req.params);
  return prisma.conversation.findUnique({
    where: { id },
    include: { turns: { orderBy: { createdAt: 'asc' } } }
  });
});

app.post('/api/conversations/:id/turns', async (req) => {
  const Params = z.object({ id: z.string().min(1) });
  const Body = z.object({
    speakerType: z.string().min(1),
    speakerId: z.string().optional(),
    content: z.string().min(1),
    toolEvents: z.any().optional()
  });
  const { id } = Params.parse(req.params);
  const body = Body.parse(req.body);
  return prisma.turn.create({ data: { ...body, conversationId: id } });
});

// --- War Room (stub) ---
app.post('/api/war-room/run', async () => {
  // v0: just create a conversation + placeholder turn.
  // Next: orchestrator calls OpenClaw gateway and logs turns + posts telegram final answer.
  const convo = await prisma.conversation.create({ data: { type: 'WAR_ROOM' } });
  await prisma.turn.create({
    data: {
      conversationId: convo.id,
      speakerType: 'system',
      content: 'War room run stub created. Next: wire OpenClaw adapter + Telegram posting.'
    }
  });
  return { ok: true, conversationId: convo.id };
});

app.listen({ port: env.PORT, host: '0.0.0.0' });
