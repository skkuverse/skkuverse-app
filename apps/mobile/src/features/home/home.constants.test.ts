import { describe, it, expect } from 'vitest';
import { translations } from '../../../../../packages/shared/src/i18n/translations';
import { mockHomeLayout } from './home.constants';
import { homeLayoutSchema } from './home.schema';

/**
 * The mock stands in for the tab's future endpoint, so it must be a layout that
 * endpoint could serve: re-serialized to the wire shape (actions flattened) and
 * parsed back, nothing may be lost.
 */
describe('mockHomeLayout', () => {
  it.each(['ko', 'en', 'zh'] as const)('is a layout the parser accepts unchanged (%s)', (lang) => {
    const layout = mockHomeLayout((key) => translations[lang][key]);
    const wire = {
      ...layout,
      sections: layout.sections.map((section) =>
        section.type === 'banner_carousel'
          ? {
              ...section,
              items: section.items.map((item) =>
                item.type === 'image' && item.action
                  ? { ...item, action: undefined, ...item.action }
                  : item,
              ),
            }
          : section.type === 'tile_grid'
            ? {
                ...section,
                tiles: section.tiles.map((tile) =>
                  tile.kind === 'link' ? { ...tile, action: undefined, ...tile.action } : tile,
                ),
              }
            : section,
      ),
    };
    expect(homeLayoutSchema.parse(JSON.parse(JSON.stringify(wire)))).toEqual(layout);
  });
});
