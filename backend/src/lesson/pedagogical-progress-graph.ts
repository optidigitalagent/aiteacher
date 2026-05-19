// ── Pedagogical Progress Graph ────────────────────────────────────────────────
// Lightweight session-scoped record of what the student did in this lesson.
// Stored in Redis (not Obsidian). Obsidian/docs are used only as doctrine
// and curriculum knowledge reference — never as runtime state.
//
// Purpose:
//   • Track completed/struggled/skipped items and exercises
//   • Record misconceptions for Teacher Brain memory
//   • Provide lesson-end summary
//   • Survive WS reconnects within the grace window
//
// Redis key: pedagogy:lesson:{lessonId}  TTL: 4 hours

import redis from '../db/redis.js'

const GRAPH_TTL = 14_400  // 4 hours — matches lesson/engine TTLs

// ── Types ─────────────────────────────────────────────────────────────────────

export type NodeKind   = 'exercise' | 'item' | 'concept'
export type NodeStatus = 'not_started' | 'active' | 'completed' | 'struggled' | 'skipped'
export type NodeOutcome = 'correct' | 'incorrect' | 'skipped' | null

export interface PedagogicalNode {
  nodeId:         string       // "{exerciseId}_item_{stepId}" or "{exerciseId}" or "{conceptKey}"
  kind:           NodeKind
  label:          string       // human-readable (question text or exercise title)
  status:         NodeStatus
  attempts:       number
  lastAnswer:     string
  lastOutcome:    NodeOutcome
  misconceptions: string[]     // recorded wrong answers worth noting
  completedAt:    string | null  // ISO timestamp
}

export interface PedagogicalProgressGraph {
  lessonId:   string
  sectionId:  string
  nodes:      PedagogicalNode[]
  updatedAt:  string
}

// ── Redis keys ────────────────────────────────────────────────────────────────

function graphKey(lessonId: string): string {
  return `pedagogy:lesson:${lessonId}`
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function getPedagogicalGraph(
  lessonId: string,
): Promise<PedagogicalProgressGraph | null> {
  try {
    const raw = await redis.get(graphKey(lessonId))
    if (!raw) return null
    return JSON.parse(raw) as PedagogicalProgressGraph
  } catch {
    return null
  }
}

export async function savePedagogicalGraph(
  lessonId: string,
  graph: PedagogicalProgressGraph,
): Promise<void> {
  try {
    graph.updatedAt = new Date().toISOString()
    await redis.set(graphKey(lessonId), JSON.stringify(graph), 'EX', GRAPH_TTL)
  } catch (err) {
    console.error(`[pedagogy_graph] save_failed lessonId=${lessonId}`, err)
  }
}

export function makeEmptyGraph(lessonId: string, sectionId: string): PedagogicalProgressGraph {
  return { lessonId, sectionId, nodes: [], updatedAt: new Date().toISOString() }
}

// ── Mutation helpers — all fail-soft ─────────────────────────────────────────

async function mutateGraph(
  lessonId:  string,
  sectionId: string,
  mutate:    (graph: PedagogicalProgressGraph) => void,
): Promise<void> {
  try {
    const graph = (await getPedagogicalGraph(lessonId)) ?? makeEmptyGraph(lessonId, sectionId)
    mutate(graph)
    await savePedagogicalGraph(lessonId, graph)
  } catch (err) {
    console.error(`[pedagogy_graph] mutation_failed lessonId=${lessonId}`, err)
  }
}

function findOrCreateNode(
  graph:   PedagogicalProgressGraph,
  nodeId:  string,
  kind:    NodeKind,
  label:   string,
): PedagogicalNode {
  let node = graph.nodes.find(n => n.nodeId === nodeId)
  if (!node) {
    node = {
      nodeId,
      kind,
      label,
      status:         'not_started',
      attempts:       0,
      lastAnswer:     '',
      lastOutcome:    null,
      misconceptions: [],
      completedAt:    null,
    }
    graph.nodes.push(node)
  }
  return node
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function recordNodeAttempt(
  lessonId:    string,
  sectionId:   string,
  nodeId:      string,
  kind:        NodeKind,
  label:       string,
  answer:      string,
  correct:     boolean,
): Promise<void> {
  await mutateGraph(lessonId, sectionId, (graph) => {
    const node = findOrCreateNode(graph, nodeId, kind, label)
    node.attempts++
    node.lastAnswer  = answer.slice(0, 200)
    node.lastOutcome = correct ? 'correct' : 'incorrect'
    node.status      = correct ? 'completed' : (node.attempts >= 3 ? 'struggled' : 'active')
    if (correct) {
      node.completedAt = new Date().toISOString()
    } else {
      // Record misconception for non-trivial wrong answers
      if (answer.trim().length > 0 && !node.misconceptions.includes(answer.slice(0, 100))) {
        node.misconceptions.push(answer.slice(0, 100))
      }
    }
    console.log(
      `[pedagogy_graph] node_attempt nodeId=${nodeId} kind=${kind} correct=${correct}` +
      ` attempts=${node.attempts} lessonId=${lessonId}`,
    )
  })
}

export async function recordNodeCompleted(
  lessonId:  string,
  sectionId: string,
  nodeId:    string,
  kind:      NodeKind,
  label:     string,
): Promise<void> {
  await mutateGraph(lessonId, sectionId, (graph) => {
    const node = findOrCreateNode(graph, nodeId, kind, label)
    node.status      = 'completed'
    node.completedAt = node.completedAt ?? new Date().toISOString()
    console.log(`[pedagogy_graph] node_completed nodeId=${nodeId} kind=${kind} lessonId=${lessonId}`)
  })
}

export async function recordNodeSkipped(
  lessonId:  string,
  sectionId: string,
  nodeId:    string,
  kind:      NodeKind,
  label:     string,
): Promise<void> {
  await mutateGraph(lessonId, sectionId, (graph) => {
    const node = findOrCreateNode(graph, nodeId, kind, label)
    node.status      = 'skipped'
    node.lastOutcome = 'skipped'
    node.completedAt = new Date().toISOString()
    console.log(`[pedagogy_graph] node_skipped nodeId=${nodeId} kind=${kind} lessonId=${lessonId}`)
  })
}

export async function recordMisconception(
  lessonId:       string,
  sectionId:      string,
  nodeId:         string,
  kind:           NodeKind,
  label:          string,
  misconception:  string,
): Promise<void> {
  await mutateGraph(lessonId, sectionId, (graph) => {
    const node = findOrCreateNode(graph, nodeId, kind, label)
    const trimmed = misconception.slice(0, 100)
    if (!node.misconceptions.includes(trimmed)) {
      node.misconceptions.push(trimmed)
      console.log(
        `[pedagogy_graph] misconception_recorded nodeId=${nodeId}` +
        ` misconception="${trimmed}" lessonId=${lessonId}`,
      )
    }
  })
}

export async function snapshotGraph(lessonId: string): Promise<PedagogicalProgressGraph | null> {
  const graph = await getPedagogicalGraph(lessonId)
  if (graph) {
    console.log(
      `[pedagogy_graph] snapshot_saved lessonId=${lessonId}` +
      ` nodes=${graph.nodes.length} updatedAt=${graph.updatedAt}`,
    )
  }
  return graph
}
