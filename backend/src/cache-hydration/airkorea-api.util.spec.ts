import {
  arpltnInforUrl,
  formatDataGoKrServiceKey,
} from './airkorea-api.util';

describe('airkorea-api.util', () => {
  it('formatDataGoKrServiceKey encodes decoded keys', () => {
    expect(formatDataGoKrServiceKey('abc/def==')).toBe(
      encodeURIComponent('abc/def=='),
    );
  });

  it('formatDataGoKrServiceKey leaves pre-encoded keys', () => {
    const encoded = encodeURIComponent('abc/def==');
    expect(formatDataGoKrServiceKey(encoded)).toBe(encoded);
  });

  it('arpltnInforUrl targets ArpltnInforInqireSvc', () => {
    const url = arpltnInforUrl('getCtprvnRltmMesureDnsty', {
      serviceKey: 'test',
      returnType: 'json',
      sidoName: '서울',
      ver: '1.0',
    });
    expect(url).toContain('ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty');
    expect(url).not.toContain('MsrstnInfoInqireSvc');
  });
});
