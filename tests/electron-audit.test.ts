import { describe, expect, it } from 'vitest';
// @ts-expect-error Standalone npm audit script with a JSON boundary.
import { assertElectronAudit } from '../scripts/check-electron-audit.mjs';

describe('shipped Electron dependency audit', () => {
  it('blocks an Electron advisory even though Electron is a dev dependency', () => {
    expect(() => assertElectronAudit({ auditReportVersion: 2, vulnerabilities: { electron: { severity: 'high', nodes: ['node_modules/electron'] } } })).toThrow('shipped Electron');
  });
  it('keeps unrelated build-tool advisories separate from the shipped runtime check', () => {
    expect(() => assertElectronAudit({ auditReportVersion: 2, vulnerabilities: { 'http-cache-semantics': { severity: 'high' } } })).not.toThrow();
    expect(() => assertElectronAudit({ auditReportVersion: 2, vulnerabilities: {} })).not.toThrow();
  });
  it.each([null, {}, { error: { code: 'ENOAUDIT' } }, { auditReportVersion: 2, vulnerabilities: 'invalid' }, { auditReportVersion: 2, vulnerabilities: [] }, { auditReportVersion: 2, vulnerabilities: {}, error: { code: 'ENOTFOUND' } }])('fails closed when the audit request fails: %s', report => {
    expect(() => assertElectronAudit(report)).toThrow('valid dependency audit');
  });
});
