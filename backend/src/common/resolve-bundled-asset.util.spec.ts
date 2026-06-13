import * as path from 'path';
import { resolveBundledAssetPath } from './resolve-bundled-asset.util';

describe('resolveBundledAssetPath', () => {
  it('watch 출력(dist/src/…)에서 dist/{module}/data JSON을 찾는다', () => {
    const watchModuleDir = path.join(
      process.cwd(),
      'dist',
      'src',
      'cache-hydration',
    );
    const resolved = resolveBundledAssetPath(
      watchModuleDir,
      'cache-hydration',
      'airkorea-stations.json',
    );
    expect(resolved).toBeTruthy();
    expect(resolved).toMatch(/airkorea-stations\.json$/);
  });

  it('소스 트리(src/…)에서도 찾는다', () => {
    const srcModuleDir = path.join(
      process.cwd(),
      'src',
      'cache-hydration',
    );
    const resolved = resolveBundledAssetPath(
      srcModuleDir,
      'cache-hydration',
      'airkorea-stations.json',
    );
    expect(resolved).toBeTruthy();
  });
});
