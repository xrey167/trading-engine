export class BoundedQueue<T> {
  private readonly items: T[] = [];
  private readonly maxSize: number;
  private _droppedCount = 0;

  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }

  push(item: T): void {
    if (this.items.length >= this.maxSize) {
      this.items.shift();
      this._droppedCount++;
    }
    this.items.push(item);
  }

  drain(): T[] {
    return this.items.splice(0);
  }

  get size(): number {
    return this.items.length;
  }

  get isFull(): boolean {
    return this.items.length >= this.maxSize;
  }

  get droppedCount(): number {
    return this._droppedCount;
  }
}
