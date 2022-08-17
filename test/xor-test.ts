import 'mocha';
import { expect } from 'chai';

import { pointUp, pointDn, small } from './vertices';
import { Polygon } from '../src/gpc';

describe("Test xors", () => {
  const up = Polygon.fromPoints(pointUp);
  const dn = Polygon.fromPoints(pointDn);
  const sm = Polygon.fromPoints(small);

  it("should produce a six disjoint triangle tips", () => { 
    const p1 = up.xor(dn);
    const p2 = dn.xor(up);
    const p3 = Polygon.xor(up, dn);
    expect(p1.getNumPoints()).eql(18);
    expect(p1.equals(p2), "Xor is not commutative.");
    expect(p1.equals(p3), "Static method does not give same result as instance method.");
  });

  it("should be identical to difference", () => { 
    const p1 = up.xor(sm);
    const p2 = up.difference(sm);
    expect(p1.getNumPoints()).eql(6);
    expect(p1.equals(p2), "Subset xor and difference do not give the same result.");
  });
});