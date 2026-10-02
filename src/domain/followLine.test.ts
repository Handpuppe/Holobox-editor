import { describe, expect, it } from 'vitest';
import { CONCLUSION_NODE_ID } from './types';
import { followList } from './followLine';

describe('followList', () => {
  const ids = ['s1', 's2', 's3'];

  it('follows a line, including several lines onto one step', () => {
    expect(followList(ids, 's1', 's3', 'completed')).toEqual({ id: 's3', done: false });
    expect(followList(ids, 's2', 's3', 'completed')).toEqual({ id: 's3', done: false });
  });

  it('uses the next item in the list when there is no line', () => {
    expect(followList(ids, 's1', 'completed', 'completed')).toEqual({ id: 's2', done: false });
    expect(followList(ids, 's2', CONCLUSION_NODE_ID, CONCLUSION_NODE_ID)).toEqual({
      id: 's3',
      done: false,
    });
  });

  it('stays on the same question when the line points there', () => {
    expect(followList(ids, 's1', 's1', 'completed')).toEqual({ id: 's1', done: false });
  });

  it('ends when there is no line and no next item', () => {
    expect(followList(ids, 's3', 'completed', 'completed')).toEqual({ id: 's3', done: true });
  });
});
