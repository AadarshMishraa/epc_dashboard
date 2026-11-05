import {
  createContext,
  createLogger,
  parseCorrelationId,
  parseTenantId,
  systemClock,
  type CorrelationId,
  type TenantId,
} from '@gx/core';
import { describe, expect, it } from 'vitest';
import { MemoryLogSink } from '../index.ts';

const TENANT = parseTenantId('0190f3e2-7a1b-7c3d-8e4f-0000000000a1') as TenantId;
const correlationId = parseCorrelationId('req-9') as CorrelationId;

function logger(sink: MemoryLogSink, failures: unknown[] = []) {
  const context = createContext({
    tenantId: TENANT,
    actor: { kind: 'anonymous' },
    correlationId,
    clock: systemClock,
  });
  return createLogger(context, { sink, onFailure: (cause) => failures.push(cause) });
}

describe('MemoryLogSink', () => {
  it('keeps raw lines and parses them into records', () => {
    const sink = new MemoryLogSink();
    const log = logger(sink);
    log.info('lead.created', { note: 'call 9876543210' });
    log.warn('lead.duplicate');
    expect(sink.lines).toHaveLength(2);
    expect(sink.lines[0]).not.toContain('9876543210');
    expect(sink.ofEvent('lead.created')).toHaveLength(1);
    expect(sink.records().map((record) => record.correlation_id)).toEqual(['req-9', 'req-9']);
  });

  it('returns a copy of its lines and can be cleared', () => {
    const sink = new MemoryLogSink();
    logger(sink).info('a.b');
    const lines = sink.lines as string[];
    lines.push('forged');
    expect(sink.lines).toHaveLength(1);
    sink.clear();
    expect(sink.lines).toHaveLength(0);
  });

  it('rejects a multi-line write and a line that is not a JSON object', () => {
    const sink = new MemoryLogSink();
    expect(() => {
      sink.write('a\nb');
    }).toThrow(TypeError);
    sink.write('[1]');
    expect(() => sink.records()).toThrow('not a JSON object');
  });

  it('fails every write after failWith, and the logger reports it', () => {
    const sink = new MemoryLogSink();
    const failures: unknown[] = [];
    const failure = new Error('disk full');
    sink.failWith(failure);
    logger(sink, failures).info('a.b');
    expect(failures).toEqual([failure]);
    sink.failWith(undefined);
    logger(sink).info('a.b');
    expect(sink.lines).toHaveLength(1);
  });
});
