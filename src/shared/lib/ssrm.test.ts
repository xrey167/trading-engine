import { describe, it, expect } from 'vitest';
import { applySSRM } from './ssrm.js';

const rows = [
  { name: 'Alice', age: 30, score: 85 },
  { name: 'Bob', age: 25, score: 92 },
  { name: 'Charlie', age: 35, score: 78 },
  { name: 'Diana', age: 28, score: 95 },
  { name: 'Eve', age: 22, score: 88 },
];

describe('applySSRM', () => {
  it('returns all rows and lastRow when no params given', () => {
    const result = applySSRM(rows, {});
    expect(result.rows).toHaveLength(5);
    expect(result.lastRow).toBe(5);
  });

  it('paginates with startRow/endRow', () => {
    const result = applySSRM(rows, { startRow: 1, endRow: 3 });
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].name).toBe('Bob');
    expect(result.rows[1].name).toBe('Charlie');
    expect(result.lastRow).toBe(5);
  });

  it('sorts ascending by numeric column', () => {
    const result = applySSRM(rows, {
      sortModel: JSON.stringify([{ colId: 'age', sort: 'asc' }]),
    });
    expect(result.rows[0].name).toBe('Eve');
    expect(result.rows[4].name).toBe('Charlie');
  });

  it('sorts descending by string column', () => {
    const result = applySSRM(rows, {
      sortModel: JSON.stringify([{ colId: 'name', sort: 'desc' }]),
    });
    expect(result.rows[0].name).toBe('Eve');
    expect(result.rows[4].name).toBe('Alice');
  });

  it('filters with contains', () => {
    const result = applySSRM(rows, {
      filterModel: JSON.stringify({ name: { type: 'contains', filter: 'li' } }),
    });
    expect(result.rows.map(r => r.name)).toEqual(['Alice', 'Charlie']);
    expect(result.lastRow).toBe(2);
  });

  it('filters with greaterThan', () => {
    const result = applySSRM(rows, {
      filterModel: JSON.stringify({ score: { type: 'greaterThan', filter: 90 } }),
    });
    expect(result.rows.map(r => r.name)).toEqual(['Bob', 'Diana']);
  });

  it('filters with lessThan', () => {
    const result = applySSRM(rows, {
      filterModel: JSON.stringify({ age: { type: 'lessThan', filter: 25 } }),
    });
    expect(result.rows.map(r => r.name)).toEqual(['Eve']);
  });

  it('filters with equals', () => {
    const result = applySSRM(rows, {
      filterModel: JSON.stringify({ age: { type: 'equals', filter: 30 } }),
    });
    expect(result.rows.map(r => r.name)).toEqual(['Alice']);
  });

  it('filters with inRange', () => {
    const result = applySSRM(rows, {
      filterModel: JSON.stringify({ age: { type: 'inRange', filter: 25, filterTo: 30 } }),
    });
    expect(result.rows.map(r => r.name)).toEqual(['Alice', 'Bob', 'Diana']);
  });

  it('combines filter + sort + pagination', () => {
    const result = applySSRM(rows, {
      filterModel: JSON.stringify({ score: { type: 'greaterThan', filter: 80 } }),
      sortModel: JSON.stringify([{ colId: 'score', sort: 'desc' }]),
      startRow: 0,
      endRow: 2,
    });
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].name).toBe('Diana');
    expect(result.rows[1].name).toBe('Bob');
    expect(result.lastRow).toBe(4); // 4 rows match filter > 80
  });

  it('returns empty rows when startRow exceeds total', () => {
    const result = applySSRM(rows, { startRow: 100, endRow: 200 });
    expect(result.rows).toEqual([]);
    expect(result.lastRow).toBe(5);
  });

  it('does not mutate the original array', () => {
    const original = [...rows];
    applySSRM(rows, { sortModel: JSON.stringify([{ colId: 'age', sort: 'desc' }]) });
    expect(rows).toEqual(original);
  });
});
