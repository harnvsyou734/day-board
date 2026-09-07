'use client';

type Props = {
  state: 'idle' | 'loading' | 'ready' | 'error';
  body: string | null;
  generatedAt: string | null;
  onRefresh: () => void;
  onClose: () => void;
  inline: boolean;
};

/**
 * The model returns plain text and it is rendered as plain text -- paragraphs
 * split on blank lines, no markdown parsing anywhere. If the model emits a
 * stray asterisk it shows as an asterisk, which is the honest thing.
 */
function paragraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function Content({ state, body, generatedAt, onRefresh }: Omit<Props, 'onClose' | 'inline'>) {
  if (state === 'loading') {
    return <p className="sheetPara">Reading your week&hellip;</p>;
  }

  if (state === 'error') {
    return (
      <>
        <p className="sheetPara">Couldn&rsquo;t write the summary.</p>
        <button type="button" className="linkBtn" onClick={onRefresh}>
          Try again
        </button>
      </>
    );
  }

  if (!body) {
    return <p className="sheetPara">Nothing to summarize yet.</p>;
  }

  const when = generatedAt
    ? new Date(generatedAt).toLocaleString('en-GB', {
        timeZone: 'Asia/Bangkok',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : null;

  return (
    <>
      {when ? <p className="sheetMeta">Written {when}</p> : null}
      {paragraphs(body).map((part, index) => (
        <p className="sheetPara" key={index}>
          {part}
        </p>
      ))}
      <div className="sheetActions">
        {/* Cached for the week, so this is the only thing that spends a
            second API call. */}
        <button type="button" className="sheetBtn" onClick={onRefresh}>
          Write it again
        </button>
      </div>
    </>
  );
}

export default function SummaryView(props: Props) {
  const { inline, onClose } = props;

  if (inline) {
    return (
      <div className="summaryPanel pane" aria-label="This week">
        <Content {...props} />
      </div>
    );
  }

  return (
    <div
      className="scrim"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-label="This week">
        <div className="sheetTitle">This week</div>
        <Content {...props} />
        <div className="sheetActions" style={{ marginTop: 6 }}>
          <button type="button" className="sheetBtn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
