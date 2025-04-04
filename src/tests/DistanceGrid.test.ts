import { describe, it, expect } from 'vitest';
import { DistanceGrid } from '../leaflet/DistanceGrid';
import L from 'leaflet';

describe('DistanceGrid', () => {
    it('should add an object and retrieve it with getNearObject', () => {
        const grid = new DistanceGrid(50);
        const point = new L.Point(100, 100);
        const obj = { name: 'test' };
        grid.addObject(obj, point);
        // Query a nearby point.
        const nearObj = grid.getNearObject(new L.Point(110, 110));
        expect(nearObj).toBe(obj);
    });

    it('should update an object location', () => {
        const grid = new DistanceGrid(50);
        const point1 = new L.Point(100, 100);
        const obj = { id: 1 };
        grid.addObject(obj, point1);

        // Update object's position.
        const point2 = new L.Point(200, 200);
        grid.updateObject(obj, point2);

        // Query near the old location should not return the object.
        const nearOld = grid.getNearObject(new L.Point(105, 105));
        expect(nearOld).toBeNull();

        // Query near the new location should return the object.
        const nearNew = grid.getNearObject(new L.Point(205, 205));
        expect(nearNew).toBe(obj);
    });

    it('should remove an object', () => {
        const grid = new DistanceGrid(50);
        const point = new L.Point(100, 100);
        const obj = { id: 2 };
        grid.addObject(obj, point);

        // Remove the object.
        const removed = grid.removeObject(obj, point);
        expect(removed).toBe(true);

        // After removal, getNearObject should not find it.
        const nearObj = grid.getNearObject(new L.Point(100, 100));
        expect(nearObj).toBeNull();
    });

    it('eachObject should iterate over all objects', () => {
        const grid = new DistanceGrid(50);
        const obj1 = { a: 1 };
        const obj2 = { b: 2 };
        grid.addObject(obj1, new L.Point(100, 100));
        grid.addObject(obj2, new L.Point(150, 150));
        const collected: any[] = [];
        grid.eachObject((obj) => {
            collected.push(obj);
            return false; // Do not remove
        });
        expect(collected).toContain(obj1);
        expect(collected).toContain(obj2);
    });
});
