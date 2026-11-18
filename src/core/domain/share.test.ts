import { describe, expect, it } from 'vitest';
import { taskFromShare } from './share';

describe('taskFromShare', () => {
  it('uses the page title, keeps the link as notes', () => {
    expect(taskFromShare({ title: 'Diffusion Policy', url: 'https://arxiv.org/abs/2303.04137' })).toEqual({
      title: 'Diffusion Policy',
      description: 'https://arxiv.org/abs/2303.04137',
    });
  });
  it('finds a link inside the text (Chrome on Android)', () => {
    expect(taskFromShare({ text: 'Read this later https://example.com/a?b=1' })).toEqual({
      title: 'Read this later',
      description: 'https://example.com/a?b=1',
    });
  });
  it('falls back to the link as the title', () => {
    expect(taskFromShare({ text: 'https://example.com' })).toEqual({ title: 'https://example.com' });
  });
  it('plain text: first line is the title, the rest stays in notes', () => {
    expect(taskFromShare({ text: 'Buy milk\nand eggs' })).toEqual({
      title: 'Buy milk',
      description: 'Buy milk\nand eggs',
    });
  });
  it('nothing shared: nothing to add', () => {
    expect(taskFromShare({ title: ' ', text: '' })).toBeNull();
  });
});
