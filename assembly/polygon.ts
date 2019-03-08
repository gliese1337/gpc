import { Rectangle } from './rectangle';

export class Polygon {

    constructor(public contours: f64[][], public contributing: bool[]) { }

    public get isEmpty(): bool {
        return this.contours.length === 0;
    }

    private _innerBounds: Rectangle[] | null = null;
    public get innerBounds(): Rectangle[] {
        if (this._innerBounds === null) {
            let contours = this.contours;
            let polylen = contours.length;
            this._innerBounds = new Array(polylen);
                
            for (let i = 0; i < polylen; i++) {
                let poly = contours[i];
                let pointlen = poly.length;
                    
                let xmin = Infinity;
                let ymin = Infinity;
                let xmax = -Infinity;
                let ymax = -Infinity;

                for (let j = 0; j < pointlen; j+=2) {
                    let x = poly[j];
                    let y = poly[j+1];
                    if (x < xmin) { xmin = x; }
                    if (x > xmax) { xmax = x; }
                    if (y < ymin) { ymin = y; }
                    if (y > ymax) { ymax = y; }
                }
                
                this._innerBounds[i] = new Rectangle(xmin, ymin, xmax, ymax);
            }
        }

        return this._innerBounds as Rectangle[];
    }
}