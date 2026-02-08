/**
 * A* Pathfinding Service
 *
 * Implements the A* search algorithm for finding the optimal path
 * through the grid-based arena from start to end position.
 */

export interface Position {
  x: number;
  y: number;
}

export interface GridCell {
  x: number;
  y: number;
  walkable: boolean;
  isStart: boolean;
  isEnd: boolean;
}

class PathNode {
  public x: number;
  public y: number;
  public g: number; // Cost from start to this node
  public h: number; // Heuristic cost from this node to end
  public f: number; // Total cost (g + h)
  public parent: PathNode | null;

  constructor(x: number, y: number, parent: PathNode | null = null) {
    this.x = x;
    this.y = y;
    this.g = 0;
    this.h = 0;
    this.f = 0;
    this.parent = parent;
  }

  equals(other: PathNode): boolean {
    return this.x === other.x && this.y === other.y;
  }

  toString(): string {
    return `(${this.x}, ${this.y})`;
  }
}

/**
 * Calculate Manhattan distance heuristic between two positions.
 */
function heuristic(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Check if a cell is walkable (not an obstacle and within bounds).
 */
function isWalkable(grid: number[][], x: number, y: number): boolean {
  if (x < 0 || y < 0 || y >= grid.length || x >= grid[0].length) {
    return false;
  }
  // 0 = empty, 1 = obstacle, 2 = start, 3 = end
  return grid[y][x] !== 1;
}

/**
 * Get valid neighboring positions (Up, Down, Left, Right).
 */
function getNeighbors(grid: number[][], node: PathNode): PathNode[] {
  const neighbors: PathNode[] = [];
  const directions = [
    { dx: 0, dy: -1 }, // Up
    { dx: 0, dy: 1 },  // Down
    { dx: -1, dy: 0 }, // Left
    { dx: 1, dy: 0 },  // Right
  ];

  for (const dir of directions) {
    const newX = node.x + dir.dx;
    const newY = node.y + dir.dy;

    if (isWalkable(grid, newX, newY)) {
      neighbors.push(new PathNode(newX, newY, node));
    }
  }

  return neighbors;
}

/**
 * Reconstruct path from end node back to start.
 */
function reconstructPath(endNode: PathNode): Position[] {
  const path: Position[] = [];
  let current: PathNode | null = endNode;

  while (current !== null) {
    path.unshift({ x: current.x, y: current.y });
    current = current.parent;
  }

  return path;
}

/**
 * Find the node with the lowest f score in the open set.
 */
function findLowestF(openSet: PathNode[]): number {
  let lowestIndex = 0;
  let lowestF = openSet[0].f;

  for (let i = 1; i < openSet.length; i++) {
    if (openSet[i].f < lowestF) {
      lowestF = openSet[i].f;
      lowestIndex = i;
    } else if (openSet[i].f === lowestF && openSet[i].h < openSet[lowestIndex].h) {
      // Tie-breaking: prefer the node closer to the goal
      lowestIndex = i;
    }
  }

  return lowestIndex;
}

export const PathfindingService = {
  /**
   * Find the optimal path from start to end using A* algorithm.
   *
   * @param grid - 2D array where 0=empty, 1=obstacle, 2=start, 3=end
   * @param start - Starting position {x, y}
   * @param end - Ending position {x, y}
   * @returns Array of positions representing the path, or empty array if no path exists
   */
  findPath(grid: number[][], start: Position, end: Position): Position[] {
    // Validate start and end positions
    if (!isWalkable(grid, start.x, start.y) || !isWalkable(grid, end.x, end.y)) {
      return [];
    }

    const openSet: PathNode[] = [];
    const closedSet: Set<string> = new Set();

    const startNode = new PathNode(start.x, start.y);
    startNode.g = 0;
    startNode.h = heuristic(start, end);
    startNode.f = startNode.g + startNode.h;

    openSet.push(startNode);

    while (openSet.length > 0) {
      // Find node with lowest f score
      const currentIndex = findLowestF(openSet);
      const current = openSet[currentIndex];

      // Check if we reached the end
      if (current.x === end.x && current.y === end.y) {
        return reconstructPath(current);
      }

      // Move current from open to closed
      openSet.splice(currentIndex, 1);
      const currentKey = `${current.x},${current.y}`;
      closedSet.add(currentKey);

      // Explore neighbors
      const neighbors = getNeighbors(grid, current);

      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.x},${neighbor.y}`;

        // Skip if already evaluated
        if (closedSet.has(neighborKey)) {
          continue;
        }

        const tentativeG = current.g + 1; // All moves cost 1

        // Check if this neighbor is already in the open set
        const existingIndex = openSet.findIndex(
          (n) => n.x === neighbor.x && n.y === neighbor.y
        );

        if (existingIndex === -1) {
          // New node, add to open set
          neighbor.g = tentativeG;
          neighbor.h = heuristic({ x: neighbor.x, y: neighbor.y }, end);
          neighbor.f = neighbor.g + neighbor.h;
          neighbor.parent = current;
          openSet.push(neighbor);
        } else if (tentativeG < openSet[existingIndex].g) {
          // Better path found, update existing node
          openSet[existingIndex].g = tentativeG;
          openSet[existingIndex].f = tentativeG + openSet[existingIndex].h;
          openSet[existingIndex].parent = current;
        }
      }
    }

    // No path found
    return [];
  },

  /**
   * Calculate the optimal path length between two points.
   */
  getPathLength(grid: number[][], start: Position, end: Position): number {
    const path = this.findPath(grid, start, end);
    return path.length > 0 ? path.length - 1 : -1; // -1 indicates no path
  },

  /**
   * Check if a path exists between two points.
   */
  hasPath(grid: number[][], start: Position, end: Position): boolean {
    return this.findPath(grid, start, end).length > 0;
  },

  /**
   * Validate that a move is adjacent (Up, Down, Left, Right only).
   */
  isValidMove(from: Position, to: Position): boolean {
    const dx = Math.abs(from.x - to.x);
    const dy = Math.abs(from.y - to.y);
    return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
  },

  /**
   * Check if a position is walkable on the grid.
   */
  isWalkable(grid: number[][], position: Position): boolean {
    return isWalkable(grid, position.x, position.y);
  },
};

export default PathfindingService;
