import L from 'leaflet';

export class DistanceGrid {
    private _cellSize: number;
    private _sqCellSize: number;
    private _grid: Record<number, Record<number, any[]>>;
    private _objectPoint: Record<number, L.Point>;

    constructor(cellSize: number) {
        this._cellSize = cellSize;
        this._sqCellSize = cellSize * cellSize;
        this._grid = {};
        this._objectPoint = {};
    }

    addObject(obj: any, point: L.Point): void {
        const x = this._getCoord(point.x);
        const y = this._getCoord(point.y);

        if (!this._grid[y]) {
            this._grid[y] = {};
        }
        if (!this._grid[y][x]) {
            this._grid[y][x] = [];
        }
        const stamp = L.Util.stamp(obj);
        this._objectPoint[stamp] = point;
        this._grid[y][x].push(obj);
    }

    updateObject(obj: any, point: L.Point): void {
        this.removeObject(obj, point);
        this.addObject(obj, point);
    }

    // Returns true if the object was found and removed
    removeObject(obj: any, point: L.Point): boolean {
        const x = this._getCoord(point.x);
        const y = this._getCoord(point.y);

        if (!this._grid[y]) {
            this._grid[y] = {};
        }
        if (!this._grid[y][x]) {
            this._grid[y][x] = [];
        }
        const stamp = L.Util.stamp(obj);
        delete this._objectPoint[stamp];

        const cell = this._grid[y][x];
        for (let i = 0, len = cell.length; i < len; i++) {
            if (cell[i] === obj) {
                cell.splice(i, 1);
                if (len === 1) {
                    delete this._grid[y][x];
                }
                return true;
            }
        }
        return false;
    }

    eachObject(fn: (obj: any) => boolean, context?: any): void {
        for (const y in this._grid) {
            const row = this._grid[y];
            for (const x in row) {
                const cell = row[x];
                for (let k = 0, len = cell.length; k < len; k++) {
                    const removed = fn.call(context, cell[k]);
                    if (removed) {
                        k--;
                        len--;
                    }
                }
            }
        }
    }

    getNearObject(point: L.Point): any | null {
        const x = this._getCoord(point.x);
        const y = this._getCoord(point.y);
        let closest: any = null;
        let closestDistSq = this._sqCellSize;

        for (let i = y - 1; i <= y + 1; i++) {
            const row = this._grid[i];
            if (row) {
                for (let j = x - 1; j <= x + 1; j++) {
                    const cell = row[j];
                    if (cell) {
                        for (let k = 0, len = cell.length; k < len; k++) {
                            const obj = cell[k];
                            const stamp = L.Util.stamp(obj);
                            const dist = this._sqDist(this._objectPoint[stamp], point);
                            if (dist < closestDistSq || (dist <= closestDistSq && closest === null)) {
                                closestDistSq = dist;
                                closest = obj;
                            }
                        }
                    }
                }
            }
        }
        return closest;
    }

    private _getCoord(x: number): number {
        const coord = Math.floor(x / this._cellSize);
        return isFinite(coord) ? coord : x;
    }

    private _sqDist(p: L.Point, p2: L.Point): number {
        const dx = p2.x - p.x;
        const dy = p2.y - p.y;
        return dx * dx + dy * dy;
    }
}
