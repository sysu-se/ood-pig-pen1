# EVOLUTION.md - Homework 2 设计演进文档

## 1. 如何实现提示功能？

提示功能通过 `Sudoku` 类和 `Game` 类协作实现：

### 候选提示（getCandidates）
- 核心实现在 `Sudoku.getCandidates(row, col)`（Sudoku.js:93）
- 算法：遍历行、列、宫，排除已出现的数字，返回剩余的候选数集合
- `Game.getCandidates(row, col)` 通过委托调用 `Sudoku` 对应方法
- `gameStore.getCandidates(pos)` 作为 Store Adapter 暴露给 UI
- UI（Actions.svelte）调用 `gameStore.getCandidates()` 后展示候选数

### 下一步提示 / 推定数（getDeducibleMoves）
- 核心实现在 `Sudoku.getDeducibleMoves()`（Sudoku.js:160）
- 算法：遍历所有空格，找到候选数唯一（长度为1）的位置
- 返回推定数数组：`[{row, col, value}, ...]`
- `Game.getNextHint()` 委托调用，`gameStore.getNextHint()` 暴露给 UI
- UI 通过高亮格子展示推定数位置

### 逐格填入提示（applyHint）
- 优先使用推定数（确定性推理）
- 如果没有推定数，则调用求解器 `solveSudoku()` 获取答案
- `gameStore.applyHint(pos)` 实现完整的"智能填入"逻辑

### 提示原因说明（加分项）
- `Game.getHintReason(row, col)`（Game.js:242）提供提示解释
- 返回三类原因：已填满、唯一候选数、候选数列表
- 体现提示能力的可解释性

---

## 2. 提示功能更属于 Sudoku 还是 Game？为什么？

**更属于 Sudoku**，理由如下：

1. **核心逻辑在 Sudoku**：`getCandidates()` 和 `getDeducibleMoves()` 是纯粹的数独领域逻辑，不依赖游戏状态（是否在探索、历史记录等）
2. **Game 不保存提示状态**：提示是即时的、"查看"操作，不改变游戏状态（无副作用）
3. **提示可以被其他系统使用**：即便不使用 Game，一个独立的 Sudoku 对象也能提供完整的提示功能——例如在解题器或编辑器场景
4. **符合单一职责原则**：
   - Sudoku 负责"这个局面能推导出什么"
   - Game 负责"用户如何处理这个局面的操作"
5. **Sudoku 的接口更纯粹**：`getCandidates(row, col)` 只需要格子坐标，不需要知道用户操作上下文

**Game 的角色**：
- 作为入口点，通过委托调用 `Sudoku` 的提示方法
- 负责检查用户是否在预设格子上使用提示（初始格不可提示）
- 负责与求解器（`solveSudoku`）交互获取答案（推定数不够时）
- `Game.getHintReason()` 额外封装了局面语义（如"该格子已填满"）

---

## 3. 如何实现探索模式？

探索模式通过 **状态切换 + 快照管理 + 记忆机制** 实现，涉及 `Game` 领域层、`gameStore` 桥接层和 `Actions.svelte` UI 层三层协作。

### 进入探索（enterExplore）
`Game.js:352`
1. 保存探索开始前的三份快照：
   - `exploreStartSnapshot`：当前 Sudoku 局面（clone 副本）
   - `exploreHistorySnapshot`：主 history 栈的副本
   - `exploreRedoSnapshot`：主 redoHistory 栈的副本
2. 初始化探索模式专用历史栈：
   - `exploreMoveHistory`：探索中的移动记录（数组）
   - `exploreRedoHistory`：探索中的重做记录（数组）
3. 设置标志 `this.isExploring = true`

### 探索中的操作（guess）
`Game.js:95`
- 每次 `guess()` 正常执行，并记录到 `exploreMoveHistory`
- **不同点**：不写入主 history，不影响正常游戏历史
- **实时冲突检测**：每次填数后自动调用：
  - `sudoku.hasAnyConflict()` 检测行/列/宫冲突
  - `sudoku.hasEmptyCandidate()` 检测死路（空格无候选数）
  - 一旦检测到冲突或死路，立即将当前盘面指纹加入 `failedExplorations` 集合

### 探索中的 Undo/Redo
- `Game._undoExplore()`（Game.js:535）：从 `exploreMoveHistory` 弹出，推入 `exploreRedoHistory`
- `Game._redoExplore()`（Game.js:550）：从 `exploreRedoHistory` 弹出，推入 `exploreMoveHistory`
- 完全独立于主游戏的 undo/redo，互不干扰

### 提交探索（submitExplore）
`Game.js:440`
1. 检查冲突：若有则记录到 `failedExplorations`，返回失败
2. 检查死路：若有则记录到 `failedExplorations`，返回失败
3. 检查完整性：未完成则返回 `incomplete`
4. 合并探索历史到主历史，清空探索状态
5. 结果通过 `syncToStores()` 同步到 UI

### 放弃探索（exitExplore）
`Game.js:374`
- 一键恢复到探索起点：
  - `this.sudoku = this.exploreStartSnapshot`
  - `this.history = this.exploreHistorySnapshot`（回滚到探索前的历史）
  - `this.redoHistory = this.exploreRedoSnapshot`
- 清空所有探索相关状态变量

### 记忆机制（failedExplorations）
- `Game.failedExplorations` 是一个 `Set`，存储失败盘面的状态指纹
- 状态指纹由 `_getStateKey()` 生成：将 9x9 网格序列化为字符串
- 冲突/死路触发时自动记录，`submitExplore()` 也记录
- `isCurrentStateKnownFailed()` 检查当前盘面是否在失败集合中
- `getExploreConflictStatus()` 返回三合一状态：`{ conflict, emptyCandidate, knownFailed }`

### 实时反馈（Store + UI 层）
- `gameStore.syncToStores()` 每次操作后同步探索状态：
  - `exploringFailed`：已知失败
  - `exploringConflict`：棋盘冲突
  - `exploringEmptyCandidate`：死路
- `Actions.svelte` 第17行 `$:` 响应式块实时检测三状态变化
- 状态变化时自动弹出反馈提示，`lastFeedbackKey` 机制防止重复刷屏

---

## 4. 主局面与探索局面的关系是什么？

### 共享同个实例，但保存恢复点
- 探索模式 **不创建新的 Game 实例**，而是复用当前 Game
- 探索过程中的 `guess()` 直接修改 `this.sudoku`（当前 Sudoku 实例）
- 探索开始时 clone 一份快照作为恢复点，但运行时不切换引用

### 深拷贝问题
- **clone 发生在快照保存时**：每次 `enterExplore()` 调用 `this.sudoku.clone()` 创建完整的 9x9 网格副本
- `clone()`（Sudoku.js:316）会创建全新的 `Sudoku` 实例，避免引用共享
- 这是必要开销：保证放弃探索时能干净回滚，不污染主局面

### 历史快照
- 主 history 和 redoHistory 在探索开始时也被快照保存（spread 复制数组合中的 Sudoku 克隆）
- 探索过程中的操作不会写入主历史栈
- 提交时：只保留探索起点快照到主历史（不是每一步都合并）
- 放弃时：恢复三份快照，探索期间的任何修改都被丢弃

### 与 Store 层的关系
- `gameStore` 持有 `Game` 实例的引用，不额外创建副本
- `syncToStores()` 每次操作后将领域状态同步到 Svelte 响应式 stores
- UI 通过 `$gameStore` 订阅状态变化，无需直接操作 Game 实例

---

## 5. History 结构在本次作业中是否发生了变化？

**是，但保持了线性 + 挂起的结构**：

### 变化点
- 增加了探索模式专用的两套独立历史栈：
  - `exploreMoveHistory`：探索过程中的移动记录
  - `exploreRedoHistory`：探索过程中的重做记录
- Game 现在持有三组历史状态：主历史、探索历史、探索重做历史

### 未变化点
- 主 history 仍然是线性栈（`Array`），`push`/`pop` 操作不变
- 探索不会创建分支（tree），而是"挂起"主历史
- 提交探索后，探索起点被推入主历史（而不是每一步都合并）
- Undo/Redo 在探索模式下自动切换到探索专用栈

### 状态切换逻辑
```
正常模式: isExploring = false → undo/redo 对主 history 操作
探索模式: isExploring = true  → undo/redo 对 exploreMoveHistory 操作
提交:      isExploring = false → 推进主 history，清空探索栈
放弃:      isExploring = false → 主 history 从快照恢复，丢弃探索栈
```

### 决策理由
- 树状分支需要 DAG 合并语义，作业明确说"不要求"
- 线性历史 + 探索挂起是更简单的设计
- 满足"能快速回溯到探索起点"的核心需求
- 已支持探索过程中的独立 Undo/Redo（加分项）

---

## 6. Homework 1 中的哪些设计，在 Homework 2 中暴露出了局限？

### 局限 1：Sudoku 没有候选数计算能力
- Homework 1 的 `Sudoku` 只负责存储网格和验证冲突
- 实现提示功能时发现需要 `getCandidates()` 方法
- 实现探索的死路检测时发现需要 `hasEmptyCandidate()` 方法
- **演进**：`Sudoku` 现在包含候选数计算、推定数推导、死路检测等数独领域推理能力

### 局限 2：Game 没有状态建模能力
- Homework 1 的 `Game` 只有"正常游戏"一个状态
- 探索模式需要"探索中"的隔离状态，但 `Game` 没有状态机
- **演进**：通过 `isExploring` 标志和 `guess()` 内的分支逻辑实现了状态切换
- 但这种方式不够优雅：`undo()`/`redo()` 中需要 if-else 判断状态

### 局限 3：history 机制与探索不兼容
- 原有的 undo/redo 假设所有操作在同一线性历史栈中
- 探索需要隔离的操作历史（不影响主历史）
- **演进**：探索期间使用独立的临时历史栈，切换逻辑放在 `undo()`/`redo()`/`guess()` 内部

### 局限 4：缺少冲突检测的"记忆"
- 探索失败后，再次到达相同状态应该被识别
- 原设计没有失败状态的记录机制
- **演进**：添加 `failedExplorations` Set 和 `isCurrentStateKnownFailed()` 方法来记录和检查

### 局限 5：没有实时反馈机制
- 探索过程中的冲突/死路只有在提交时才被检测
- 作业要求"立刻识别"，需要实时检测
- **演进**：在 `guess()` 中增加实时检测逻辑，通过 `syncToStores()` 同步到 UI

### 局限 6：Store Adapter 的导出方式
- `gameStore` 既是一个 Svelte store（通过 `subscribe`），又是一个包含方法的对象
- 这种混合方式导致了一些命名导出问题（如 `exploringConflict` 无法作为 named export）
- **演进**：将探索状态加入 `state` derived 对象，通过 `$gameStore` 统一访问

---

## 7. 如果重做一次 Homework 1，你会如何修改原设计？

通过对比 HW1 的实际代码和 HW2 的演进需求，以下是最需要在 HW1 中预先改进的设计点：

### 1. Sudoku 应预埋候选数推导接口

HW1 的 `Sudoku` 只有一个职责：存储 9x9 网格并提供 `guess(move)`：

```javascript
// HW1 的 Sudoku——过于精简
class Sudoku {
    constructor(input) { this.grid = JSON.parse(JSON.stringify(input)) }
    getGrid() { return JSON.parse(JSON.stringify(this.grid)) }
    guess(move) { this.grid[move.row][move.col] = move.value }
    clone() { return new Sudoku(this.grid) }
    toJSON() { return { grid: this.grid } }
    toString() { /* 格式化输出 */ }
    static fromJSON(json) { return new Sudoku(json.grid) }
}
```

HW2 需要在这个基础上添加候选数、推定数、冲突检测、死路检测，但这些方法与 `Sudoku` 的数据结构完全耦合（都依赖 grid）。如果 HW1 就预留以下接口占位：

```javascript
// 如果 HW1 就预埋这些方法（即使留空或简易实现）
getCandidates(row, col)  // HW2：计算候选数
getAllCandidates()       // HW2：遍历所有空格的候选数
validate()               // HW2：返回冲突格子列表
```

HW2 只需要"填空"实现算法，而不需要修改 HW1 的任何已有方法签名。更重要的是，`guess()` 现在需要修改来调用候选数算法（`guess()` 中用 `getCandidates()` 更新候选数），如果这些方法一开始就在接口层面存在，HW2 演进时会更自然。

### 2. Game 构造函数应采用 options 风格

HW1 的 `Game` 构造函数直接接收 `Sudoku` 对象：

```javascript
// HW1
constructor(sudoku) {
    this.sudoku = sudoku
    this.history = []
    this.redoHistory = []
}
```

HW2 被迫改为 `constructor(options = {})`：

```javascript
// HW2
constructor(options = {}) {
    const sudoku = options.sudoku || new Sudoku()
    ...
}
```

而且这个改动导致了**耦合问题**：HW2 的 `src/domain/index.js` 中 `createGame({ sudoku })` 传 `{ sudoku }` 对象给构造函数，但 `src/node_modules/@sudoku/domain/index.js` 中 `createGame(sudoku)` 直接传 `sudoku` 实例。两份代码不同步。

如果 HW1 就用 options 风格，这些不一致从一开始就不存在。

### 3. 将 History 管理抽象为独立模块

HW1 的 history 实现直接内嵌在 `Game` 中：

```javascript
// HW1——history 完全内嵌
class Game {
    constructor(sudoku) {
        this.sudoku = sudoku
        this.history = []
        this.redoHistory = []
    }
    guess(move) {
        this.history.push(this.sudoku.clone())
        this.sudoku.guess(move)
        this.redoHistory = []
    }
    undo() {
        this.redoHistory.push(this.sudoku.clone())
        this.sudoku = this.history.pop()
    }
    redo() {
        this.history.push(this.sudoku.clone())
        this.sudoku = this.redoHistory.pop()
    }
}
```

当 HW2 引入探索模式需要独立的历史栈时，必须在每个方法中插入 if-else 分支：

```javascript
// HW2——被迫在多个方法中做状态判断
guess(move) {
    // ... 校验 ...
    if (this.isExploring) {
        this._recordExploreMove(this.sudoku.clone())
        // 实时冲突检测
    } else {
        this.history.push(this.sudoku.clone())
        this.redoHistory = []
    }
}
undo() {
    if (this.isExploring) { return this._undoExplore() }
    // 正常撤销逻辑
}
```

**HW1 的改进方案**：将 history 管理抽取为独立的 `HistoryManager` 类：

```javascript
class HistoryManager {
    constructor() {
        this.stack = []
        this.redoStack = []
    }
    push(snapshot) { this.stack.push(snapshot); this.redoStack = [] }
    undo(current) {
        if (this.stack.length === 0) return null
        this.redoStack.push(current)
        return this.stack.pop()
    }
    redo(current) {
        if (this.redoStack.length === 0) return null
        this.stack.push(current)
        return this.redoStack.pop()
    }
    canUndo() { return this.stack.length > 0 }
    canRedo() { return this.redoStack.length > 0 }
    snapshot() { return [...this.stack] }
    restore(snapshot) { this.stack = snapshot; this.redoStack = [] }
}

class Game {
    constructor(sudoku) {
        this.sudoku = sudoku
        this.history = new HistoryManager()   // 主历史
    }
    guess(move) {
        this.history.push(this.sudoku.clone())
        this.sudoku.guess(move)
    }
    undo() {
        const restored = this.history.undo(this.sudoku.clone())
        if (restored) this.sudoku = restored
    }
}
```

HW2 增加探索模式时，Game 只需要：

```javascript
class Game {
    constructor(sudoku) {
        this.sudoku = sudoku
        this.history = new HistoryManager()
        this.exploreHistory = new HistoryManager()  // HW2：探索专用历史
    }
    guess(move) {
        const target = this.isExploring ? this.exploreHistory : this.history
        target.push(this.sudoku.clone())
        this.sudoku.guess(move)
    }
}
```

**无需在 `guess()`、`undo()`、`redo()` 中插入任何 if-else**，只需要选择正确的 HistoryManager 实例即可。这是"策略模式"的雏形——不同的历史管理策略可以互相替换。

### 4. guess() 应返回操作结果，而不是 void

HW1 的 `Sudoku.guess(move)` 没有返回值，`Game.guess(move)` 也没有：

```javascript
// HW1——不返回任何信息
Sudoku.prototype.guess = function(move) {
    if (!this.isValidPosition(move.row, move.col)) return
    if (typeof move.value !== 'number' || move.value < 0 || move.value > 9) return
    this.grid[move.row][move.col] = move.value
}
```

HW2 需要 `guess()` 返回 boolean 来判断是否成功（初始格子不可修改时返回 false），还需要在探索模式下返回冲突状态。如果 HW1 就设计为：

```javascript
Sudoku.prototype.guess = function(move) {
    // 校验失败返回 false，成功返回 true
    if (!this.isValidPosition(move.row, move.col)) return false
    if (typeof move.value !== 'number' || move.value < 0 || move.value > 9) return false
    this.grid[move.row][move.col] = move.value
    return true
}
```

HW2 演进时调用方可以直接用返回值判断，无需额外校验。

### 5. 保持单一源代码路径

HW1 的项目结构中没有 `src/node_modules/@sudoku/` 这个副本目录，所有代码只在 `src/` 下。HW2 中出现了两份代码副本的问题：

```
src/stores/gameStore.js             ← 修改的版本
src/node_modules/@sudoku/stores/gameStore.js  ← 旧版本（需手动同步）
```

以及：
```
src/domain/Game.js                  ← 修改的版本
src/node_modules/@sudoku/domain/Game.js      ← 旧版本
src/node_modules/@sudoku/domain/index.js      ← 构造函数参数风格不同
```

如果 HW1 就确定 `src/` 是唯一源码路径，并通过 rollup alias 正确配置所有 `@sudoku/*` 路径指向 `src/` 下对应的目录，就不会有"改了 A 还要手动复制到 B"的耦合问题。具体来说：

```javascript
// rollup.config.js — HW1 就应该这样配
alias: [
    { find: '@sudoku/stores', replacement: path.resolve(__dirname, 'src/stores') },
    { find: '@sudoku/domain', replacement: path.resolve(__dirname, 'src/domain') },
    { find: '@sudoku/sudoku.js', replacement: path.resolve(__dirname, 'src/node_modules/@sudoku/sudoku.js') },
    { find: '@sudoku/sencode', replacement: path.resolve(__dirname, 'src/node_modules/@sudoku/sencode') },
    { find: '@sudoku/constants.js', replacement: path.resolve(__dirname, 'src/node_modules/@sudoku/constants.js') },
]
```

这样 `src/domain/` 和 `src/stores/` 是唯一源码点，`@sudoku/` 只用于不可变的第三方库。这个代价很小，但带来了长远的可维护性。

### 6. 序列化应支持非核心状态的扩展

HW1 的 `Game.toJSON()` 只序列化当前 sudoku 局面，不序列化 history：

```javascript
// HW1
toJSON() {
    return { sudoku: this.sudoku.toJSON() }
}
```

这个设计看似合理（保存当前可玩的局面就够了），但如果 HW1 就设计一个可扩展的 `metadata` 或 `state` 字段：

```javascript
toJSON() {
    return {
        sudoku: this.sudoku.toJSON(),
        _meta: { /* 留空，供未来扩展 */ }
    }
}
```

HW2 就可以在这里存放探索状态、记忆状态等信息，实现完整的游戏会话持久化。

### 总结：HW1 的核心优势与 HW2 暴露的短板

Homework 1 的设计核心是**正确的**——Sudoku/Game 分离、工厂函数接口、Store Adapter 模式——这些是后续能够增量演进的基础。但 HW1 的设计偏向了"刚好够用"，缺少对扩展性的预判：

| 设计点 | HW1 | HW2 因此需要的改变 | 预判方案 |
|--------|-----|---------------|---------|
| Sudoku 接口 | 只存网格、填数字 | 候选数、冲突检测、死路检测 | 预埋占位方法 |
| Game 构造函数 | `(sudoku)` | `({ sudoku })` | 一开始就用 options |
| history 管理 | 内嵌数组 | 探索模式独立历史 | 抽取 HistoryManager |
| guess 返回值 | void | boolean + 状态信息 | 返回 boolean |
| 代码路径 | 单一来源 | 两份副本需同步 | 配置文件 alias |
| 序列化 | 仅 sudoku | 需扩展更多状态 | 预留 metadata 字段 |

总的工程经验：**设计时要多问一个"如果将来要扩展 X，现在的接口扛得住吗？"**——不必过度设计（YAGNI），但基本的扩展点（返回值、参数风格、模块化边界）应该在第一次设计时就确定下来。
