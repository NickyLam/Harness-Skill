import { describe, it, expect, beforeEach } from '@jest/globals';
import { {{functionName}} } from '../{{modulePath}}';

describe('{{functionName}}', () => {
  // Arrange: 设置测试环境
  beforeEach(() => {
    // 重置状态、清理 mock
  });

  describe('happy path', () => {
    it('should {{expectedBehavior}} when {{condition}}', () => {
      // Arrange
      const input = {{input}};
      const expected = {{expected}};

      // Act
      const result = {{functionName}}(input);

      // Assert
      expect(result).toBe(expected);
    });
  });

  describe('edge cases', () => {
    it.each([
      [{{edgeCase1Input}}, {{edgeCase1Expected}}],
      [{{edgeCase2Input}}, {{edgeCase2Expected}}],
    ])('should handle %j', (input, expected) => {
      expect({{functionName}}(input)).toBe(expected);
    });
  });

  describe('error handling', () => {
    it('should throw {{errorType}} when {{invalidCondition}}', () => {
      expect(() => {{functionName}}({{invalidInput}}))
        .toThrow({{errorType}});
    });
  });
});
