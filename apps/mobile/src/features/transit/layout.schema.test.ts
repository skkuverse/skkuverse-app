/**
 * Transit tab layout: `GET /ui/home/transit`.
 *
 * `launch-{ko,en}.json` are skkuverse-server's contract fixtures
 * (`contracts/produced/fixtures/ui-transit.transitLayout/`, server `c30ecd0c`):
 * production captures of 2026-10-18 converted to the `marker` wire, every
 * subway row with a null subtitle, as each `_about` says. They carry `data`
 * only. `campus-tagged-ko.json` is the same body with the section campus tags
 * (server `1b348818`), which production serves since 2026-10-23.
 */
import { describe, it, expect } from 'vitest';
import { transitLayoutSchema } from './layout.schema';
import launchKo from './__fixtures__/launch-ko.json';
import launchEn from './__fixtures__/launch-en.json';
import campusTaggedKo from './__fixtures__/campus-tagged-ko.json';

/** The layout, or null when the payload is not one, as the hand parser answered. */
const parseTransitLayout = (raw: unknown) => {
  const result = transitLayoutSchema.safeParse(raw);
  return result.success ? result.data : null;
};

type RawItem = Record<string, unknown>;
type RawSection = Record<string, unknown> & { items: RawItem[] };

/** The Korean layout's data with its sections edited by `edit`. */
function koWith(edit: (sections: RawSection[]) => void): unknown {
  const data = structuredClone(launchKo.data) as { sections: RawSection[] };
  edit(data.sections);
  return data;
}

describe('parseTransitLayout', () => {
  it('reads the launch layout: three sections in the server order', () => {
    const layout = parseTransitLayout(launchKo.data);

    expect(layout?.version).toBe(1);
    expect(layout?.sections.map((s) => [s.id, s.title])).toEqual([
      ['campus', null],
      ['hssc', '인사캠'],
      ['nsc', '자과캠'],
    ]);
  });

  it('reads the items of a section, in order, a station and buses', () => {
    const hssc = parseTransitLayout(launchKo.data)?.sections[1];

    expect(hssc?.items.map((i) => i.id)).toEqual([
      'subway:hyehwa',
      'bus:hssc',
      'bus:jongro02',
      'bus:jongro07',
      'bus:jongro08',
    ]);
  });

  it('reads a station row by its slug, with its lines and the route it opens', () => {
    const station = parseTransitLayout(launchKo.data)?.sections[1].items[0];

    expect(station).toEqual({
      kind: 'subway',
      id: 'subway:hyehwa',
      stationId: 'hyehwa',
      title: '혜화역',
      subtitle: null,
      lines: [{ code: '4', name: '4호선', color: '00A5DE', marker: { text: '4', color: '007FAB' } }],
      action: { actionType: 'route', actionValue: '/subway?station=hyehwa' },
    });
  });

  it('reads a station with several lines, in the server order', () => {
    const data = koWith(([, , nsc]) => {
      // 정자, as the server serves it inside the commute-stations group.
      const group = nsc.items[2] as RawItem & { items: RawItem[] };
      nsc.items.push(group.items[0]);
    });

    const jeongja = parseTransitLayout(data)?.sections[2].items.find((i) => i.id === 'subway:jeongja');

    expect(jeongja?.kind === 'subway' ? jeongja.lines.map((l) => [l.code, l.color, l.marker]) : null).toEqual([
      ['D1', 'D4003B', { text: '신', color: 'D4003B' }],
      ['K1', 'F5A200', { text: '수', color: 'A26B00' }],
    ]);
  });

  it('reads the English markers as served: a named line keeps its Korean syllable', () => {
    const group = parseTransitLayout(launchEn.data)?.sections[2].items[2];
    const jeongja = group?.kind === 'group' ? group.items[0] : null;

    expect(jeongja?.kind === 'subway' ? jeongja.lines.map((l) => [l.name, l.marker.text]) : null).toEqual([
      ['Shinbundang Line', '신'],
      ['Suin–Bundang Line', '수'],
    ]);
  });

  it.each([
    ['no marker', (line: RawItem) => delete line.marker],
    ['an empty marker text', (line: RawItem) => (line.marker = { text: '', color: '0052A4' })],
    ['a marker text that is not a string', (line: RawItem) => (line.marker = { text: 1, color: '0052A4' })],
    ['a marker color that is not six hex digits', (line: RawItem) => (line.marker = { text: '1', color: '05A' })],
    ['a line color that is not six hex digits', (line: RawItem) => (line.color = '#0052A4')],
  ])('drops a line with %s alone, and a station row left with none', (_, edit) => {
    const data = koWith(([, , nsc]) => {
      const group = nsc.items[2] as RawItem & { items: RawItem[] };
      edit((group.items[0].lines as RawItem[])[0]);
      edit((nsc.items[0].lines as RawItem[])[0]);
    });

    const nsc = parseTransitLayout(data)?.sections[2];
    const group = nsc?.items.find((i) => i.kind === 'group');
    const jeongja = group?.kind === 'group' ? group.items.find((i) => i.id === 'subway:jeongja') : null;
    expect(jeongja?.kind === 'subway' ? jeongja.lines.map((l) => l.code) : null).toEqual(['K1']);
    expect(nsc?.items.map((i) => i.id)).not.toContain('subway:sungkyunkwan');
  });

  it('drops a station row with no readable line, and a broken line alone', () => {
    const data = koWith(([, hssc, nsc]) => {
      hssc.items[0].lines = [];
      const line = (nsc.items[0].lines as RawItem[])[0];
      nsc.items[0].lines = [{ ...line, color: undefined }, line];
    });

    const layout = parseTransitLayout(data);

    expect(layout?.sections[1].items.map((i) => i.id)).not.toContain('subway:hyehwa');
    const station = layout?.sections[2].items[0];
    expect(station?.kind === 'subway' ? station.lines.map((l) => l.code) : null).toEqual(['1']);
  });

  it('reads the commute-stations group: its header, its fold and its rows in order', () => {
    const nsc = parseTransitLayout(launchKo.data)?.sections[2];

    expect(nsc?.items.map((i) => i.id)).toEqual(['subway:sungkyunkwan', 'bus:commute', 'group:commute-stations']);
    const group = nsc?.items[2];
    expect(group).toMatchObject({
      kind: 'group',
      id: 'group:commute-stations',
      title: '통학버스 정류장 지하철',
      subtitle: '정자 · 잠실 · 도곡 · 강남 · 양재 · 광교중앙',
      icon: { type: 'subway', color: '8B95A1', text: '환승' },
      initialState: 'collapsed',
    });
    expect(group?.kind === 'group' ? group.items.map((i) => [i.kind, i.id, i.subtitle]) : null).toEqual([
      ['subway', 'subway:jeongja', null],
      ['subway', 'subway:jamsil', null],
      ['subway', 'subway:dogok', null],
      ['subway', 'subway:gangnam', null],
      ['subway', 'subway:yangjae', null],
      ['subway', 'subway:gwanggyo-jungang', null],
    ]);
    // A group folds on tap; it has nowhere to go.
    expect(group).not.toHaveProperty('action');
  });

  it('keeps an expanded group expanded, and reads a missing or unknown fold as collapsed', () => {
    const states = ['expanded', undefined, 'half'].map((initialState) => {
      const data = koWith(([, , nsc]) => {
        nsc.items[2].initialState = initialState;
      });
      const group = parseTransitLayout(data)?.sections[2].items[2];
      return group?.kind === 'group' ? group.initialState : null;
    });

    expect(states).toEqual(['expanded', 'collapsed', 'collapsed']);
  });

  it('drops a broken row of a group alone, and a group nested in a group', () => {
    const data = koWith(([, , nsc]) => {
      const group = nsc.items[2] as RawItem & { items: RawItem[] };
      group.items[0].lines = [];
      group.items.push({ ...group, id: 'group:nested' });
    });

    const group = parseTransitLayout(data)?.sections[2].items[2];
    expect(group?.kind === 'group' ? group.items.map((i) => i.id) : null).toEqual([
      'subway:jamsil',
      'subway:dogok',
      'subway:gangnam',
      'subway:yangjae',
      'subway:gwanggyo-jungang',
    ]);
  });

  it('drops a group left with no readable row, or with no title or icon', () => {
    const ids = [
      (g: RawItem & { items: RawItem[] }) => g.items.forEach((i) => (i.kind = 'taxi')),
      (g: RawItem) => (g.items = []),
      (g: RawItem) => delete g.title,
      (g: RawItem) => delete g.icon,
    ].map((edit) => {
      const data = koWith(([, , nsc]) => {
        edit(nsc.items[2] as RawItem & { items: RawItem[] });
      });
      return parseTransitLayout(data)?.sections[2].items.map((i) => i.id);
    });

    expect(ids).toEqual(Array(4).fill(['subway:sungkyunkwan', 'bus:commute']));
  });

  it('reads a bus row with its group id', () => {
    const bus = parseTransitLayout(launchKo.data)?.sections[0].items[0];

    expect(bus).toMatchObject({ kind: 'bus', groupId: 'campus', title: '인자셔틀' });
  });

  it('reads the English layout with the same ids', () => {
    const ko = parseTransitLayout(launchKo.data);
    const en = parseTransitLayout(launchEn.data);

    expect(en?.sections.map((s) => s.title)).toEqual([null, 'HSSC', 'NSC']);
    expect(en?.sections.flatMap((s) => s.items.map((i) => i.id))).toEqual(
      ko?.sections.flatMap((s) => s.items.map((i) => i.id)),
    );
  });

  it('drops an item of a kind this build does not know, alone', () => {
    const data = koWith(([campus]) => {
      campus.items.push({ ...campus.items[0], kind: 'taxi', id: 'taxi:share' });
    });

    expect(parseTransitLayout(data)?.sections[0].items.map((i) => i.id)).toEqual(['bus:campus']);
  });

  it('drops a section of a type this build does not know, alone', () => {
    const data = koWith((sections) => {
      sections.splice(1, 0, { type: 'route_compare', id: 'compare', items: [] });
    });

    expect(parseTransitLayout(data)?.sections.map((s) => s.id)).toEqual(['campus', 'hssc', 'nsc']);
  });

  it('drops an item missing its referent or with an unknown action type', () => {
    const data = koWith(([, hssc]) => {
      delete hssc.items[1].groupId;
      (hssc.items[2].action as RawItem).actionType = 'teleport';
    });

    expect(parseTransitLayout(data)?.sections[1].items.map((i) => i.id)).toEqual([
      'subway:hyehwa',
      'bus:jongro07',
      'bus:jongro08',
    ]);
  });

  it('drops a section left with no items', () => {
    const data = koWith(([campus]) => {
      campus.items[0].kind = 'taxi';
    });

    expect(parseTransitLayout(data)?.sections.map((s) => s.id)).toEqual(['hssc', 'nsc']);
  });

  it('keeps a section whose title is null, with no title', () => {
    const data = koWith(([campus]) => {
      campus.title = null;
    });

    const [first] = parseTransitLayout(data)?.sections ?? [];
    expect(first).toMatchObject({ id: 'campus', title: null });
    expect(first?.items.map((i) => i.id)).toEqual(['bus:campus']);
  });

  it('reads a missing or empty title as no title, not as a reason to drop the section', () => {
    const data = koWith(([campus, hssc]) => {
      delete campus.title;
      hssc.title = '';
    });

    expect(parseTransitLayout(data)?.sections.map((s) => [s.id, s.title])).toEqual([
      ['campus', null],
      ['hssc', null],
      ['nsc', '자과캠'],
    ]);
  });

  it('reads a missing subtitle as null', () => {
    const data = koWith(([campus]) => {
      campus.items[0].subtitle = null;
    });

    expect(parseTransitLayout(data)?.sections[0].items[0].subtitle).toBeNull();
  });

  it('reads each section campus as served, and none as both campuses', () => {
    // Act
    const layout = parseTransitLayout(campusTaggedKo.data);

    // Assert
    expect(layout?.sections.map((s) => [s.id, s.campus])).toEqual([
      ['campus', null],
      ['hssc', 'hssc'],
      ['nsc', 'nsc'],
    ]);
  });

  it('reads an untagged layout as every section on both campuses', () => {
    // Act
    const layout = parseTransitLayout(launchKo.data);

    // Assert
    expect(layout?.sections.map((s) => s.campus)).toEqual([null, null, null]);
  });

  it('reads a campus this build does not know as both campuses, keeping the section', () => {
    // Arrange
    const data = koWith(([, hssc, nsc]) => {
      hssc.campus = 'gangnam';
      nsc.campus = 7;
    });

    // Act
    const layout = parseTransitLayout(data);

    // Assert
    expect(layout?.sections.map((s) => [s.id, s.campus])).toEqual([
      ['campus', null],
      ['hssc', null],
      ['nsc', null],
    ]);
  });

  it('refuses a payload that is not a layout, so the tab shows an error', () => {
    expect(parseTransitLayout(null)).toBeNull();
    expect(parseTransitLayout({ version: 1 })).toBeNull();
    expect(parseTransitLayout([])).toBeNull();
  });
});
