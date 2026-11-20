// ============================================================
// URBANA - Smart City Management System (Rajshahi city areas)
// Exact TypeScript engine mirroring Team AetherCore's C++ system
// ============================================================

export const MAX_RECORDS = 500;
export const MAX_AREAS = 8;
export const HASH_SIZE = 211;
export const QUEUE_CAPACITY = 50;
export const UNDO_CAPACITY = 100;
export const TRIE_NODES = 200;

export const CITY_FILE = 'citypulse_reports.txt';
export const WASTE_FILE = 'wastex_records.txt';
export const ROAD_FILE = 'urbana_roads.txt';

export const AREAS = [
  'Shaheb Bazar',
  'Zero Point',
  'Rail Gate',
  'Laxmipur',
  'Court',
  'Kazla',
  'Talaimari',
  'Vodra',
] as const;

export type AreaName = (typeof AREAS)[number];

export const CITY_CATEGORIES = [
  'Traffic',
  'Road Damage',
  'Waterlogging',
  'Pollution',
  'Street Light',
  'Other',
] as const;

export type CityCategory = (typeof CITY_CATEGORIES)[number];

export const WASTE_TYPES = [
  'Household',
  'Plastic',
  'Organic',
  'Construction',
  'Mixed',
] as const;

export type WasteType = (typeof WASTE_TYPES)[number];

export type PriorityLevel = 1 | 2 | 3 | 4;

export function priorityText(p: number): 'Low' | 'Medium' | 'High' | 'Critical' {
  if (p === 1) return 'Low';
  if (p === 2) return 'Medium';
  if (p === 3) return 'High';
  return 'Critical';
}

export function statusText(done: boolean): 'Completed' | 'Pending' {
  return done ? 'Completed' : 'Pending';
}

export function areaIndex(name: string): number {
  return AREAS.findIndex((a) => a === name);
}

// Mirrors readText(): replaces '|' with '/' since '|' is the file separator
export function sanitizePipeText(value: string): string {
  return value.replace(/\|/g, '/').trim();
}

export function splitFields(line: string, maxFields: number): string[] {
  const fields: string[] = [];
  let start = 0;
  while (fields.length < maxFields) {
    const p = line.indexOf('|', start);
    if (p === -1) {
      fields.push(line.slice(start));
      break;
    }
    fields.push(line.slice(start, p));
    start = p + 1;
  }
  return fields;
}

// ============================================================
// RECORDS
// ============================================================

export interface CityReport {
  id: number;
  area: AreaName;
  category: CityCategory;
  description: string;
  priority: PriorityLevel;
  resolved: boolean;
  submittedBy?: string;
  ownerEmail?: string;
  createdAt?: string;
}

export interface WasteRecord {
  id: number;
  area: AreaName;
  wasteType: WasteType;
  notes: string;
  amountKg: number;
  urgency: PriorityLevel;
  collected: boolean;
  submittedBy?: string;
  ownerEmail?: string;
  createdAt?: string;
}

// ============================================================
// MODULE 0: GENERIC NODE + HASH INDEX + LINKED LIST
// ============================================================

export interface ListNode<T extends { id: number }> {
  data: T;
  next: ListNode<T> | null;
}

export interface HashBucketInfo<T extends { id: number }> {
  slot: number;
  ids: number[];
  items: T[];
}

export interface HashLookupTrace<T extends { id: number }> {
  id: number;
  slot: number;
  found: boolean;
  steps: number;
  chainIds: number[];
  record: T | null;
}

export class IdIndex<T extends { id: number }> {
  private table: Array<Array<ListNode<T>>>;

  constructor() {
    this.table = Array.from({ length: HASH_SIZE }, () => []);
  }

  static slot(id: number): number {
    return ((id % HASH_SIZE) + HASH_SIZE) % HASH_SIZE;
  }

  clear(): void {
    for (let i = 0; i < HASH_SIZE; i++) {
      this.table[i] = [];
    }
  }

  put(id: number, node: ListNode<T>): void {
    const s = IdIndex.slot(id);
    // Separate chaining head-prepend matching C++ Entry* insertion
    this.table[s].unshift(node);
  }

  get(id: number): ListNode<T> | null {
    const s = IdIndex.slot(id);
    for (const node of this.table[s]) {
      if (node.data.id === id) return node;
    }
    return null;
  }

  traceLookup(id: number): HashLookupTrace<T> {
    const s = IdIndex.slot(id);
    const chain = this.table[s];
    const chainIds = chain.map((n) => n.data.id);
    let steps = 0;
    for (const node of chain) {
      steps++;
      if (node.data.id === id) {
        return {
          id,
          slot: s,
          found: true,
          steps,
          chainIds,
          record: { ...node.data },
        };
      }
    }
    return {
      id,
      slot: s,
      found: false,
      steps: steps === 0 ? 1 : steps,
      chainIds,
      record: null,
    };
  }

  erase(id: number): void {
    const s = IdIndex.slot(id);
    const idx = this.table[s].findIndex((n) => n.data.id === id);
    if (idx !== -1) {
      this.table[s].splice(idx, 1);
    }
  }

  getActiveBuckets(): HashBucketInfo<T>[] {
    const active: HashBucketInfo<T>[] = [];
    for (let i = 0; i < HASH_SIZE; i++) {
      if (this.table[i].length > 0) {
        active.push({
          slot: i,
          ids: this.table[i].map((n) => n.data.id),
          items: this.table[i].map((n) => ({ ...n.data })),
        });
      }
    }
    return active;
  }
}

export class RecordList<T extends { id: number }> {
  private head: ListNode<T> | null = null;
  private tail: ListNode<T> | null = null;
  private count = 0;
  private index = new IdIndex<T>();

  size(): number {
    return this.count;
  }

  full(): boolean {
    return this.count >= MAX_RECORDS;
  }

  getHead(): ListNode<T> | null {
    return this.head;
  }

  getTail(): ListNode<T> | null {
    return this.tail;
  }

  find(id: number): ListNode<T> | null {
    return this.index.get(id);
  }

  traceFind(id: number): HashLookupTrace<T> {
    return this.index.traceLookup(id);
  }

  getActiveBuckets(): HashBucketInfo<T>[] {
    return this.index.getActiveBuckets();
  }

  insert(record: T): boolean {
    if (this.full() || this.find(record.id)) return false;
    const node: ListNode<T> = { data: { ...record }, next: null };
    if (!this.tail) {
      this.head = this.tail = node;
    } else {
      this.tail.next = node;
      this.tail = node;
    }
    this.index.put(record.id, node);
    this.count++;
    return true;
  }

  remove(id: number): boolean {
    let prev: ListNode<T> | null = null;
    let cur = this.head;
    while (cur && cur.data.id !== id) {
      prev = cur;
      cur = cur.next;
    }
    if (!cur) return false;
    if (prev) prev.next = cur.next;
    else this.head = cur.next;
    if (cur === this.tail) this.tail = prev;
    this.index.erase(id);
    this.count--;
    return true;
  }

  clear(): void {
    this.head = null;
    this.tail = null;
    this.count = 0;
    this.index.clear();
  }

  toArray(): T[] {
    const out: T[] = [];
    let cur = this.head;
    while (cur) {
      out.push({ ...cur.data });
      cur = cur.next;
    }
    return out;
  }
}

// ============================================================
// MODULE 1: UNDO STACK (array based, capacity 100)
// ============================================================

export type ActionType = 'ACT_ADD' | 'ACT_MODIFY' | 'ACT_DELETE';

export interface UndoAction {
  type: ActionType;
  before: CityReport;
  timestamp: string;
}

export class UndoStack {
  private items: UndoAction[] = [];

  empty(): boolean {
    return this.items.length === 0;
  }

  size(): number {
    return this.items.length;
  }

  push(action: UndoAction): void {
    if (this.items.length >= UNDO_CAPACITY) {
      this.items.shift(); // drops oldest on overflow
    }
    this.items.push({
      type: action.type,
      before: { ...action.before },
      timestamp: action.timestamp,
    });
  }

  pop(): UndoAction | null {
    if (this.items.length === 0) return null;
    return this.items.pop() ?? null;
  }

  getItems(): UndoAction[] {
    return this.items.map((a) => ({ ...a, before: { ...a.before } }));
  }

  clear(): void {
    this.items = [];
  }
}

// ============================================================
// MODULE 2: COMPLAINT QUEUE (circular array, FIFO, capacity 50)
// ============================================================

export interface QueueSnapshot {
  slots: Array<number | null>;
  front: number;
  rear: number;
  count: number;
  capacity: number;
  orderedIds: number[];
}

export class ComplaintQueue {
  private items: Array<number | null> = Array(QUEUE_CAPACITY).fill(null);
  private front = 0;
  private rear = 0;
  private count = 0;

  size(): number {
    return this.count;
  }

  full(): boolean {
    return this.count === QUEUE_CAPACITY;
  }

  empty(): boolean {
    return this.count === 0;
  }

  contains(id: number): boolean {
    for (let i = 0; i < this.count; i++) {
      const idx = (this.front + i) % QUEUE_CAPACITY;
      if (this.items[idx] === id) return true;
    }
    return false;
  }

  enqueue(id: number): boolean {
    if (this.full()) return false;
    this.items[this.rear] = id;
    this.rear = (this.rear + 1) % QUEUE_CAPACITY;
    this.count++;
    return true;
  }

  dequeue(): number | null {
    if (this.empty()) return null;
    const id = this.items[this.front];
    this.items[this.front] = null;
    this.front = (this.front + 1) % QUEUE_CAPACITY;
    this.count--;
    return id;
  }

  clear(): void {
    this.items = Array(QUEUE_CAPACITY).fill(null);
    this.front = 0;
    this.rear = 0;
    this.count = 0;
  }

  getSnapshot(): QueueSnapshot {
    const orderedIds: number[] = [];
    for (let i = 0; i < this.count; i++) {
      const idx = (this.front + i) % QUEUE_CAPACITY;
      const val = this.items[idx];
      if (val !== null) orderedIds.push(val);
    }
    return {
      slots: [...this.items],
      front: this.front,
      rear: this.rear,
      count: this.count,
      capacity: QUEUE_CAPACITY,
      orderedIds,
    };
  }
}

// ============================================================
// MODULE 3: AREA TRIE (prefix search over 8 Rajshahi areas)
// ============================================================

export interface TrieNodeInfo {
  id: number;
  char: string;
  areaIndex: number;
  children: Record<string, number>;
}

export interface TrieSearchResult {
  prefix: string;
  normalizedPrefix: string;
  matches: AreaName[];
  traversedNodeIds: number[];
  terminalNodeId: number | null;
  foundPrefix: boolean;
}

export class AreaTrie {
  private nodes: TrieNodeInfo[] = [];

  constructor() {
    this.newNode('');
    for (let i = 0; i < MAX_AREAS; i++) {
      this.insert(AREAS[i], i);
    }
  }

  private newNode(char: string): number {
    const id = this.nodes.length;
    this.nodes.push({ id, char, areaIndex: -1, children: {} });
    return id;
  }

  insert(name: string, idx: number): void {
    let cur = 0;
    for (let i = 0; i < name.length; i++) {
      const ch = name[i].toLowerCase();
      if (ch < 'a' || ch > 'z') continue;
      if (this.nodes[cur].children[ch] === undefined) {
        this.nodes[cur].children[ch] = this.newNode(ch);
      }
      cur = this.nodes[cur].children[ch];
    }
    this.nodes[cur].areaIndex = idx;
  }

  private collect(nodeId: number, res: number[]): void {
    const node = this.nodes[nodeId];
    if (node.areaIndex >= 0) res.push(node.areaIndex);
    const keys = Object.keys(node.children).sort();
    for (const k of keys) {
      this.collect(node.children[k], res);
    }
  }

  complete(prefix: string): TrieSearchResult {
    let cur = 0;
    const traversedNodeIds = [0];
    let normalizedPrefix = '';

    for (let i = 0; i < prefix.length; i++) {
      const ch = prefix[i].toLowerCase();
      if (ch < 'a' || ch > 'z') continue;
      normalizedPrefix += ch;
      const nextId = this.nodes[cur].children[ch];
      if (nextId === undefined) {
        return {
          prefix,
          normalizedPrefix,
          matches: [],
          traversedNodeIds,
          terminalNodeId: null,
          foundPrefix: false,
        };
      }
      cur = nextId;
      traversedNodeIds.push(cur);
    }

    const res: number[] = [];
    this.collect(cur, res);
    return {
      prefix,
      normalizedPrefix,
      matches: res.map((idx) => AREAS[idx]),
      traversedNodeIds,
      terminalNodeId: cur,
      foundPrefix: true,
    };
  }

  getNodes(): TrieNodeInfo[] {
    return this.nodes;
  }
}

// ============================================================
// MODULE 4: WASTE MAX HEAP (1-based indexing)
// Priority: urgency -> amountKg -> smaller ID
// ============================================================

export class WasteMaxHeap {
  private heap: Array<WasteRecord | null> = [null];
  private n = 0;

  private static higher(a: WasteRecord, b: WasteRecord): boolean {
    if (a.urgency !== b.urgency) return a.urgency > b.urgency;
    if (a.amountKg !== b.amountKg) return a.amountKg > b.amountKg;
    return a.id < b.id;
  }

  private swapAt(i: number, j: number): void {
    const t = this.heap[i];
    this.heap[i] = this.heap[j];
    this.heap[j] = t;
  }

  private siftUp(i: number): void {
    while (i > 1) {
      const parent = Math.floor(i / 2);
      const curNode = this.heap[i];
      const parNode = this.heap[parent];
      if (!curNode || !parNode || !WasteMaxHeap.higher(curNode, parNode)) break;
      this.swapAt(i, parent);
      i = parent;
    }
  }

  private siftDown(i: number): void {
    while (true) {
      const l = 2 * i;
      const r = l + 1;
      let best = i;
      if (l <= this.n && this.heap[l] && this.heap[best] && WasteMaxHeap.higher(this.heap[l]!, this.heap[best]!)) {
        best = l;
      }
      if (r <= this.n && this.heap[r] && this.heap[best] && WasteMaxHeap.higher(this.heap[r]!, this.heap[best]!)) {
        best = r;
      }
      if (best === i) break;
      this.swapAt(i, best);
      i = best;
    }
  }

  size(): number {
    return this.n;
  }

  insert(record: WasteRecord): boolean {
    if (this.n >= MAX_RECORDS) return false;
    this.heap[++this.n] = { ...record };
    this.siftUp(this.n);
    return true;
  }

  find(id: number): number {
    for (let i = 1; i <= this.n; i++) {
      if (this.heap[i]?.id === id) return i;
    }
    return 0;
  }

  extractMax(): WasteRecord | null {
    if (this.n === 0) return null;
    const out = this.heap[1] ? { ...this.heap[1]! } : null;
    this.heap[1] = this.heap[this.n];
    this.heap.pop();
    this.n--;
    if (this.n > 0) this.siftDown(1);
    return out;
  }

  updateUrgency(id: number, urgency: PriorityLevel): boolean {
    const i = this.find(id);
    if (!i || !this.heap[i]) return false;
    const old = this.heap[i]!.urgency;
    this.heap[i]!.urgency = urgency;
    if (urgency > old) this.siftUp(i);
    else this.siftDown(i);
    return true;
  }

  deleteById(id: number): boolean {
    const i = this.find(id);
    if (!i) return false;
    this.heap[i] = this.heap[this.n];
    this.heap.pop();
    this.n--;
    if (i <= this.n) {
      this.siftUp(i);
      this.siftDown(i);
    }
    return true;
  }

  // Returns 1-based array slice [1..n] for visualization
  getHeapNodes(): WasteRecord[] {
    const nodes: WasteRecord[] = [];
    for (let i = 1; i <= this.n; i++) {
      if (this.heap[i]) nodes.push({ ...this.heap[i]! });
    }
    return nodes;
  }

  // Non-destructive extraction order matching C++ showOrder(WasteMaxHeap h)
  getOrderedList(): WasteRecord[] {
    const copy = this.clone();
    const result: WasteRecord[] = [];
    while (copy.size() > 0) {
      const next = copy.extractMax();
      if (next) result.push(next);
    }
    return result;
  }

  clone(): WasteMaxHeap {
    const copy = new WasteMaxHeap();
    copy.n = this.n;
    copy.heap = this.heap.map((item) => (item ? { ...item } : null));
    return copy;
  }
}

export function buildScheduler(wasteRecords: WasteRecord[]): WasteMaxHeap {
  const h = new WasteMaxHeap();
  for (const r of wasteRecords) {
    if (!r.collected) h.insert(r);
  }
  return h;
}

// ============================================================
// MODULE 5: ROAD GRAPH (Adjacency Matrix, Dijkstra, Kruskal)
// ============================================================

export interface RoadEdge {
  a: number;
  b: number;
  km: number;
}

export interface DijkstraResult {
  found: boolean;
  path: number[];
  totalKm: number;
  steps: Array<{ areaIndex: number; dist: number; via: number | null }>;
}

export interface KruskalResult {
  edges: RoadEdge[];
  used: number;
  totalKm: number;
  fullyConnected: boolean;
}

function findRoot(parent: number[], x: number): number {
  while (parent[x] !== x) x = parent[x];
  return x;
}

export class CityGraph {
  private road: number[][];

  constructor() {
    this.road = Array.from({ length: MAX_AREAS }, () => Array(MAX_AREAS).fill(0));
  }

  private validPair(a: number, b: number): boolean {
    return a >= 0 && a < MAX_AREAS && b >= 0 && b < MAX_AREAS && a !== b;
  }

  clearAll(): void {
    for (let i = 0; i < MAX_AREAS; i++) {
      for (let j = 0; j < MAX_AREAS; j++) {
        this.road[i][j] = 0;
      }
    }
  }

  loadDemo(): void {
    this.clearAll();
    this.addRoad(0, 1, 1);
    this.addRoad(0, 2, 2);
    this.addRoad(0, 4, 2);
    this.addRoad(1, 2, 1);
    this.addRoad(1, 3, 2);
    this.addRoad(2, 4, 2);
    this.addRoad(2, 5, 3);
    this.addRoad(3, 6, 2);
    this.addRoad(4, 6, 3);
    this.addRoad(5, 6, 2);
    this.addRoad(5, 7, 3);
    this.addRoad(6, 7, 2);
  }

  weight(a: number, b: number): number {
    if (a < 0 || a >= MAX_AREAS || b < 0 || b >= MAX_AREAS) return 0;
    return this.road[a][b];
  }

  addRoad(a: number, b: number, km: number): boolean {
    if (!this.validPair(a, b) || km <= 0 || km > 10000) return false;
    this.road[a][b] = this.road[b][a] = km;
    return true;
  }

  deleteRoad(a: number, b: number): boolean {
    if (!this.validPair(a, b) || this.road[a][b] === 0) return false;
    this.road[a][b] = this.road[b][a] = 0;
    return true;
  }

  updateRoad(a: number, b: number, km: number): boolean {
    if (!this.validPair(a, b) || this.road[a][b] === 0 || km <= 0 || km > 10000) return false;
    this.road[a][b] = this.road[b][a] = km;
    return true;
  }

  listEdges(): RoadEdge[] {
    const edges: RoadEdge[] = [];
    for (let i = 0; i < MAX_AREAS; i++) {
      for (let j = i + 1; j < MAX_AREAS; j++) {
        if (this.road[i][j] > 0) {
          edges.push({ a: i, b: j, km: this.road[i][j] });
        }
      }
    }
    return edges;
  }

  getMatrix(): number[][] {
    return this.road.map((row) => [...row]);
  }

  shortestPath(s: number, d: number): DijkstraResult {
    const INF = 1_000_000_000;
    const dist = Array(MAX_AREAS).fill(INF);
    const parent = Array(MAX_AREAS).fill(-1);
    const done = Array(MAX_AREAS).fill(false);
    dist[s] = 0;

    for (let step = 0; step < MAX_AREAS; step++) {
      let u = -1;
      for (let i = 0; i < MAX_AREAS; i++) {
        if (!done[i] && dist[i] < INF && (u === -1 || dist[i] < dist[u])) {
          u = i;
        }
      }
      if (u === -1) break;
      done[u] = true;
      for (let v = 0; v < MAX_AREAS; v++) {
        if (this.road[u][v] > 0 && !done[v] && dist[u] + this.road[u][v] < dist[v]) {
          dist[v] = dist[u] + this.road[u][v];
          parent[v] = u;
        }
      }
    }

    if (dist[d] >= INF) {
      return { found: false, path: [], totalKm: 0, steps: [] };
    }

    const path: number[] = [];
    for (let c = d; c !== -1; c = parent[c]) path.push(c);
    path.reverse();

    const steps = path.map((idx) => ({
      areaIndex: idx,
      dist: dist[idx],
      via: parent[idx] === -1 ? null : parent[idx],
    }));

    return { found: true, path, totalKm: dist[d], steps };
  }

  minimumRoadPlan(): KruskalResult {
    const allEdges = this.listEdges();
    // Exact selection sort matching C++ implementation
    for (let i = 0; i < allEdges.length; i++) {
      for (let j = i + 1; j < allEdges.length; j++) {
        if (allEdges[j].km < allEdges[i].km) {
          const t = allEdges[i];
          allEdges[i] = allEdges[j];
          allEdges[j] = t;
        }
      }
    }

    const parent = Array.from({ length: MAX_AREAS }, (_, i) => i);
    const selected: RoadEdge[] = [];
    let used = 0;
    let totalKm = 0;

    for (const edge of allEdges) {
      const ra = findRoot(parent, edge.a);
      const rb = findRoot(parent, edge.b);
      if (ra !== rb) {
        parent[ra] = rb;
        totalKm += edge.km;
        used++;
        selected.push(edge);
      }
    }

    return {
      edges: selected,
      used,
      totalKm,
      fullyConnected: used === MAX_AREAS - 1,
    };
  }

  clone(): CityGraph {
    const g = new CityGraph();
    g.road = this.getMatrix();
    return g;
  }

  hasRoad(a: number, b: number): boolean {
    return this.validPair(a, b) && this.road[a][b] > 0;
  }

  serialize(): string {
    return this.listEdges()
      .map((e) => `${e.a}|${e.b}|${e.km}`)
      .join('\n');
  }

  loadFromText(content: string): { imported: number; skipped: number } {
    this.clearAll();
    let imported = 0;
    let skipped = 0;
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      if (!line.trim()) continue;
      const fld = splitFields(line, 3);
      if (fld.length < 3) {
        skipped++;
        continue;
      }
      const a = parseInt(fld[0], 10);
      const b = parseInt(fld[1], 10);
      const km = parseInt(fld[2], 10);
      if (!Number.isNaN(a) && !Number.isNaN(b) && !Number.isNaN(km) && this.addRoad(a, b, km)) {
        imported++;
      } else {
        skipped++;
      }
    }
    return { imported, skipped };
  }
}

// ============================================================
// PIPE-DELIMITED FILE SERIALIZATION (.txt parity)
// ============================================================

export function serializeCityReports(reports: CityReport[]): string {
  return reports
    .map(
      (r) =>
        `${r.id}|${r.area}|${r.category}|${sanitizePipeText(r.description)}|${r.priority}|${r.resolved ? 1 : 0}|${sanitizePipeText(r.submittedBy ?? '')}|${sanitizePipeText(r.createdAt ?? '')}|${sanitizePipeText(r.ownerEmail ?? '')}`,
    )
    .join('\n');
}

export function parseCityReports(
  content: string,
): { reports: CityReport[]; nextId: number; skipped: number } {
  const reports: CityReport[] = [];
  const seen = new Set<number>();
  let nextId = 1001;
  let skipped = 0;

  for (const line of content.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const fld = splitFields(line, 9);
    if (fld.length < 6) {
      skipped++;
      continue;
    }
    const id = parseInt(fld[0], 10);
    const priority = parseInt(fld[4], 10) as PriorityLevel;
    const resolved = parseInt(fld[5], 10) !== 0;
    const area = AREAS.includes(fld[1] as AreaName) ? (fld[1] as AreaName) : 'Shaheb Bazar';
    const category = CITY_CATEGORIES.includes(fld[2] as CityCategory)
      ? (fld[2] as CityCategory)
      : 'Other';
    if (
      !Number.isNaN(id) &&
      id > 0 &&
      priority >= 1 &&
      priority <= 4 &&
      !seen.has(id) &&
      reports.length < MAX_RECORDS
    ) {
      seen.add(id);
      reports.push({
        id,
        area,
        category,
        description: fld[3],
        priority,
        resolved,
        submittedBy: fld[6] || undefined,
        createdAt: fld[7] || undefined,
        ownerEmail: fld[8] || undefined,
      });
      if (id >= nextId) nextId = id + 1;
    } else {
      skipped++;
    }
  }
  return { reports, nextId, skipped };
}

export function serializeWasteRecords(records: WasteRecord[]): string {
  return records
    .map(
      (r) =>
        `${r.id}|${r.area}|${r.wasteType}|${r.amountKg}|${r.urgency}|${sanitizePipeText(r.notes)}|${r.collected ? 1 : 0}|${sanitizePipeText(r.submittedBy ?? '')}|${sanitizePipeText(r.createdAt ?? '')}|${sanitizePipeText(r.ownerEmail ?? '')}`,
    )
    .join('\n');
}

export function parseWasteRecords(
  content: string,
): { records: WasteRecord[]; nextId: number; skipped: number } {
  const records: WasteRecord[] = [];
  const seen = new Set<number>();
  let nextId = 5001;
  let skipped = 0;

  for (const line of content.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const fld = splitFields(line, 10);
    if (fld.length < 7) {
      skipped++;
      continue;
    }
    const id = parseInt(fld[0], 10);
    const amountKg = parseInt(fld[3], 10);
    const urgency = parseInt(fld[4], 10) as PriorityLevel;
    const collected = parseInt(fld[6], 10) !== 0;
    const area = AREAS.includes(fld[1] as AreaName) ? (fld[1] as AreaName) : 'Shaheb Bazar';
    const wasteType = WASTE_TYPES.includes(fld[2] as WasteType)
      ? (fld[2] as WasteType)
      : 'Household';
    if (
      !Number.isNaN(id) &&
      id > 0 &&
      !Number.isNaN(amountKg) &&
      amountKg > 0 &&
      urgency >= 1 &&
      urgency <= 4 &&
      !seen.has(id) &&
      records.length < MAX_RECORDS
    ) {
      seen.add(id);
      records.push({
        id,
        area,
        wasteType,
        amountKg,
        urgency,
        notes: fld[5],
        collected,
        submittedBy: fld[7] || undefined,
        createdAt: fld[8] || undefined,
        ownerEmail: fld[9] || undefined,
      });
      if (id >= nextId) nextId = id + 1;
    } else {
      skipped++;
    }
  }
  return { records, nextId, skipped };
}

// ============================================================
// RAJSHAHI STARTER DATASET (Grounded & Realistic)
// ============================================================

export function getDemoCityReports(): CityReport[] {
  return [
    {
      id: 1001,
      area: 'Shaheb Bazar',
      category: 'Traffic',
      description: 'Signal synchronization lag at Shaheb Bazar main intersection during peak hours',
      priority: 4,
      resolved: false,
    },
    {
      id: 1002,
      area: 'Zero Point',
      category: 'Street Light',
      description: 'Three LED poles flickering along northern roundabout perimeter',
      priority: 2,
      resolved: true,
    },
    {
      id: 1003,
      area: 'Rail Gate',
      category: 'Waterlogging',
      description: 'Storm drain blockage near railway crossing causing curb pooling',
      priority: 4,
      resolved: false,
    },
    {
      id: 1004,
      area: 'Laxmipur',
      category: 'Road Damage',
      description: 'Asphalt depression near medical college hospital ambulance lane',
      priority: 3,
      resolved: false,
    },
    {
      id: 1005,
      area: 'Kazla',
      category: 'Pollution',
      description: 'Dust accumulation near construction material unloading zone',
      priority: 2,
      resolved: false,
    },
    {
      id: 1006,
      area: 'Talaimari',
      category: 'Street Light',
      description: 'Pedestrian crossing floodlight outage on Padma riverfront road',
      priority: 3,
      resolved: false,
    },
    {
      id: 1007,
      area: 'Court',
      category: 'Other',
      description: 'Broken footpath curb stone adjacent to district court east gate',
      priority: 1,
      resolved: true,
    },
    {
      id: 1008,
      area: 'Vodra',
      category: 'Traffic',
      description: 'Faded lane markings around Vodra Mor bus bay',
      priority: 2,
      resolved: false,
    },
  ];
}

export function getDemoWasteRecords(): WasteRecord[] {
  return [
    {
      id: 5001,
      area: 'Shaheb Bazar',
      wasteType: 'Organic',
      amountKg: 640,
      urgency: 4,
      notes: 'Central kitchen market produce bin near capacity',
      collected: false,
    },
    {
      id: 5002,
      area: 'Laxmipur',
      wasteType: 'Plastic',
      amountKg: 310,
      urgency: 3,
      notes: 'Sorted polymer containers behind clinic block',
      collected: false,
    },
    {
      id: 5003,
      area: 'Rail Gate',
      wasteType: 'Mixed',
      amountKg: 480,
      urgency: 4,
      notes: 'Transit terminal transfer skip requires morning dispatch',
      collected: false,
    },
    {
      id: 5004,
      area: 'Kazla',
      wasteType: 'Household',
      amountKg: 275,
      urgency: 2,
      notes: 'University residential sector morning bin',
      collected: false,
    },
    {
      id: 5005,
      area: 'Vodra',
      wasteType: 'Construction',
      amountKg: 920,
      urgency: 3,
      notes: 'Road resurfacing rubble palletized by ward crew',
      collected: false,
    },
    {
      id: 5006,
      area: 'Court',
      wasteType: 'Household',
      amountKg: 190,
      urgency: 1,
      notes: 'Cleared on Tuesday morning route',
      collected: true,
    },
  ];
}

// Spatial coordinates for the 8 Rajshahi areas on a 760x420 SVG canvas
export const AREA_COORDS: Record<AreaName, { x: number; y: number; zone: string }> = {
  'Court':        { x: 110, y: 120, zone: 'West Civic' },
  'Laxmipur':     { x: 245, y: 95,  zone: 'North-West' },
  'Rail Gate':    { x: 380, y: 125, zone: 'Central Transit' },
  'Zero Point':   { x: 255, y: 215, zone: 'Central Hub' },
  'Shaheb Bazar': { x: 175, y: 315, zone: 'South Market' },
  'Kazla':        { x: 525, y: 165, zone: 'East University' },
  'Talaimari':    { x: 425, y: 325, zone: 'Riverfront' },
  'Vodra':        { x: 645, y: 265, zone: 'North-East' },
};
