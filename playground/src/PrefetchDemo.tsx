import { useState } from 'react';
import { Pending, useNavigation } from '@oddurs/steady/react';
import type { TaskContext } from '@oddurs/steady';

const copy: Record<string, string> = {
  Home: 'A head start, with a small budget.',
  Notes: 'The best wait is the one you never notice.',
  Library: 'Useful work, done a moment ahead of you.',
};

export function PrefetchDemo({
  transport,
}: {
  transport: (label: string, context: TaskContext) => Promise<string>;
}) {
  const [requests, setRequests] = useState(0);
  const [feedback, setFeedback] = useState(
    'Hover or focus a destination to warm it.',
  );
  const [warming, setWarming] = useState(false);
  const [intentEnabled, setIntentEnabled] = useState(true);
  const navigation = useNavigation(
    async (destination, context) => {
      setRequests((count) => count + 1);
      await transport(destination, context);
      return copy[destination]!;
    },
    {
      initial: { destination: 'Home', data: copy.Home! },
      prefetch: { ttlMs: 10_000, maxEntries: 2, maxConcurrent: 1 },
    },
  );

  async function warm(destination: string) {
    setWarming(true);
    setFeedback(`Warming ${destination.toLowerCase()}…`);
    const result = await navigation.prefetch(destination);
    setWarming(false);
    setFeedback(
      result.status === 'success'
        ? `${destination} is ready for its next visit.`
        : result.status === 'error'
          ? 'Warming failed. Opening the destination will try a fresh request.'
          : result.status === 'skipped' && result.reason === 'active'
            ? 'This destination is already loading.'
            : result.status === 'skipped'
              ? 'The prefetch budget is full. Navigation still works.'
              : 'Warming was cancelled.',
    );
  }

  return (
    <article
      className="experiment prefetch-experiment"
      aria-labelledby="prefetch-title"
    >
      <div className="prefetch-copy">
        <div className="panel-label">04 / GET THERE A LITTLE EARLIER</div>
        <h3 id="prefetch-title">Ready before you ask.</h3>
        <p>
          Hover or keyboard-focus a destination, wait for it to warm, then open
          it. Watch the request count stay still.
        </p>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={intentEnabled}
            onChange={(event) => setIntentEnabled(event.target.checked)}
          />{' '}
          Warm on hover and focus
        </label>
        <div className="prefetch-actions">
          <button
            className="condition-button"
            disabled={warming}
            onClick={() => {
              void warm('Notes');
            }}
          >
            Warm Notes explicitly
          </button>
          <button
            className="text-button"
            onClick={() => {
              navigation.invalidatePrefetch();
              setFeedback(
                'Warm entries cleared. The next visit fetches fresh data.',
              );
            }}
          >
            Clear warm entries
          </button>
        </div>
        <p className="prefetch-contract">
          Two entries. One speculative request at a time. Ten seconds of
          freshness. Each result is consumed once.
        </p>
      </div>
      <div className="prefetch-workspace">
        <div className="prefetch-metrics">
          <span>TRANSPORT REQUESTS</span>
          <output data-testid="prefetch-requests">{requests}</output>
        </div>
        <div
          className="prefetch-tabs"
          role="group"
          aria-label="Prefetched sections"
        >
          {['Notes', 'Library'].map((destination) => (
            <button
              key={destination}
              aria-pressed={navigation.selected === destination}
              onPointerEnter={(event) => {
                if (intentEnabled && event.pointerType === 'mouse')
                  void warm(destination);
              }}
              onFocus={() => {
                if (intentEnabled) void warm(destination);
              }}
              onClick={() => {
                void navigation.navigate(destination);
              }}
            >
              Open {destination}
            </button>
          ))}
        </div>
        <div className="prefetch-content" aria-busy={navigation.isPending}>
          <span data-testid="prefetch-current">{navigation.current}</span>
          <p>{navigation.data.data}</p>
        </div>
        <div
          className="prefetch-status"
          role="status"
          data-testid="prefetch-status"
        >
          {feedback}
        </div>
        <Pending className="prefetch-pending" state={navigation}>
          Opening {navigation.selected.toLowerCase()}…
        </Pending>
        {navigation.status === 'error' && (
          <div className="prefetch-error" role="alert">
            Couldn’t open this destination.{' '}
            <button
              className="text-button"
              onClick={() => {
                void navigation.retry();
              }}
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
