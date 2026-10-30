import { describe, it, expect } from 'vitest';
import { applyTranslation, indexTranslations } from '@/lib/i18n/content-locale';

const base = {
  id: 'm1',
  title: 'What makes an organisation a cooperative',
  content_text: 'A cooperative is an autonomous association…',
  content_url: 'https://cdn.example/en/lesson.pdf',
  order_index: 2,
  is_mandatory: true,
};

describe('applyTranslation', () => {
  it('leaves the row untouched when there is no translation', () => {
    // An untranslated module must still render in the source language rather
    // than disappearing from the course.
    expect(applyTranslation(base, null, ['title', 'content_text'])).toBe(base);
    expect(applyTranslation(base, undefined, ['title', 'content_text'])).toBe(base);
  });

  it('replaces only the fields the translation actually carries', () => {
    const out = applyTranslation(
      base,
      { locale: 'hi', title: 'कोई संस्था सहकारी कब कहलाती है', content_text: null },
      ['title', 'content_text', 'content_url'],
    );
    expect(out.title).toBe('कोई संस्था सहकारी कब कहलाती है');
    // A partial translation keeps the source body instead of being discarded
    // wholesale or blanking the lesson.
    expect(out.content_text).toBe(base.content_text);
    expect(out.content_url).toBe(base.content_url);
    expect(out.translated_locale).toBe('hi');
  });

  it('treats empty string as untranslated, not as a translation to an empty value', () => {
    const out = applyTranslation(base, { locale: 'hi', title: '' }, ['title']);
    expect(out.title).toBe(base.title);
  });

  it('never touches fields outside the allow-list', () => {
    const out = applyTranslation(
      base,
      { locale: 'hi', title: 'शीर्षक', order_index: 99, is_mandatory: false } as any,
      ['title'],
    );
    // Structure belongs to the base row: a translation must not be able to
    // reorder a course or make a mandatory module optional.
    expect(out.order_index).toBe(2);
    expect(out.is_mandatory).toBe(true);
  });

  it('carries a translated asset url when one is provided', () => {
    const out = applyTranslation(
      base,
      { locale: 'hi', content_url: 'https://cdn.example/hi/lesson.pdf' },
      ['title', 'content_url'],
    );
    expect(out.content_url).toBe('https://cdn.example/hi/lesson.pdf');
    expect(out.title).toBe(base.title);
  });
});

describe('indexTranslations', () => {
  it('keys rows by the id of what they translate', () => {
    const map = indexTranslations(
      [
        { module_id: 'a', locale: 'hi', title: 'क' },
        { module_id: 'b', locale: 'hi', title: 'ख' },
      ],
      'module_id',
    );
    expect(map.get('a')?.title).toBe('क');
    expect(map.get('b')?.title).toBe('ख');
    expect(map.get('missing')).toBeUndefined();
  });

  it('survives an empty or absent result set', () => {
    expect(indexTranslations([], 'module_id').size).toBe(0);
    expect(indexTranslations(null, 'module_id').size).toBe(0);
  });
});
