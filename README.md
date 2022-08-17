# GPC.js
A Port of the General Polygon Clipper library by the University of Manchester (http://www.cs.man.ac.uk/~toby/gpc/)
======

This module exports a single data type, `Polygon`, which can represent euclidean polygons of arbitrary complexity and perform binary set operations on them. `Polygon`s are not directly constructable with `new`; new `Polygon` instances can be created with `Polygon.fromPoints()` or `Polygon.fromVertices()`, described below. `Polygon`s are also immutable; all geometric operations return new `Polygon` instances as their results.

## API

* `readonly isEmpty: boolean` Indicates whether the polygon has non-zero area.
* `readonly isHole: boolean` Indicates whether the polygon has negative area / is the boundary of a hole in a complex polygon.
* `bounds: { minx: number, maxx: number, miny: number, maxy: number }` Returns the minimal coordinate-aligned rectangular bounding box for the polygon.
* `equals(obj: Polygon): boolean` Determine whether two polygons have the same vertex set, including the categorization of vertices as belonging to positive boundaries or holes.
* `toVertices(): { bounds: { x: number, y: number }[][], holes: { x: number, y: number }[][] }` Exports a description of the polygon as a set of vanilla JS objects. `bounds` is a list of lists of vertices representing the boundaries of positive-area sub-polygons, while holes is a list of lists of vertices representing the boundaries of interior holes.
* `static fromVertices({ bounds, holes }: { bounds: Vertex[][], holes: Vertex[][] }): Polygon` Creates a complex polygon from an object of the same shape as returned by `toVertices()`. A `Vertex` can be an object of the form `{ x: number, y: number }` or a two-element array of `[x, y]`.
* `static fromPoints(points: Vertex[]): Polygon` Creates a simple polygon from a list of vertices, where a `Vertex` can be an object of the form `{ x: number, y: number }` or a two-element array of `[x, y]`.
* `static intersection(...p: Polygon[]): Polygon` Computes the geometric set intersection of a list of `Polygon`s.
* `intersection(...p: Polygon[]): Polygon` Computes the geometric set intersection of `this` with a list of additional `Polygon`s.
* `static union(...p: Polygon[]): Polygon` Computes the geometric set union of a list of `Polygon`s. 
* `union(...p: Polygon[]): Polygon` Computes the geometric set union of `this` with a list of additional `Polygon`s.
* `static xor(...p: Polygon[]): Polygon` Computes the geometric symmetric set difference of a list of `Polygon`s.
* `xor(...p: Polygon[]): Polygon` Computes the geometric symmetric set difference of `this` with a list of additional `Polygon`s.
* `static difference(first: Polygon, ...p: Polygon[]): Polygon` Computes the geometric set difference of the first `Polygon` with a list of additional `Polygon`s.
* `difference(...p: Polygon[]): Polygon` Computes the geometric set difference of `this` with a list of additional `Polygon`s.
