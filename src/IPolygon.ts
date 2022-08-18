import { isContributing, NEXT_INDEX, PREV_INDEX, Rectangle, setContributing, Vertex } from "./util";

export interface IPolygon {

    isEmpty: boolean;
    bounds: Rectangle;

    [isContributing](index: number): boolean;
    [setContributing](index: number, value: boolean): void;

    getInnerPolies(): IPolygon[];
    getNumPoints(): number;
    get(index: number): Vertex;
}

export function OPTIMAL(p: IPolygon, i: number): boolean {
    const { y: yi } = p.get(i);
    const numPoints = p.getNumPoints();

    return (p.get(PREV_INDEX(i, numPoints)).y !== yi) ||
        (p.get(NEXT_INDEX(i, numPoints)).y !== yi);
}
