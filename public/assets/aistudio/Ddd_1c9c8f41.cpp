// ============================================================
// URBANA - Smart City Management System (Rajshahi city areas)
// Team AetherCore | CSE 2103 Data Structures Lab
// Compile: g++ -std=c++11 -Wall -o urbana Urabana.cpp
// ============================================================

#include <iostream>
#include <fstream>
#include <string>
#include <iomanip>
#include <limits>
#include <cstdlib>
#include <cctype>
using namespace std;

// ---------------- Configuration ----------------
const int MAX_RECORDS    = 500;
const int MAX_AREAS      = 8;
const int HASH_SIZE      = 211;
const int QUEUE_CAPACITY = 50;
const int UNDO_CAPACITY  = 100;
const int TRIE_NODES     = 200;
const string CITY_FILE  = "citypulse_reports.txt";
const string WASTE_FILE = "wastex_records.txt";
const string ROAD_FILE  = "urbana_roads.txt";

const string AREAS[MAX_AREAS] = {
    "Shaheb Bazar", "Zero Point", "Rail Gate", "Laxmipur",
    "Court", "Kazla", "Talaimari", "Vodra"
};
const string CITY_CATEGORIES[6] = {
    "Traffic", "Road Damage", "Waterlogging", "Pollution", "Street Light", "Other"
};
const string WASTE_TYPES[5] = {
    "Household", "Plastic", "Organic", "Construction", "Mixed"
};

string priorityText(int p) {
    if (p == 1) return "Low";
    if (p == 2) return "Medium";
    if (p == 3) return "High";
    return "Critical";
}
string statusText(bool done) { return done ? "Completed" : "Pending"; }

int areaIndex(const string& name) {
    for (int i = 0; i < MAX_AREAS; ++i)
        if (AREAS[i] == name) return i;
    return -1;
}

// ============================================================
// INPUT HELPERS
// ============================================================

void exitOnEOF() {
    cout << "\nInput closed. Exiting.\n";
    exit(0);
}

int readInt(const string& prompt, int low, int high) {
    while (true) {
        cout << prompt;
        int value;
        if (cin >> value) {
            cin.ignore(numeric_limits<streamsize>::max(), '\n');
            if (value >= low && value <= high) return value;
        } else {
            if (cin.eof()) exitOnEOF();          // FIX: no infinite loop on EOF
            cin.clear();
            cin.ignore(numeric_limits<streamsize>::max(), '\n');
        }
        cout << "Invalid input. Enter a value from " << low << " to " << high << ".\n";
    }
}

string readText(const string& prompt) {
    cout << prompt;
    string value;
    if (!getline(cin, value)) exitOnEOF();
    for (size_t i = 0; i < value.size(); ++i)
        if (value[i] == '|') value[i] = '/';     // '|' is the file separator
    return value;
}

string readRequiredText(const string& prompt) {
    while (true) {
        string s = readText(prompt);
        if (s.find_first_not_of(" \t") != string::npos) return s;
        cout << "This field cannot be empty.\n";
    }
}

// Shows numbered options and returns the chosen 0-based index.
int chooseOption(const string& title, const string* items, int n) {
    cout << "\nSelect " << title << ":\n";
    for (int i = 0; i < n; ++i)
        cout << "  " << i + 1 << ". " << items[i] << "\n";
    return readInt("Enter number: ", 1, n) - 1;
}

// Splits a line on '|' into at most maxFields parts. Returns number of parts.
int splitFields(const string& line, string fields[], int maxFields) {
    int n = 0;
    size_t start = 0;
    while (n < maxFields) {
        size_t p = line.find('|', start);
        if (p == string::npos) { fields[n++] = line.substr(start); break; }
        fields[n++] = line.substr(start, p - start);
        start = p + 1;
    }
    return n;
}

// ============================================================
// RECORDS
// ============================================================

struct CityReport {
    int id;
    string area, category, description;
    int priority;      // 1 Low, 2 Medium, 3 High, 4 Critical
    bool resolved;
};

struct WasteRecord {
    int id;
    string area, wasteType, notes;
    int amountKg;
    int urgency;       // 1 Low, 2 Medium, 3 High, 4 Critical
    bool collected;
};

// ============================================================
// MODULE 0: GENERIC NODE + HASH INDEX + LINKED LIST (TEMPLATE)
// Replaces two copy-pasted list classes. Tail pointer makes
// append O(1). Hash index gives O(1) average search by ID.
// ============================================================

template <typename T>
struct Node {
    T data;
    Node* next;
    explicit Node(const T& d) : data(d), next(NULL) {}
};

typedef Node<CityReport> CityNode;
typedef Node<WasteRecord> WasteNode;

// Hash table with separate chaining: ID -> node pointer.
// Average search/insert/delete: O(1). Worst case: O(n).
template <typename T>
class IdIndex {
    struct Entry {
        int id;
        Node<T>* node;
        Entry* next;
        Entry(int i, Node<T>* n) : id(i), node(n), next(NULL) {}
    };
    Entry* table[HASH_SIZE];
    static int slot(int id) { return id % HASH_SIZE; }

public:
    IdIndex() { for (int i = 0; i < HASH_SIZE; ++i) table[i] = NULL; }
    ~IdIndex() { clear(); }

    void clear() {
        for (int i = 0; i < HASH_SIZE; ++i)
            while (table[i]) {
                Entry* t = table[i];
                table[i] = t->next;
                delete t;
            }
    }
    void put(int id, Node<T>* n) {
        int s = slot(id);
        Entry* e = new Entry(id, n);
        e->next = table[s];
        table[s] = e;
    }
    Node<T>* get(int id) const {
        for (Entry* e = table[slot(id)]; e; e = e->next)
            if (e->id == id) return e->node;
        return NULL;
    }
    void erase(int id) {
        Entry** pp = &table[slot(id)];
        while (*pp) {
            if ((*pp)->id == id) {
                Entry* t = *pp;
                *pp = t->next;
                delete t;
                return;
            }
            pp = &(*pp)->next;
        }
    }
};

template <typename T>
class RecordList {
    Node<T>* head;
    Node<T>* tail;
    int count;
    IdIndex<T> index;

    RecordList(const RecordList&);             // no copying
    RecordList& operator=(const RecordList&);

public:
    RecordList() : head(NULL), tail(NULL), count(0) {}
    ~RecordList() { clear(); }

    int size() const { return count; }
    bool full() const { return count >= MAX_RECORDS; }
    Node<T>* getHead() const { return head; }
    Node<T>* find(int id) const { return index.get(id); }   // O(1) avg

    // Append at tail. O(1) plus O(1) duplicate check via index.
    bool insert(const T& r) {
        if (full() || find(r.id)) return false;
        Node<T>* node = new Node<T>(r);
        if (!tail) head = tail = node;
        else { tail->next = node; tail = node; }
        index.put(r.id, node);
        ++count;
        return true;
    }

    // Singly linked: must walk to find the previous node. O(n).
    bool remove(int id) {
        Node<T>* prev = NULL;
        Node<T>* cur = head;
        while (cur && cur->data.id != id) { prev = cur; cur = cur->next; }
        if (!cur) return false;
        if (prev) prev->next = cur->next;
        else head = cur->next;
        if (cur == tail) tail = prev;
        index.erase(id);
        delete cur;
        --count;
        return true;
    }

    void clear() {
        while (head) {
            Node<T>* t = head;
            head = head->next;
            delete t;
        }
        tail = NULL;
        count = 0;
        index.clear();
    }
};

typedef RecordList<CityReport> CityList;
typedef RecordList<WasteRecord> WasteList;

// ============================================================
// MODULE 1: UNDO STACK (array based)
// ============================================================

enum ActionType { ACT_ADD, ACT_MODIFY, ACT_DELETE };

struct Action {
    ActionType type;
    CityReport before;   // snapshot used to undo
    Action() : type(ACT_ADD) {}
    Action(ActionType t, const CityReport& r) : type(t), before(r) {}
};

class UndoStack {
    Action items[UNDO_CAPACITY];
    int top;
public:
    UndoStack() : top(0) {}
    bool empty() const { return top == 0; }

    // Overflow: when full, the oldest action is dropped. O(capacity).
    void push(const Action& a) {
        if (top == UNDO_CAPACITY) {
            for (int i = 1; i < top; ++i) items[i - 1] = items[i];
            --top;
        }
        items[top++] = a;
    }
    // Underflow: returns false when empty.
    bool pop(Action& out) {
        if (top == 0) return false;
        out = items[--top];
        return true;
    }
};

// ============================================================
// MODULE 2: COMPLAINT QUEUE (circular array, FIFO)
// ============================================================

class ComplaintQueue {
    int items[QUEUE_CAPACITY];
    int front, rear, count;
public:
    ComplaintQueue() : front(0), rear(0), count(0) {}
    int size() const { return count; }
    bool full() const { return count == QUEUE_CAPACITY; }
    bool empty() const { return count == 0; }

    bool enqueue(int id) {                 // overflow check
        if (full()) return false;
        items[rear] = id;
        rear = (rear + 1) % QUEUE_CAPACITY;
        ++count;
        return true;
    }
    bool dequeue(int& id) {                // underflow check
        if (empty()) return false;
        id = items[front];
        front = (front + 1) % QUEUE_CAPACITY;
        --count;
        return true;
    }
};

// ============================================================
// MODULE 3: AREA TRIE (prefix search over area names)
// Letters only, case-insensitive, spaces ignored.
// Insert/search: O(L), L = length of the word.
// ============================================================

class AreaTrie {
    int child[TRIE_NODES][26];   // 0 means "no child" (root is node 0)
    int areaOf[TRIE_NODES];      // index into AREAS, or -1
    int used;

    int newNode() {
        for (int c = 0; c < 26; ++c) child[used][c] = 0;
        areaOf[used] = -1;
        return used++;
    }
    void collect(int node, int res[], int& n) const {
        if (areaOf[node] >= 0) res[n++] = areaOf[node];
        for (int c = 0; c < 26; ++c)
            if (child[node][c]) collect(child[node][c], res, n);
    }

public:
    AreaTrie() : used(0) {
        newNode();                                   // root
        for (int i = 0; i < MAX_AREAS; ++i) insert(AREAS[i], i);
    }

    void insert(const string& name, int idx) {
        int cur = 0;
        for (size_t i = 0; i < name.size(); ++i) {
            char ch = static_cast<char>(tolower(static_cast<unsigned char>(name[i])));
            if (ch < 'a' || ch > 'z') continue;
            int c = ch - 'a';
            if (!child[cur][c]) child[cur][c] = newNode();
            cur = child[cur][c];
        }
        areaOf[cur] = idx;
    }

    void complete(const string& prefix) const {
        int cur = 0;
        for (size_t i = 0; i < prefix.size(); ++i) {
            char ch = static_cast<char>(tolower(static_cast<unsigned char>(prefix[i])));
            if (ch < 'a' || ch > 'z') continue;
            int c = ch - 'a';
            if (!child[cur][c]) {
                cout << "No area starts with \"" << prefix << "\".\n";
                return;
            }
            cur = child[cur][c];
        }
        int res[MAX_AREAS];
        int n = 0;
        collect(cur, res, n);
        if (n == 0) { cout << "No area found.\n"; return; }
        cout << "Matching areas:\n";
        for (int k = 0; k < n; ++k) cout << "  - " << AREAS[res[k]] << "\n";
    }
};

// ============================================================
// MODULE 4: WASTE MAX HEAP (collection scheduler)
// Priority: urgency -> amount (kg) -> smaller ID.
// Insert/extract: O(log n). updateUrgency/deleteById:
// search O(n) + sift O(log n).
// ============================================================

class WasteMaxHeap {
    WasteRecord heap[MAX_RECORDS + 1];   // 1-based indexing
    int n;

    static bool higher(const WasteRecord& a, const WasteRecord& b) {
        if (a.urgency != b.urgency) return a.urgency > b.urgency;
        if (a.amountKg != b.amountKg) return a.amountKg > b.amountKg;
        return a.id < b.id;
    }
    void swapAt(int i, int j) {
        WasteRecord t = heap[i];
        heap[i] = heap[j];
        heap[j] = t;
    }
    void siftUp(int i) {
        while (i > 1 && higher(heap[i], heap[i / 2])) {
            swapAt(i, i / 2);
            i /= 2;
        }
    }
    void siftDown(int i) {
        while (true) {
            int l = 2 * i, r = l + 1, best = i;
            if (l <= n && higher(heap[l], heap[best])) best = l;
            if (r <= n && higher(heap[r], heap[best])) best = r;
            if (best == i) break;
            swapAt(i, best);
            i = best;
        }
    }

public:
    WasteMaxHeap() : n(0) {}
    int size() const { return n; }

    bool insert(const WasteRecord& r) {
        if (n >= MAX_RECORDS) return false;      // overflow
        heap[++n] = r;
        siftUp(n);
        return true;
    }

    // Returns heap position (1-based) or 0 if not found.
    int find(int id) const {
        for (int i = 1; i <= n; ++i)
            if (heap[i].id == id) return i;
        return 0;
    }

    // Underflow: returns false when empty.
    bool extractMax(WasteRecord& out) {
        if (n == 0) return false;
        out = heap[1];
        heap[1] = heap[n--];
        if (n > 0) siftDown(1);
        return true;
    }

    bool updateUrgency(int id, int urgency) {
        int i = find(id);
        if (!i) return false;
        int old = heap[i].urgency;
        heap[i].urgency = urgency;
        if (urgency > old) siftUp(i);
        else siftDown(i);
        return true;
    }

    bool deleteById(int id) {
        int i = find(id);
        if (!i) return false;
        heap[i] = heap[n--];
        if (i <= n) {
            siftUp(i);
            siftDown(i);
        }
        return true;
    }
};

// ============================================================
// MODULE 5: ROAD GRAPH (adjacency matrix)
// Dijkstra shortest path: O(V^2) with V = 8.
// Kruskal minimum road plan with Union-Find.
// ============================================================

int findRoot(const int parent[], int x) {
    while (parent[x] != x) x = parent[x];
    return x;
}

class CityGraph {
    int road[MAX_AREAS][MAX_AREAS];   // 0 = no road

    bool validPair(int a, int b) const {
        return a >= 0 && a < MAX_AREAS && b >= 0 && b < MAX_AREAS && a != b;
    }

public:
    CityGraph() { clearAll(); }

    void clearAll() {
        for (int i = 0; i < MAX_AREAS; ++i)
            for (int j = 0; j < MAX_AREAS; ++j) road[i][j] = 0;
    }

    void loadDemo() {
        clearAll();
        addRoad(0,1,1); addRoad(0,2,2); addRoad(0,4,2);
        addRoad(1,2,1); addRoad(1,3,2); addRoad(2,4,2);
        addRoad(2,5,3); addRoad(3,6,2); addRoad(4,6,3);
        addRoad(5,6,2); addRoad(5,7,3); addRoad(6,7,2);
    }

    int weight(int a, int b) const { return road[a][b]; }

    bool addRoad(int a, int b, int km) {
        if (!validPair(a, b) || km <= 0) return false;
        road[a][b] = road[b][a] = km;
        return true;
    }
    bool deleteRoad(int a, int b) {
        if (!validPair(a, b) || road[a][b] == 0) return false;
        road[a][b] = road[b][a] = 0;
        return true;
    }
    bool updateRoad(int a, int b, int km) {
        if (!validPair(a, b) || road[a][b] == 0 || km <= 0) return false;
        road[a][b] = road[b][a] = km;
        return true;
    }

    void listRoads() const {
        bool any = false;
        cout << "\n--- ROAD NETWORK ---\n";
        for (int i = 0; i < MAX_AREAS; ++i)
            for (int j = i + 1; j < MAX_AREAS; ++j)
                if (road[i][j] > 0) {
                    cout << AREAS[i] << " <--> " << AREAS[j] << " : " << road[i][j] << " km\n";
                    any = true;
                }
        if (!any) cout << "No road connections.\n";
    }

    // Returns false if unreachable. path[] receives s ... d.
    bool shortestPath(int s, int d, int path[], int& len, int& total) const {
        const int INF = 1000000000;
        int dist[MAX_AREAS], parent[MAX_AREAS];
        bool done[MAX_AREAS];
        for (int i = 0; i < MAX_AREAS; ++i) {
            dist[i] = INF; parent[i] = -1; done[i] = false;
        }
        dist[s] = 0;

        for (int step = 0; step < MAX_AREAS; ++step) {
            int u = -1;
            for (int i = 0; i < MAX_AREAS; ++i)
                if (!done[i] && dist[i] < INF && (u == -1 || dist[i] < dist[u])) u = i;
            if (u == -1) break;
            done[u] = true;
            for (int v = 0; v < MAX_AREAS; ++v)
                if (road[u][v] > 0 && !done[v] && dist[u] + road[u][v] < dist[v]) {
                    dist[v] = dist[u] + road[u][v];
                    parent[v] = u;
                }
        }
        if (dist[d] >= INF) return false;

        len = 0;
        for (int c = d; c != -1; c = parent[c]) path[len++] = c;   // reversed
        for (int i = 0, j = len - 1; i < j; ++i, --j) {
            int t = path[i]; path[i] = path[j]; path[j] = t;
        }
        total = dist[d];
        return true;
    }

    // Kruskal: sort edges by km (selection sort, E is small), then Union-Find.
    void minimumRoadPlan() const {
        const int MAX_EDGES = MAX_AREAS * MAX_AREAS;
        int ea[MAX_EDGES], eb[MAX_EDGES], ew[MAX_EDGES], m = 0;
        for (int i = 0; i < MAX_AREAS; ++i)
            for (int j = i + 1; j < MAX_AREAS; ++j)
                if (road[i][j] > 0) { ea[m] = i; eb[m] = j; ew[m] = road[i][j]; ++m; }

        for (int i = 0; i < m; ++i)
            for (int j = i + 1; j < m; ++j)
                if (ew[j] < ew[i]) {
                    int t;
                    t = ea[i]; ea[i] = ea[j]; ea[j] = t;
                    t = eb[i]; eb[i] = eb[j]; eb[j] = t;
                    t = ew[i]; ew[i] = ew[j]; ew[j] = t;
                }

        int parent[MAX_AREAS];
        for (int i = 0; i < MAX_AREAS; ++i) parent[i] = i;

        int used = 0, total = 0;
        cout << "\n--- MINIMUM ROAD PLAN (Kruskal + Union-Find) ---\n";
        for (int k = 0; k < m; ++k) {
            int ra = findRoot(parent, ea[k]), rb = findRoot(parent, eb[k]);
            if (ra != rb) {
                parent[ra] = rb;
                total += ew[k];
                ++used;
                cout << "  " << AREAS[ea[k]] << " <--> " << AREAS[eb[k]]
                     << " : " << ew[k] << " km\n";
            }
        }
        if (used == MAX_AREAS - 1)
            cout << "All areas connected. Total road length = " << total << " km\n";
        else
            cout << "Network not fully connected. Partial plan = " << total
                 << " km (" << used << " roads)\n";
    }

    bool save(const string& file) const {
        ofstream f(file.c_str());
        if (!f) return false;
        for (int i = 0; i < MAX_AREAS; ++i)
            for (int j = i + 1; j < MAX_AREAS; ++j)
                if (road[i][j] > 0) f << i << "|" << j << "|" << road[i][j] << "\n";
        return true;
    }

    bool load(const string& file) {
        ifstream f(file.c_str());
        if (!f) return false;
        clearAll();
        string line, fld[3];
        while (getline(f, line)) {
            if (splitFields(line, fld, 3) < 3) continue;
            addRoad(atoi(fld[0].c_str()), atoi(fld[1].c_str()), atoi(fld[2].c_str()));
        }
        return true;
    }
};

// ============================================================
// CITYPULSE LOGIC
// ============================================================

void traverseCity(const CityList& list) {
    if (list.size() == 0) { cout << "\nNo city reports found.\n"; return; }
    cout << "\n--- CITYPULSE REPORTS ---\n";
    cout << left << setw(7) << "ID" << setw(16) << "Area" << setw(14) << "Category"
         << setw(10) << "Priority" << setw(12) << "Status" << "Description\n";
    cout << string(90, '-') << "\n";
    for (CityNode* p = list.getHead(); p; p = p->next) {
        const CityReport& r = p->data;
        cout << left << setw(7) << r.id << setw(16) << r.area
             << setw(14) << r.category << setw(10) << priorityText(r.priority)
             << setw(12) << statusText(r.resolved) << r.description << "\n";
    }
}

void cityDashboard(const CityList& list) {
    int pending = 0, done = 0, critical = 0;
    for (CityNode* p = list.getHead(); p; p = p->next) {
        if (p->data.resolved) ++done;
        else {
            ++pending;
            if (p->data.priority == 4) ++critical;
        }
    }
    cout << "\nCITYPULSE: Total=" << list.size() << ", Pending=" << pending
         << ", Completed=" << done << ", Critical pending=" << critical << "\n";
}

void areaStats(const CityList& list) {
    int counts[MAX_AREAS] = {0};
    for (CityNode* p = list.getHead(); p; p = p->next) {
        int i = areaIndex(p->data.area);
        if (i >= 0) ++counts[i];
    }
    cout << "\n--- REPORTS BY AREA ---\n";
    for (int i = 0; i < MAX_AREAS; ++i)
        cout << left << setw(15) << AREAS[i] << setw(4) << counts[i]
             << string(counts[i], '#') << "\n";
}

void addCityReport(CityList& list, ComplaintQueue& q, UndoStack& undo, int& nextId) {
    if (list.full()) { cout << "Report storage full (" << MAX_RECORDS << ").\n"; return; }
    CityReport r;
    r.id = nextId;
    r.area = AREAS[chooseOption("area", AREAS, MAX_AREAS)];
    r.category = CITY_CATEGORIES[chooseOption("category", CITY_CATEGORIES, 6)];
    r.description = readRequiredText("Describe the problem: ");
    r.priority = readInt("Priority 1 Low, 2 Medium, 3 High, 4 Critical: ", 1, 4);
    r.resolved = false;

    if (!list.insert(r)) { cout << "Could not add report.\n"; return; }
    undo.push(Action(ACT_ADD, r));
    if (!q.enqueue(r.id))
        cout << "Note: complaint queue full. Report saved but not queued.\n";
    ++nextId;
    cout << "City report added. ID: " << r.id << "\n";
}

void processNextComplaint(CityList& list, ComplaintQueue& q) {
    int id;
    if (!q.dequeue(id)) { cout << "Complaint queue is empty.\n"; return; }
    CityNode* n = list.find(id);
    if (!n) { cout << "Report " << id << " no longer exists. Skipped.\n"; return; }
    if (n->data.resolved) { cout << "Report " << id << " already completed. Skipped.\n"; return; }
    n->data.resolved = true;
    cout << "Processed ID " << id << " (" << n->data.area << ", "
         << n->data.category << ") -> Completed.\n";
}

void undoLastCityAction(CityList& list, UndoStack& undo) {
    Action a;
    if (!undo.pop(a)) { cout << "Nothing to undo.\n"; return; }
    if (a.type == ACT_ADD) {
        list.remove(a.before.id);
        cout << "Undo: removed report " << a.before.id << ".\n";
    } else if (a.type == ACT_MODIFY) {
        CityNode* n = list.find(a.before.id);
        if (n) n->data = a.before;
        cout << "Undo: restored report " << a.before.id << ".\n";
    } else {
        cout << (list.insert(a.before) ? "Undo: restored deleted report.\n"
                                       : "Cannot undo: storage full.\n");
    }
}

void cityMenu(CityList& list, ComplaintQueue& q, UndoStack& undo,
              const AreaTrie& trie, int& nextId) {
    while (true) {
        cout << "\n========== CITYPULSE ==========\n"
             << " 1 Add report              2 View all reports\n"
             << " 3 Search by ID            4 Update description\n"
             << " 5 Update priority         6 Mark completed\n"
             << " 7 Reopen report           8 Delete report\n"
             << " 9 Dashboard              10 Process next complaint\n"
             << "11 Undo last action       12 Complaint queue status\n"
             << "13 Area name search        0 Back\n";
        int c = readInt("Choice: ", 0, 13);
        if (c == 0) return;

        if (c == 1) addCityReport(list, q, undo, nextId);
        else if (c == 2) traverseCity(list);
        else if (c == 3) {
            int id = readInt("Report ID: ", 1, 1000000000);
            CityNode* p = list.find(id);
            if (!p) cout << "Report not found.\n";
            else cout << "Found: " << p->data.area << " | " << p->data.category
                      << " | " << priorityText(p->data.priority) << " | "
                      << statusText(p->data.resolved) << " | " << p->data.description << "\n";
        } else if (c == 4) {
            int id = readInt("Report ID: ", 1, 1000000000);
            string s = readRequiredText("New description: ");
            CityNode* p = list.find(id);
            if (!p) cout << "Report not found.\n";
            else {
                undo.push(Action(ACT_MODIFY, p->data));
                p->data.description = s;
                cout << "Updated.\n";
            }
        } else if (c == 5) {
            int id = readInt("Report ID: ", 1, 1000000000);
            int pr = readInt("New priority (1-4): ", 1, 4);
            CityNode* p = list.find(id);
            if (!p) cout << "Report not found.\n";
            else {
                undo.push(Action(ACT_MODIFY, p->data));
                p->data.priority = pr;
                cout << "Updated.\n";
            }
        } else if (c == 6 || c == 7) {
            int id = readInt("Report ID: ", 1, 1000000000);
            CityNode* p = list.find(id);
            if (!p) cout << "Report not found.\n";
            else if (p->data.resolved == (c == 6))
                cout << "Already " << (c == 6 ? "completed" : "pending") << ".\n";
            else {
                undo.push(Action(ACT_MODIFY, p->data));
                p->data.resolved = (c == 6);
                if (c == 7) q.enqueue(id);          // reopened -> back in queue
                cout << "Status updated.\n";
            }
        } else if (c == 8) {
            int id = readInt("Report ID: ", 1, 1000000000);
            CityNode* p = list.find(id);
            if (!p) cout << "Report not found.\n";
            else {
                undo.push(Action(ACT_DELETE, p->data));
                list.remove(id);
                cout << "Report deleted (undo available).\n";
            }
        } else if (c == 9) {
            cityDashboard(list);
            areaStats(list);
        } else if (c == 10) processNextComplaint(list, q);
        else if (c == 11) undoLastCityAction(list, undo);
        else if (c == 12)
            cout << "Complaint queue: " << q.size() << " / " << QUEUE_CAPACITY << " waiting\n";
        else if (c == 13) {
            string prefix = readText("Type area name (or part of it): ");
            trie.complete(prefix);
        }
    }
}

// ============================================================
// WASTEX LOGIC
// ============================================================

void traverseWaste(const WasteList& list) {
    if (list.size() == 0) { cout << "\nNo waste records found.\n"; return; }
    cout << "\n--- WASTEX COLLECTION RECORDS ---\n";
    cout << left << setw(7) << "ID" << setw(16) << "Area" << setw(13) << "Type"
         << setw(9) << "Kg" << setw(10) << "Urgency" << setw(12) << "Status" << "Notes\n";
    cout << string(90, '-') << "\n";
    for (WasteNode* p = list.getHead(); p; p = p->next) {
        const WasteRecord& r = p->data;
        cout << left << setw(7) << r.id << setw(16) << r.area << setw(13) << r.wasteType
             << setw(9) << r.amountKg << setw(10) << priorityText(r.urgency)
             << setw(12) << (r.collected ? "Collected" : "Pending") << r.notes << "\n";
    }
}

void wasteDashboard(const WasteList& list) {
    int pending = 0, done = 0, totalKg = 0, urgent = 0;
    for (WasteNode* p = list.getHead(); p; p = p->next) {
        totalKg += p->data.amountKg;
        if (p->data.collected) ++done;
        else {
            ++pending;
            if (p->data.urgency >= 3) ++urgent;
        }
    }
    cout << "\nWASTEX: Points=" << list.size() << ", Pending=" << pending
         << ", Collected=" << done << ", Recorded waste=" << totalKg
         << " kg, High/Critical pending=" << urgent << "\n";
}

void addWaste(WasteList& list, int& nextId) {
    if (list.full()) { cout << "Waste storage full.\n"; return; }
    WasteRecord r;
    r.id = nextId;
    r.area = AREAS[chooseOption("area", AREAS, MAX_AREAS)];
    r.wasteType = WASTE_TYPES[chooseOption("waste type", WASTE_TYPES, 5)];
    r.amountKg = readInt("Estimated amount (kg): ", 1, 100000);
    r.urgency = readInt("Urgency 1 Low, 2 Medium, 3 High, 4 Critical: ", 1, 4);
    r.notes = readText("Notes (optional): ");
    r.collected = false;
    if (list.insert(r)) { ++nextId; cout << "Waste point added. ID: " << r.id << "\n"; }
    else cout << "Could not add waste record.\n";
}

void wasteMenu(WasteList& list, int& nextId) {
    while (true) {
        cout << "\n============= WASTEX =============\n"
             << "1 Add waste point       2 View all\n"
             << "3 Search by ID          4 Update amount/urgency/notes\n"
             << "5 Mark collected        6 Reopen collection\n"
             << "7 Delete waste point    8 Dashboard\n"
             << "0 Back\n";
        int c = readInt("Choice: ", 0, 8);
        if (c == 0) return;

        if (c == 1) addWaste(list, nextId);
        else if (c == 2) traverseWaste(list);
        else if (c == 3) {
            int id = readInt("Waste ID: ", 1, 1000000000);
            WasteNode* p = list.find(id);
            if (!p) cout << "Waste record not found.\n";
            else cout << "Found: " << p->data.area << " | " << p->data.wasteType << " | "
                      << p->data.amountKg << " kg | " << priorityText(p->data.urgency)
                      << " | " << statusText(p->data.collected) << "\n";
        } else if (c == 4) {
            int id = readInt("Waste ID: ", 1, 1000000000);
            int kg = readInt("Updated amount (kg): ", 1, 100000);
            int u = readInt("Updated urgency (1-4): ", 1, 4);
            string notes = readText("Updated notes: ");
            WasteNode* p = list.find(id);
            if (!p) cout << "Waste record not found.\n";
            else {
                p->data.amountKg = kg;
                p->data.urgency = u;
                p->data.notes = notes;
                cout << "Updated.\n";
            }
        } else if (c == 5 || c == 6) {
            int id = readInt("Waste ID: ", 1, 1000000000);
            WasteNode* p = list.find(id);
            if (!p) cout << "Waste record not found.\n";
            else {
                p->data.collected = (c == 5);
                cout << "Status updated.\n";
            }
        } else if (c == 7) {
            int id = readInt("Waste ID: ", 1, 1000000000);
            cout << (list.remove(id) ? "Waste record deleted.\n" : "Waste record not found.\n");
        } else if (c == 8) wasteDashboard(list);
    }
}

// ============================================================
// SCHEDULER (uses the max heap)
// ============================================================

WasteMaxHeap buildScheduler(const WasteList& list) {
    WasteMaxHeap h;
    for (WasteNode* p = list.getHead(); p; p = p->next)
        if (!p->data.collected) h.insert(p->data);
    return h;
}

void showOrder(WasteMaxHeap h) {          // by value: we extract from a copy
    if (h.size() == 0) { cout << "\nNo pending waste tasks.\n"; return; }
    cout << "\n--- COLLECTION ORDER (HIGHEST PRIORITY FIRST) ---\n";
    WasteRecord t;
    int k = 1;
    while (h.extractMax(t))
        cout << k++ << ". ID " << t.id << " | " << t.area << " | " << t.wasteType
             << " | " << t.amountKg << " kg | " << priorityText(t.urgency) << "\n";
}

void schedulerMenu(WasteList& list) {
    while (true) {
        cout << "\n====== WASTE COLLECTION SCHEDULER (MAX HEAP) ======\n"
             << "1 Show collection order\n"
             << "2 Process next pickup (marks collected)\n"
             << "3 What-if: change urgency (temporary)\n"
             << "4 What-if: remove a point from plan (temporary)\n"
             << "0 Back\n";
        int c = readInt("Choice: ", 0, 4);
        if (c == 0) return;

        if (c == 1) showOrder(buildScheduler(list));
        else if (c == 2) {
            WasteMaxHeap h = buildScheduler(list);
            WasteRecord top;
            if (!h.extractMax(top)) { cout << "No pending pickups.\n"; continue; }
            WasteNode* p = list.find(top.id);
            if (p) p->data.collected = true;
            cout << "Collected ID " << top.id << " (" << top.area << ").\n";
        } else if (c == 3 || c == 4) {
            WasteMaxHeap h = buildScheduler(list);
            int id = readInt("Waste ID: ", 1, 1000000000);
            bool ok;
            if (c == 3) {
                int u = readInt("New urgency (1-4): ", 1, 4);
                ok = h.updateUrgency(id, u);
            } else {
                ok = h.deleteById(id);
            }
            if (!ok) cout << "Point not in pending plan.\n";
            else {
                cout << "Plan updated (list not changed).\n";
                showOrder(h);
            }
        }
    }
}

// ============================================================
// ROAD MENU (graph + route planner merged into one)
// ============================================================

void roadMenu(CityGraph& g) {
    while (true) {
        cout << "\n====== ROAD NETWORK & ROUTE PLANNER ======\n"
             << "1 Add road         2 Delete road      3 Search road\n"
             << "4 Update distance  5 Show all roads   6 Shortest route\n"
             << "7 Minimum road plan                   0 Back\n";
        int c = readInt("Choice: ", 0, 7);
        if (c == 0) return;

        if (c == 5) g.listRoads();
        else if (c == 6) {
            int s = chooseOption("start area", AREAS, MAX_AREAS);
            int d = chooseOption("destination area", AREAS, MAX_AREAS);
            int path[MAX_AREAS], len = 0, total = 0;
            if (!g.shortestPath(s, d, path, len, total)) {
                cout << "No connected route.\n";
            } else {
                cout << "Route: ";
                for (int i = 0; i < len; ++i) {
                    cout << AREAS[path[i]];
                    if (i + 1 < len) cout << " -> ";
                }
                cout << "\nDistance: " << total << " km (sample data)\n";
            }
        } else if (c == 7) g.minimumRoadPlan();
        else {
            int a = chooseOption("first area", AREAS, MAX_AREAS);
            int b = chooseOption("second area", AREAS, MAX_AREAS);
            if (c == 1) {
                int km = readInt("Distance (km): ", 1, 10000);
                cout << (g.addRoad(a, b, km) ? "Road saved.\n" : "Invalid road.\n");
            } else if (c == 2) {
                cout << (g.deleteRoad(a, b) ? "Road deleted.\n" : "Road not found.\n");
            } else if (c == 3) {
                int km = g.weight(a, b);
                if (km <= 0) cout << "No direct road.\n";
                else cout << "Direct distance: " << km << " km\n";
            } else if (c == 4) {
                int km = readInt("New distance (km): ", 1, 10000);
                cout << (g.updateRoad(a, b, km) ? "Distance updated.\n" : "Road not found.\n");
            }
        }
    }
}

// ============================================================
// FILE HANDLING
// ============================================================

void saveCity(const CityList& list) {
    ofstream f(CITY_FILE.c_str());
    if (!f) { cout << "Could not save city reports.\n"; return; }
    for (CityNode* p = list.getHead(); p; p = p->next) {
        const CityReport& r = p->data;
        f << r.id << "|" << r.area << "|" << r.category << "|" << r.description
          << "|" << r.priority << "|" << (r.resolved ? 1 : 0) << "\n";
    }
    cout << "CITYPULSE reports saved.\n";
}

void loadCity(CityList& list, int& nextId) {
    ifstream f(CITY_FILE.c_str());
    if (!f) return;
    string line, fld[6];
    while (getline(f, line)) {
        if (splitFields(line, fld, 6) < 6) continue;
        CityReport r;
        r.id = atoi(fld[0].c_str());
        r.area = fld[1];
        r.category = fld[2];
        r.description = fld[3];
        r.priority = atoi(fld[4].c_str());
        r.resolved = atoi(fld[5].c_str()) != 0;
        if (r.id > 0 && r.priority >= 1 && r.priority <= 4 && list.insert(r) && r.id >= nextId)
            nextId = r.id + 1;
    }
}

void saveWaste(const WasteList& list) {
    ofstream f(WASTE_FILE.c_str());
    if (!f) { cout << "Could not save WASTEX records.\n"; return; }
    for (WasteNode* p = list.getHead(); p; p = p->next) {
        const WasteRecord& r = p->data;
        f << r.id << "|" << r.area << "|" << r.wasteType << "|" << r.amountKg
          << "|" << r.urgency << "|" << r.notes << "|" << (r.collected ? 1 : 0) << "\n";
    }
    cout << "WASTEX records saved.\n";
}

void loadWaste(WasteList& list, int& nextId) {
    ifstream f(WASTE_FILE.c_str());
    if (!f) return;
    string line, fld[7];
    while (getline(f, line)) {
        if (splitFields(line, fld, 7) < 7) continue;
        WasteRecord r;
        r.id = atoi(fld[0].c_str());
        r.area = fld[1];
        r.wasteType = fld[2];
        r.amountKg = atoi(fld[3].c_str());
        r.urgency = atoi(fld[4].c_str());
        r.notes = fld[5];
        r.collected = atoi(fld[6].c_str()) != 0;
        if (r.id > 0 && r.amountKg > 0 && r.urgency >= 1 && r.urgency <= 4 &&
            list.insert(r) && r.id >= nextId)
            nextId = r.id + 1;
    }
}

void saveAll(const CityList& cities, const WasteList& waste, const CityGraph& roads) {
    saveCity(cities);
    saveWaste(waste);
    cout << (roads.save(ROAD_FILE) ? "Road network saved.\n" : "Could not save roads.\n");
}

// ============================================================
// MAIN
// ============================================================

void showMainMenu() {
    cout << "\n====================================================\n"
         << "                       URBANA\n"
         << "          SMART CITY MANAGEMENT SYSTEM\n"
         << "                 TEAM AETHERCORE\n"
         << "====================================================\n"
         << "1. CITYPULSE - City issue management\n"
         << "2. WASTEX - Waste collection management\n"
         << "3. Waste collection scheduler (max heap)\n"
         << "4. Road network and route planner\n"
         << "5. Combined dashboard\n"
         << "6. Save all data\n"
         << "0. Save and exit\n"
         << "====================================================\n";
}

int main() {
    CityList cityReports;
    WasteList wasteRecords;
    CityGraph roads;
    ComplaintQueue complaints;
    UndoStack undo;
    AreaTrie areaTrie;
    int nextCityId = 1001, nextWasteId = 5001;

    loadCity(cityReports, nextCityId);
    loadWaste(wasteRecords, nextWasteId);
    if (!roads.load(ROAD_FILE)) roads.loadDemo();

    // Rebuild the complaint queue from unresolved reports (FIFO by ID order).
    for (CityNode* p = cityReports.getHead(); p; p = p->next)
        if (!p->data.resolved) complaints.enqueue(p->data.id);

    cout << "\n====================================================\n"
         << "                 WELCOME TO URBANA\n"
         << "          SMART CITY MANAGEMENT SYSTEM\n"
         << "              DEVELOPED BY TEAM AETHERCORE\n"
         << "====================================================\n";

    while (true) {
        showMainMenu();
        int choice = readInt("Enter choice: ", 0, 6);

        if (choice == 1) cityMenu(cityReports, complaints, undo, areaTrie, nextCityId);
        else if (choice == 2) wasteMenu(wasteRecords, nextWasteId);
        else if (choice == 3) schedulerMenu(wasteRecords);
        else if (choice == 4) roadMenu(roads);
        else if (choice == 5) {
            cout << "\n========== COMBINED CITY DASHBOARD ==========\n";
            cityDashboard(cityReports);
            wasteDashboard(wasteRecords);
            areaStats(cityReports);
        } else if (choice == 6) {
            saveAll(cityReports, wasteRecords, roads);
        } else {
            saveAll(cityReports, wasteRecords, roads);
            cout << "Thank you for using URBANA - Team AetherCore.\n";
            return 0;
        }
    }
}
