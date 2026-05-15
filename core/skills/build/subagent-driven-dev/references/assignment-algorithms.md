# Task Assignment Algorithms

## 算法输入

```typescript
interface Task {
  id: string;
  description: string;
  priority: 'P0' | 'P1' | 'P2';
  complexity: 'simple' | 'medium' | 'complex';
  dependencies: string[];
  outputFiles: string[];
  requiredSkills: string[];
}
```

## 分配算法步骤

```
Step 1: 构建依赖图（DAG）
    ↓
Step 2: 拓扑排序确定执行顺序
    ↓
Step 3: 识别可并行层（同一层的任务可同时执行）
    ↓
Step 4: 根据复杂度和优先级分配给 Implementer 子代理
    ↓
Step 5: 每层完成后，启动 Reviewer 子代理审查该层所有产出
    ↓
Step 6: 汇总结果，处理冲突，进入下一层
```

## 策略 1：基于优先级分配

```typescript
function assignByPriority(tasks: Task[]): Map<string, ImplementerAgent> {
  const assignment = new Map();
  const sortedTasks = [...tasks].sort((a, b) => {
    const priorityOrder = { P0: 0, P1: 1, P2: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  // P0 任务优先分配给最有经验的 Implementer
  // P1 任务分配给通用 Implementer
  // P2 任务可以排队或降级处理

  return assignment;
}
```

## 策略 2：基于复杂度均衡

```typescript
function assignByComplexityBalance(tasks: Task[], agents: ImplementerAgent[]): Map<string, string> {
  const workload = new Map(agents.map(a => [a.id, 0]));
  const assignment = new Map();
  const complexityScore = { simple: 1, medium: 2, complex: 3 };

  for (const task of tasks) {
    const bestAgent = [...workload.entries()]
      .sort((a, b) => a[1] - b[1])[0][0];
    assignment.set(task.id, bestAgent);
    workload.set(bestAgent, workload.get(bestAgent)! + complexityScore[task.complexity]);
  }

  return assignment;
}
```

## 策略 3：技能匹配

```typescript
function assignBySkillMatching(tasks: Task[], agents: ImplementerAgent[]): Map<string, string> {
  const assignment = new Map();

  for (const task of tasks) {
    const scores = agents.map(agent => ({
      agentId: agent.id,
      matchScore: calculateSkillMatch(agent.skills, task.requiredSkills),
    }));

    const bestMatch = scores.sort((a, b) => b.matchScore - a.matchScore)[0];
    assignment.set(task.id, bestMatch.agentId);
  }

  return assignment;
}

function calculateSkillMatch(agentSkills: string[], requiredSkills: string[]): number {
  const matched = requiredSkills.filter(s => agentSkills.includes(s)).length;
  return matched / requiredSkills.length;
}
```

## 依赖图构建

```typescript
function buildDependencyGraph(tasks: Task[]) {
  const graph = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();

  for (const task of tasks) {
    graph.set(task.id, new Set());
    inDegree.set(task.id, 0);
  }

  for (const task of tasks) {
    for (const dep of task.dependencies) {
      graph.get(dep)?.add(task.id);
      inDegree.set(task.id, inDegree.get(task.id)! + 1);
    }
  }

  return { graph, inDegree };
}

function topologicalSort(tasks: Task[]): Task[][] {
  const { graph, inDegree } = buildDependencyGraph(tasks);
  const layers: Task[][] = [];
  const remaining = new Set(tasks.map(t => t.id));

  while (remaining.size > 0) {
    const currentLayer = tasks.filter(t =>
      remaining.has(t.id) && (inDegree.get(t.id) || 0) === 0
    );

    if (currentLayer.length === 0) {
      throw new Error('Circular dependency detected!');
    }

    layers.push(currentLayer);

    for (const task of currentLayer) {
      remaining.delete(task.id);
      for (const dependent of graph.get(task.id) || []) {
        inDegree.set(dependent, inDegree.get(dependent)! - 1);
      }
    }
  }

  return layers;
}
```
