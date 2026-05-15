# TDD Patterns & Anti-patterns

## RED Patterns

### 1. 从最简单的失败开始

```typescript
// ❌ 错误：一次性写太多测试
it('should handle all edge cases', () => {
  // 100 行测试代码
});

// ✅ 正确：从最简单的失败开始
it('should return 0 for empty string', () => {
  expect(calculate('')).toBe(0);
});
```

### 2. 使用描述性测试名

```typescript
// ❌ 错误：模糊的测试名
it('test1', () => {});

// ✅ 正确：描述行为而非实现
it('should return sum of comma-separated numbers', () => {});
it('should throw error for negative numbers', () => {});
```

## GREEN Patterns

### 1. 最少代码让测试通过

```typescript
// 测试：expect(add(1, 2)).toBe(3);

// ✅ 正确：最简单实现
const add = (a: number, b: number) => a + b;

// ❌ 错误：过度设计
const add = (a: number, b: number) => {
  const calculator = new Calculator();
  return calculator.perform(Operation.ADD, a, b);
};
```

### 2. 硬编码然后泛化

```typescript
// Step 1: 硬编码通过第一个测试
const calculate = (input: string) => 0;

// Step 2: 添加新测试，泛化实现
const calculate = (input: string) => {
  if (input === '') return 0;
  return parseInt(input);
};
```

## REFACTOR Patterns

### 1. 提取重复

```typescript
// 重构前：重复的逻辑
it('should add 1 and 2', () => {
  const result = add(1, 2);
  expect(result).toBe(3);
});

it('should add 2 and 3', () => {
  const result = add(2, 3);
  expect(result).toBe(5);
});

// 重构后：使用参数化测试
it.each([
  [1, 2, 3],
  [2, 3, 5],
  [-1, 1, 0],
])('should add %i and %i to get %i', (a, b, expected) => {
  expect(add(a, b)).toBe(expected);
});
```

## Anti-patterns

### 1. 测试实现而非行为

```typescript
// ❌ 错误：测试内部实现
it('should call save method', () => {
  const spy = jest.spyOn(repository, 'save');
  service.createUser(data);
  expect(spy).toHaveBeenCalled();
});

// ✅ 正确：测试可观察的行为
it('should persist user to database', () => {
  const user = service.createUser(data);
  expect(repository.findById(user.id)).toEqual(user);
});
```

### 2. 测试间有依赖

```typescript
// ❌ 错误：测试间共享状态
let counter = 0;

it('should increment', () => {
  counter++;
  expect(counter).toBe(1);
});

it('should increment again', () => {
  counter++; // 依赖上一个测试
  expect(counter).toBe(2); // 单独运行会失败
});
```

### 3. 忽略边界条件

```typescript
// ❌ 错误：只测试 happy path
it('should calculate sum', () => {
  expect(sum([1, 2, 3])).toBe(6);
});

// ✅ 正确：覆盖边界条件
it.each([
  [[], 0],           // 空数组
  [[1], 1],          // 单元素
  [[1, 2, 3], 6],    // 多元素
  [[-1, 1], 0],      // 负数
  [[Number.MAX_SAFE_INTEGER, 1], Number.MAX_SAFE_INTEGER + 1], // 溢出
])('should calculate sum of %j as %i', (input, expected) => {
  expect(sum(input)).toBe(expected);
});
```
