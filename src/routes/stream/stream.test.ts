import { describe, it, expect } from 'vitest';
import { BoundedQueue } from '../../lib/bounded-queue.js';

describe('BoundedQueue', () => {
  it('stores items up to maxSize', () => {
    const q = new BoundedQueue<number>(3);
    q.push(1);
    q.push(2);
    q.push(3);
    expect(q.size).toBe(3);
    expect(q.isFull).toBe(true);
    expect(q.droppedCount).toBe(0);
  });

  it('drops oldest when over capacity', () => {
    const q = new BoundedQueue<number>(3);
    q.push(1);
    q.push(2);
    q.push(3);
    q.push(4);
    expect(q.size).toBe(3);
    expect(q.droppedCount).toBe(1);
    expect(q.drain()).toEqual([2, 3, 4]);
  });

  it('drain returns all items and empties the queue', () => {
    const q = new BoundedQueue<string>(5);
    q.push('a');
    q.push('b');
    const drained = q.drain();
    expect(drained).toEqual(['a', 'b']);
    expect(q.size).toBe(0);
    expect(q.drain()).toEqual([]);
  });

  it('tracks cumulative droppedCount across multiple overflows', () => {
    const q = new BoundedQueue<number>(2);
    q.push(1);
    q.push(2);
    q.push(3); // drops 1
    q.push(4); // drops 2
    q.push(5); // drops 3
    expect(q.droppedCount).toBe(3);
    expect(q.drain()).toEqual([4, 5]);
  });

  it('defaults to maxSize of 100', () => {
    const q = new BoundedQueue<number>();
    for (let i = 0; i < 100; i++) q.push(i);
    expect(q.isFull).toBe(true);
    expect(q.droppedCount).toBe(0);
    q.push(100);
    expect(q.droppedCount).toBe(1);
    expect(q.size).toBe(100);
  });

  it('isFull returns false when under capacity', () => {
    const q = new BoundedQueue<number>(5);
    q.push(1);
    expect(q.isFull).toBe(false);
  });

  it('handles maxSize of 1', () => {
    const q = new BoundedQueue<string>(1);
    q.push('a');
    expect(q.size).toBe(1);
    q.push('b');
    expect(q.droppedCount).toBe(1);
    expect(q.drain()).toEqual(['b']);
  });
});
