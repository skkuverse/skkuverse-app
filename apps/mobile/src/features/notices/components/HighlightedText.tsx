import { Text } from 'react-native';
import { wantedSans } from '@skkuverse/shared';
import { Txt, createThemedStyles, type TxtProps } from '@skkuverse/sds';
import { highlightMatches } from '../highlight.rules';

type Props = Omit<TxtProps, 'children'> & {
  text: string;
  query: string | undefined;
};

export function HighlightedText({ text, query, ...txtProps }: Props) {
  const styles = useStyles();
  return (
    <Txt {...txtProps}>
      {query
        ? highlightMatches(text, query).map((seg, i) =>
            seg.matched ? (
              // eslint-disable-next-line sds/no-rn-text -- a span inside the title's Txt inherits its step; Txt has no inherit mode yet
              <Text key={i} style={styles.highlightedSegment}>
                {seg.text}
              </Text>
            ) : (
              seg.text
            ),
          )
        : text}
    </Txt>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  // QUIRK(android): each WantedSans weight is its own file, so the family is set here; inheriting the
  // title's file and raising the weight finds no `_bold` variant and falls back to the system font.
  highlightedSegment: {
    color: color.fg.informative,
    ...wantedSans('700'),
  },
}));
