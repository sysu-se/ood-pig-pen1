# EVOLUTION.md - Homework 2 设计演进文档

## 1. 如何实现提示功能？

提示功能通过 `Sudoku` 类和 `Game` 类协作实现：

### 候选提示（getCandidates）
- 在 `Sudoku.getCandidates(row, col)` 方法中实现
- 算法：遍历行、列、宫，排除已出现的数字，返回剩余的候选数集合

### 下一步提示（getDeducibleMoves）
- 在 `Sudoku.getDeducibleMoves()` 方法中实现
- 算法：遍历所有空格，找到候选数唯一（长度为1）的位置
- 返回推定数数组：`[{row, col, value}, ...]`

### 应用提示（applyHint）
- 在 `gameStore.applyHint(pos)` 中实现
- 优先使用推定数，如果没有则使用求解器获取答案

## 2. 提示功能更属于 Sudoku 还是 Game？为什么？

**更属于 Sudoku**，理由如下：

1. **核心逻辑在 Sudoku**：`getCandidates()` 和 `getDeducibleMoves()` 是纯粹的数独领域逻辑，不依赖游戏状态
2. **Game 不保存提示状态**：提示是即时的、"查看"操作，不改变游戏状态
3. **提示可以被其他系统使用**：即便不使用 Game，一个独立的 Sudoku 对象也能提供提示功能
4. **符合单一职责原则**：Sudoku 负责"这是什么局面"，Game 负责"如何处理用户的操作"

**Game 的角色**：
- 作为入口点，通过委托调用 `Sudoku` 的方法
- 负责检查用户是否在预设格子上使用提示
- 负责与求解器（`solveSudoku`）交互获取答案

## 3. 如何实现探索模式？

探索模式通过 **状态切换 + 快照管理** 实现：

### 进入探索（enterExplore）
1. 保存探索开始前的状态快照：
   - `exploreStartSnapshot`: 当前 Sudoku 局面
   - `exploreHistorySnapshot`: 主 history 栈
   - `exploreRedoSnapshot`: 主 redoHistory 栈
2. 初始化探索模式专用历史：
   - `exploreMoveHistory`: 探索过程中的移动历史
   - `exploreRedoHistory`: 探索过程中的重做历史
3. 设置 `isExploring = true`

### 探索中的操作（guess）
- 正常记录到 `exploreMoveHistory`
- 不影响主 history 和 redoHistory

### 探索中的 Undo/Redo
- 使用探索模式专用的历史栈
- 不影响主游戏历史

### 提交探索（submitExplore）
- 检查是否有冲突：`sudoku.hasAnyConflict()`
- 如果有冲突，记录到 `failedExplorations` 并返回 false
- 如果无冲突且完成，将探索历史合并到主历史

### 放弃探索（exitExplore）
- 恢复到 `exploreStartSnapshot`
- 恢复主 history 和 redoHistory
- 清空所有探索状态

## 4. 主局面与探索局面的关系是什么？

### 共享 vs 复制
- **主局面与探索局面共享同一个 Sudoku 实例引用**
- 探索开始时保存的是快照副本（clone）
- 探索过程中的修改都在副本上进行
- 提交或放弃时通过快照恢复

### 深拷贝问题
- **会产生深拷贝**：每次 `clone()` 都创建完整的 9x9 网格副本
- 这是有意为之的设计，保证探索不会污染主局面

### 提交时如何合并
- 探索提交成功时：
  - 主 Sudoku 已经被修改为探索后的状态
  - 只需要清空探索状态即可
  - 历史记录通过快照保持一致

### 放弃时如何回滚
- 直接用快照恢复：
  - `this.sudoku = this.exploreStartSnapshot`
  - `this.history = this.exploreHistorySnapshot`
  - `this.redoHistory = this.exploreRedoSnapshot`

## 5. History 结构在本次作业中是否发生了变化？

**是的，但保持了线性结构**：

### 变化点
- 增加了探索模式专用历史栈：
  - `exploreMoveHistory`: 探索中的移动
  - `exploreRedoHistory`: 探索中的重做

### 未变化点
- 主 history 仍然是线性栈（数组）
- 探索不会创建分支，而是"挂起"主历史
- 提交探索后，探索内容融入主历史
- 不要求多层嵌套探索

### 决策理由
- 树状分支会导致 DAG 合并问题，作业明确说"不要求"
- 线性历史 + 探索挂起是更简单的设计
- 满足"能快速回溯到探索起点"的需求

## 6. Homework 1 中的哪些设计，在 Homework 2 中暴露出了局限？

### 局限 1：Sudoku 没有候选数计算能力
- Homework 1 的 `Sudoku` 只负责存储和校验
- 实现提示功能时发现需要添加 `getCandidates()` 等方法
- **演进**：Sudoku 现在包含数独求解逻辑

### 局限 2：Game 没有状态建模能力
- Homework 1 的 `Game` 只有"正常游戏"状态
- 探索模式需要"探索中"状态，但 `Game` 没有状态机
- **演进**：通过 `isExploring` 标志模拟状态切换

### 局限 3：history 机制与探索不兼容
- 原有的 undo/redo 机制假设所有操作在同一历史栈中
- 探索需要"隔离"的操作历史
- **演进**：探索期间使用独立的临时历史栈

### 局限 4：缺少冲突检测的"记忆"
- 探索失败后，再次到达相同状态应该被识别
- 原设计没有失败状态的记录机制
- **演进**：添加 `failedExplorations` Set 来记录已知失败状态

## 7. 如果重做一次 Homework 1，你会如何修改原设计？

### 1. Sudoku 类的扩展
```javascript
// 添加候选数计算
getCandidates(row, col) { ... }
getAllCandidates() { ... }
getDeducibleMoves() { ... }
hasAnyConflict() { ... }
```

### 2. Game 类的状态设计
```javascript
// 添加状态枚举或标志
this.state = 'playing' | 'exploring' | 'paused'

// 探索相关的状态
this.exploreHistory = []
this.failedStates = new Set()
```

### 3. History 机制的抽象
```javascript
// 将 history 管理抽象为独立模块
class HistoryManager {
    push(snapshot) { ... }
    undo() { ... }
    redo() { ... }
}

// Game 持有多个 HistoryManager
this.mainHistory = new HistoryManager()
this.exploreHistory = new HistoryManager()
```

### 4. 提示功能的预埋
```javascript
// Sudoku 提供提示接口
this.getHint() // 获取下一步
this.getCandidates(pos) // 获取候选数
```

### 5. 更清晰的接口契约
```javascript
// guess() 返回操作结果和状态变化
guess(move) {
    return {
        success: boolean,
        stateChanged: boolean,
        conflict: boolean
    }
}
```

### 总结
Homework 1 的设计核心是**正确的**（Sudoku/Game 分离、Store Adapter、领域驱动），但缺少一些**扩展点**：
- 数独领域能力（候选数、求解）
- 状态建模能力（多状态、状态切换）
- 历史管理的灵活性（探索隔离、快照管理）

本次作业在原有基础上通过**增量修改**实现了新功能，避免了推倒重来，体现了"演进优于重构"的设计哲学。
