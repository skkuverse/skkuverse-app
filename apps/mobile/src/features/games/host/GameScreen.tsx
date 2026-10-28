import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { AppState, BackHandler, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useIsFocused } from 'expo-router/react-navigation';
import { ResultSection, Txt } from '@skkuverse/sds';
import { useT, SdsSpacing } from '@skkuverse/shared';
import type { GameRect } from '@skkuverse/miniapp/protocol';
import { useViewTracking } from '@/platform/analytics';
import type { EntrySource } from '@/platform/analytics.rules';
import { bumpUsage } from '@/platform/usage-counters';
import { playGameHaptic } from '@/platform/haptics';
import { logHandledError } from '@/platform/crashlytics';
import { useUserProfile } from '@/features/profile/useUserProfile';
import type { GameId } from '../games.constants';
import type { GamePage } from '../games.types';
import { GameOverlay } from '../GameOverlay';
import { FIRST_PARTY_GAMES, scoreText } from '../registry.rules';
import { isBetter } from '../leaderboard.rules';
import { openLeaderboard } from '../games.service';
import { LeaderboardTopSection } from '../components/LeaderboardTopSection';
import { GameActions } from './components/GameActions';
import { RankPromptSheet } from './components/RankPromptSheet';
import { ResultPanel } from './components/ResultPanel';
import { ReviveOffer } from './components/ReviveOffer';
import { ScoreHeader } from './components/ScoreHeader';
import {
  acceptsOver,
  canRetrySubmit,
  initialPageRun,
  initialSession,
  isFinal,
  pageRunAfter,
  sessionReducer,
  type GamePageMessage,
} from './host.rules';
import { GameShell, type GameShellHandle } from './components/GameShell';
import { useAutoSubmit } from './components/useAutoSubmit';
import { usePlayTracking } from './components/usePlayTracking';
import { useRankPrompt } from './components/useRankPrompt';
import { useResultLine } from './components/useResultLine';
import { useReviveOffer } from './components/useReviveOffer';
import { useGameScreen } from './useGameScreen';

const CONTROLS_MS = 2500;
/** WHY: an older stamp is re-taken at the first tap, so a long run never starts on a stale one. */
const REARM_AFTER_MS = 10 * 60 * 1000;
const PANEL_DELAY_MS = 600;
const BOARD_LIMIT = 5;
const NO_BEST = 0;
const SETTLE_VIEW_MS = 1800;
const ACTION_SIZE = 40;
/** WHY: a reset the page has not acknowledged this soon is sent once more. */
const RESET_ACK_MS = 1000;

/**
 * WHY: the page plays; this screen owns what a run is worth (the stamp, the best, revives, the board), so a game
 * supplies only its FIRST_PARTY_GAMES entry.
 */
export function GameScreen({ gameId, page, source }: { gameId: GameId; page: GamePage; source: EntrySource }) {
  // WHY: logged as a mini app's shell logs it, so one query on the shared registry id reads mini apps and games
  // together.
  useViewTracking('game', gameId, source, (id) => ({
    nth: bumpUsage(`game_open:${id}`),
    nth_all: bumpUsage('game_open'),
  }));
  const game = FIRST_PARTY_GAMES[gameId];
  const ranked = game.leaderboard !== null;
  const router = useRouter();
  const { t, tpl } = useT();
  const insets = useSafeAreaInsets();
  const shell = useRef<GameShellHandle>(null);
  const [session, dispatch] = useReducer(sessionReducer, undefined, initialSession);
  // WHY: written in a layout effect, which runs before a page message, the watchdog, BACK or leaving can read it.
  const sessionRef = useRef(session);
  useLayoutEffect(() => {
    sessionRef.current = session;
  });
  const { uid, isAnonymous, email, readUid, startRun, getHighScore, setHighScore, getSoundOn, setSoundOn } = useGameScreen();
  const [hi, setHi] = useState(() => getHighScore(gameId));
  const [soundOn, setSoundOnState] = useState(getSoundOn);
  const [newBest, setNewBest] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [panelVisible, setPanelVisible] = useState(false);
  const [appActive, setAppActive] = useState(true);

  const profile = useUserProfile(uid && !isAnonymous ? uid : null);
  const auto = useAutoSubmit({ gameId, session, dispatch, profile });
  const { logGame, startPlay, endPlay } = usePlayTracking({ gameId, source, session });
  const revive = useReviveOffer({ revives: game.revives, session, sessionRef, dispatch, shell, logGame });
  const [stageRect, setStageRect] = useState<GameRect | null>(null);

  // WHY: the stamp goes out before the first tap, so it never postdates the run it belongs to. A game without a
  // board stamps nothing.
  const armed = useRef<{ uid: string; at: number } | null>(null);
  const arm = useCallback(() => {
    const current = readUid();
    if (!current || !ranked) return;
    const id = startRun(current, gameId, (err) => logHandledError('games/start-run', err));
    armed.current = { uid: current, at: Date.now() };
    dispatch({ type: 'runArmed', run: { id, uid: current } });
  }, [gameId, ranked, readUid, startRun]);
  // WHY: re-taken at the first tap only when it cannot serve: nobody was signed in, someone else is now, or it is
  // too old.
  const ensureArmed = useCallback(() => {
    const current = readUid();
    const a = armed.current;
    if (!a || a.uid !== current || Date.now() - a.at > REARM_AFTER_MS) arm();
  }, [arm, readUid]);

  // WHY: without the page's acknowledgement it would sit on its result under the host's title with no way out.
  const awaitingReset = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearResetWait = () => {
    if (awaitingReset.current) clearTimeout(awaitingReset.current);
    awaitingReset.current = null;
  };
  useEffect(() => clearResetWait, []);

  const toTitle = () => {
    const s = sessionRef.current;
    if (s.phase === 'crashed' && s.over) {
      // WHY: settle from a snapshot first, since the reset below clears it.
      const finalized = isFinal(s) ? s : sessionReducer(s, { type: 'finalize' });
      auto.settleNow(finalized);
    }
    dispatch({ type: 'restart' });
    setNewBest(false);
    auto.resetDetour();
    arm();
    shell.current?.send({ type: 'reset' });
    clearResetWait();
    awaitingReset.current = setTimeout(() => {
      awaitingReset.current = null;
      shell.current?.send({ type: 'reset' });
    }, RESET_ACK_MS);
  };

  const { prompt, offerAgain, onNext, onAccept, onLater } = useRankPrompt({
    sessionRef,
    dispatch,
    needsFor: auto.needsFor,
    signIn: auto.signIn,
    pickNickname: auto.pickNickname,
    logGame,
    toTitle,
  });

  // WHY: a result is taken only for a run the page started, and once.
  const pageRun = useRef(initialPageRun);

  const onMessage = useCallback(
    (m: GamePageMessage) => {
      const accepted = m.type !== 'game:over' || acceptsOver(pageRun.current);
      pageRun.current = pageRunAfter(pageRun.current, m);
      if (!accepted) return;
      if (m.type === 'game:ready' || (m.type === 'game:phase' && m.phase === 'ready')) clearResetWait();
      dispatch({ type: 'page', message: m });
      switch (m.type) {
        case 'game:ready':
          shell.current?.send({ type: 'init', hi: getHighScore(gameId), sound: game.sound ? getSoundOn() : null });
          if (sessionRef.current.phase !== 'crashed') arm();
          break;
        case 'game:start':
          ensureArmed();
          setShowControls(true);
          startPlay();
          break;
        case 'game:over': {
          endPlay(m);
          const best = getHighScore(gameId);
          if (m.score > 0 && (best === NO_BEST || isBetter(game.score.order, m.score, best))) {
            setHighScore(gameId, m.score);
            setHi(m.score);
            setNewBest(true);
            offerAgain();
            logGame('new_best');
          }
          break;
        }
        case 'game:haptic':
          playGameHaptic(m.style);
          break;
      }
    },
    [arm, ensureArmed, gameId, game.score.order, game.sound, logGame, startPlay, endPlay, offerAgain, getHighScore, getSoundOn, setHighScore],
  );

  useEffect(() => {
    if (!showControls) return;
    const id = setTimeout(() => setShowControls(false), CONTROLS_MS);
    return () => clearTimeout(id);
  }, [showControls]);

  // WHY: dropped during render, so the next crash waits for its splash again.
  const crashShown = session.phase === 'crashed' && !!session.over;
  if (!crashShown && panelVisible) setPanelVisible(false);
  useEffect(() => {
    if (!crashShown) return;
    const id = setTimeout(() => setPanelVisible(true), PANEL_DELAY_MS);
    return () => clearTimeout(id);
  }, [crashShown, session.over]);

  // WHY: a sheet over the game leaves the page visible and running, so losing focus pauses a run.
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) shell.current?.send({ type: 'pause' });
  }, [focused]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      setAppActive(state === 'active');
      if (state !== 'active') shell.current?.send({ type: 'pause' });
    });
    return () => sub.remove();
  }, []);

  const toggleSound = () => {
    const on = !soundOn;
    logGame('sound_toggle', on ? 'on' : 'off');
    setSoundOn(on);
    setSoundOnState(on);
    shell.current?.send({ type: 'sound', on });
  };

  // WHY: back from a detour, "next" was already pressed, so the game moves on once the line has slid in, or
  // at once if the player backed out. A retryable failure holds the screen, since the retry lives only here.
  const { detour, resetDetour, needsFor } = auto;
  const toTitleLater = useEffectEvent(toTitle);
  useEffect(() => {
    if (detour.state !== 'back' || !focused) return;
    if (detour.runId !== session.run?.id) {
      resetDetour();
      return;
    }
    const status = session.submission.status;
    const settled = status === 'submitted' || status === 'notImproved' || (status === 'failed' && !canRetrySubmit(session));
    const stuck = status === 'idle' && detour.step !== null && needsFor(session) === detour.step;
    if (!settled && !stuck) return;
    const id = setTimeout(
      () => {
        resetDetour();
        toTitleLater();
      },
      settled ? SETTLE_VIEW_MS : 0,
    );
    return () => clearTimeout(id);
  }, [detour, focused, session, needsFor, resetDetour]);

  // WHY: a record set just before closing is not lost.
  const navigation = useNavigation();
  const settleNow = auto.settleNow;
  useEffect(
    () =>
      navigation.addListener('beforeRemove', () => {
        const s = sessionRef.current;
        if (s.phase === 'crashed' && s.over) settleNow(isFinal(s) ? s : sessionReducer(s, { type: 'finalize' }));
      }),
    [navigation, settleNow],
  );

  // WHY: iOS turns the edge swipe off here, and Android BACK is the same accidental exit, so mid-run it pauses
  // a game that pauses (a second BACK leaves) and gives up one that cannot. Only while focused: the Hall of
  // Fame over the game has BACK of its own.
  const pauses = game.pauses;
  useFocusEffect(
    useCallback(() => {
      if (!pauses) return;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (sessionRef.current.phase !== 'running') return false;
        shell.current?.send({ type: 'pause' });
        return true;
      });
      return () => sub.remove();
    }, [pauses]),
  );

  const openBoard = () => {
    logGame('board_open');
    openLeaderboard(router, gameId, 'game');
  };
  const close = () => {
    const phase = sessionRef.current.phase;
    logGame(phase === 'running' || phase === 'paused' ? 'close_midrun' : 'close', phase);
    router.back();
  };

  const over = session.over;
  const line = useResultLine({ gameId, session, panelVisible, myBest: auto.myBest, uid, email, profile });

  // WHY: retryable only while its run is on screen; "next" or leaving drops it, and nothing is kept.
  const retrying = session.submission.status === 'retrying';
  const showRetry = retrying || canRetrySubmit(session);
  const retrySubmit = () => {
    logGame('submit_retry');
    auto.retry();
  };

  const offerShown = session.offer === 'open' || session.offer === 'watching' || session.offer === 'closed';
  const showOffer = game.revives && !!over && over.revivesLeft > 0 && offerShown;

  return (
    <View style={[styles.root, { backgroundColor: game.background }]}>
      {/*
        WHY: each game paints a light top in its own fixed palette in both schemes, so the clock stays dark over
        it.
      */}
      {/* eslint-disable-next-line sds/no-fixed-scheme -- the status bar sits on the game page's fixed light top, not on an app surface */}
      <StatusBar style="dark" />
      {/*
        QUIRK(android): edge to edge, the window is not resized for the keyboard, so a typing game's web view
        shrinks itself here. iOS needs nothing, since WebKit shrinks the visual viewport.
      */}
      <KeyboardAvoidingView
        style={styles.stage}
        behavior="height"
        enabled={game.keyboard && Platform.OS === 'android'}
      >
        <GameShell
          ref={shell}
          page={page}
          background={game.background}
          keyboard={game.keyboard}
          onMessage={onMessage}
          onLayout={setStageRect}
          onLeave={close}
        />
      </KeyboardAvoidingView>
      <GameOverlay gameId={gameId} phase={session.phase} hi={hi} showControls={showControls} rect={stageRect} />

      {panelVisible && over && (
        <ResultPanel
          score={
            <ScoreHeader
              headline={t(game.headline(over))}
              score={over.score}
              best={hi}
              format={game.score.format}
              unit={game.score.unitKey ? t(game.score.unitKey) : undefined}
              details={over.stats && game.details ? game.details(over.stats, tpl) : undefined}
              isNewBest={newBest}
            />
          }
          board={
            ranked ? (
              <LeaderboardTopSection
                gameId={gameId}
                limit={BOARD_LIMIT}
                me={line.me}
                footer={
                  showRetry ? (
                    <ResultSection
                      size="medium"
                      description={t('game.submitFailed')}
                      primaryActionProps={{ children: t('common.retry'), onPress: retrySubmit, loading: retrying }}
                    />
                  ) : (
                    line.note && (
                      <Txt typography="t3" fontWeight="semibold" color="brand" style={styles.note}>
                        {line.note}
                      </Txt>
                    )
                  )
                }
              />
            ) : undefined
          }
          offer={
            showOffer ? (
              <ReviveOffer
                offer={session.offer === 'open' || session.offer === 'watching' ? session.offer : 'closed'}
                enabled={revive.enabled}
                paused={!appActive || !focused}
                onRevive={revive.onRevive}
                onExpire={revive.onExpire}
              />
            ) : undefined
          }
          onNext={onNext}
          scrim={game.scrim}
          topInset={insets.top + ACTION_SIZE + 20}
        />
      )}
      <GameActions
        top={insets.top + 8}
        soundOn={game.sound ? soundOn : null}
        ranked={ranked}
        onToggleSound={toggleSound}
        onOpenBoard={openBoard}
        onClose={close}
      />
      {prompt && over && (
        <RankPromptSheet
          open
          variant={prompt.variant}
          score={scoreText(game, over.score, t)}
          busy={prompt.busy}
          error={prompt.error}
          onAccept={onAccept}
          onLater={onLater}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  stage: { flex: 1 },
  note: { textAlign: 'center', marginTop: SdsSpacing.x1 },
});
