// WHY: the shell is decided here so the feature never reads it; the native shell has no map to open a stop sheet over.
import { SHELL } from '@/bootstrap/shell.service';
import { SearchScreen } from '@/features/search/SearchScreen';

const SHARED_MAP = SHELL === 'shared-map';

export default function SearchRoute() {
  return <SearchScreen listsStops={SHARED_MAP} opensBeneath={SHARED_MAP} />;
}
