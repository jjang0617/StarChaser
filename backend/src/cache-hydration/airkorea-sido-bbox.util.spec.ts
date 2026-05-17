import { findSidoByLatLng } from './airkorea-sido-bbox.util';

describe('airkorea-sido-bbox.util', () => {
  it('findSidoByLatLng for Seoul', () => {
    expect(findSidoByLatLng(37.5665, 126.978)).toBe('서울');
  });
});
