
export class Polygon {
    constructor(public contours: f64[][] | null, public contributing: bool[] | null) { }

    public get isEmpty(): bool {
        return this.contours === null || this.contours.length === 0;
    }
}