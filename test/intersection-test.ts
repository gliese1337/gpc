import 'mocha';
import { expect } from 'chai';

import { pointUp, pointDn, small } from './vertices';
import { Polygon } from '../src/gpc';

describe("Test intersections", () => {
  const up = Polygon.fromPoints(pointUp);
  const dn = Polygon.fromPoints(pointDn);
  const sm = Polygon.fromPoints(small);

  it("should produce a hexagon", () => {
    const p1 = up.intersection(dn);
    expect(p1.getNumPoints()).eql(6);    
    const p2 = dn.intersection(up);
    expect(p1.equals(p2), "Intersection is not commutative.");
    const p3 = Polygon.intersection(up, dn);
    expect(p1.equals(p3), "Static method does not give same result as instance method.");
  });

  it("should produce a hexagonal convex hull", () => {
    const p1 = up.intersection(dn);
    const p2 = p1.getHull();
    expect(p1.equals(p2), "Convex hull of hexagon is not hexagon.");
  });

  it("should be an identity operation for subset", () => { 
    const p1 = up.intersection(sm);
    expect(p1.getNumPoints()).eql(3);
    expect(p1.equals(sm), "Intersection identity operation failed.");
    expect(!p1.equals(up), "Intersection identity operation failed.");
  });
});