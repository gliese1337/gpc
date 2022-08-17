import 'mocha';
import { expect } from 'chai';

import { pointUp, pointDn, small } from './vertices';
import { Polygon } from '../src/gpc';

describe("Test unions", () => {
  const up = Polygon.fromPoints(pointUp);
  const dn = Polygon.fromPoints(pointDn);
  const sm = Polygon.fromPoints(small);

  it("should produce a six-point star", () => { 
    const p1 = up.union(dn);
    const p2 = dn.union(up);
    const p3 = Polygon.union(up, dn);
    expect(p1.getNumPoints()).eql(12);
    expect(p1.equals(p2), "Union is not commutative.");
    expect(p1.equals(p3), "Static method does not give same result as instance method.");
  });

  it("should be an identity operation for superset", () => { 
    const p1 = up.union(sm);
    expect(p1.getNumPoints()).eql(3);
    expect(p1.equals(up), "Union identity operation failed.");
    expect(!p1.equals(sm), "Union identity operation failed.");
  });
});