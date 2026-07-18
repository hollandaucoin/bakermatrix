import React, { useEffect, useMemo, useRef, useState } from 'react';
import ConfirmPopup from '../components/ConfirmPopup.js';
import UnsavedChangesPopup from '../components/UnsavedChangesPopup.js';
import ToastContainer from '../components/ToastContainer.js';
import { useNavigationGuard } from '../context/NavigationGuardContext.js';
import {
  compareRollCallNames,
  createRollCallFile,
  deriveBreakName,
  downloadStoryText,
  fetchRollCallCapabilities,
  fetchRollCallFiles,
  fetchRollCallStories,
  generateRollCallPowerpoint,
  generateRollCallStory,
  normalizeRollCallName,
  parseParenthesisLines,
  parseRollCallCsv,
  updateRollCallStory,
} from '../util/rollCall.js';

const formatSavedAt = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const BreakNameSelect = ({ names, value, onChange }) => {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const filteredNames = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return names;
    return names.filter((name) => name.toLowerCase().includes(query));
  }, [names, search]);

  return (
    <div style={styles.selectWrap}>
      <input
        type="text"
        value={open ? search : (value || '')}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setSearch(value || '');
          setOpen(true);
        }}
        onBlur={() => {
          setTimeout(() => setOpen(false), 150);
        }}
        placeholder="Search for break name..."
        style={styles.input}
      />
      {open && (
        <div style={styles.dropdown}>
          {filteredNames.length === 0 ? (
            <div style={styles.dropdownEmpty}>No matching names</div>
          ) : (
            filteredNames.map((name) => (
              <button
                key={name}
                type="button"
                style={{
                  ...styles.dropdownItem,
                  ...(value === name ? styles.dropdownItemActive : {}),
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(name);
                  setSearch('');
                  setOpen(false);
                }}
              >
                {name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const NameChecklist = ({ csvNames, parsedNames }) => {
  const [showMissing, setShowMissing] = useState(false);
  const [showExtra, setShowExtra] = useState(false);
  const comparison = useMemo(
    () => compareRollCallNames(csvNames, parsedNames),
    [csvNames, parsedNames]
  );

  if (csvNames.length === 0) {
    return null;
  }

  const { missing, extra, csvCount, parsedCount, isCompleteMatch } = comparison;
  const matchedCount = csvCount - missing.length;

  return (
    <div style={styles.checklist}>
      <div
        style={{
          ...styles.checklistBanner,
          ...(isCompleteMatch ? styles.checklistBannerSuccess : styles.checklistBannerWarning),
        }}
      >
        <span style={styles.checklistBannerTitle}>
          {isCompleteMatch ? 'All delegates matched' : 'Delegate mismatch'}
        </span>
        <span style={styles.checklistBannerMeta}>
          {matchedCount} of {csvCount} CSV names in script · {parsedCount} names in parentheses
        </span>
      </div>

      {missing.length > 0 && (
        <div style={styles.checklistSection}>
          <button
            type="button"
            style={styles.checklistToggle}
            onClick={() => setShowMissing((open) => !open)}
          >
            {missing.length} missing from script {showMissing ? '▾' : '▸'}
          </button>
          {showMissing && (
            <ul style={styles.checklistList}>
              {missing.map((name, index) => (
                <li key={`missing-${index}-${name}`}>{name}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {extra.length > 0 && (
        <div style={styles.checklistSection}>
          <button
            type="button"
            style={styles.checklistToggle}
            onClick={() => setShowExtra((open) => !open)}
          >
            {extra.length} in script but not in CSV {showExtra ? '▾' : '▸'}
          </button>
          {showExtra && (
            <ul style={styles.checklistList}>
              {extra.map((name, index) => (
                <li key={`extra-${name}-${index}`}>{name}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

const RollCallPage = () => {
  const [savedFiles, setSavedFiles] = useState([]);
  const [selectedFileId, setSelectedFileId] = useState('');
  const [savedStories, setSavedStories] = useState([]);
  const [selectedStoryId, setSelectedStoryId] = useState('');
  const [csvNames, setCsvNames] = useState([]);
  const [csvText, setCsvText] = useState('');
  const [csvFileName, setCsvFileName] = useState('');
  const fileInputRef = useRef(null);
  const [storyText, setStoryText] = useState('');
  const [breakName, setBreakName] = useState('');
  const [capabilities, setCapabilities] = useState({ claudeStory: false, generateScript: false });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isParsingCsv, setIsParsingCsv] = useState(false);
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [isSavingScript, setIsSavingScript] = useState(false);
  const [isGeneratingDeck, setIsGeneratingDeck] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState({ story: '', breakName: '' });
  const [pendingLocalAction, setPendingLocalAction] = useState(null);

  const {
    registerGuard,
    pendingNavigation,
    clearPendingNavigation,
    completePendingNavigation,
  } = useNavigationGuard();

  const parsedNames = useMemo(() => parseParenthesisLines(storyText), [storyText]);

  const hasUnsavedChanges = useMemo(() => {
    if (!selectedStoryId) return false;
    return storyText !== savedSnapshot.story || breakName !== savedSnapshot.breakName;
  }, [selectedStoryId, storyText, breakName, savedSnapshot]);

  const breakWarnings = useMemo(() => {
    if (!breakName.trim()) return [];

    const warnings = [];
    const parsedSet = new Set(parsedNames.map(normalizeRollCallName));

    if (!parsedSet.has(normalizeRollCallName(breakName))) {
      warnings.push('The break name is not in the script (no matching parenthesis-wrapped name).');
    }

    const derivedBreak = deriveBreakName(storyText);
    if (storyText.trim() && !derivedBreak) {
      warnings.push('No "ROLL CALL, MT. BAKER 2026" line found in the script.');
    } else if (derivedBreak && normalizeRollCallName(derivedBreak) !== normalizeRollCallName(breakName)) {
      warnings.push(`The script places the ROLL CALL reveal after (${derivedBreak}), not (${breakName}).`);
    }

    return warnings;
  }, [breakName, parsedNames, storyText]);

  const applyFile = (file) => {
    setSelectedFileId(file._id);
    setCsvText(file.csvText || '');
    setCsvNames(file.sourceNames || []);
    setCsvFileName(file.fileName || '');
  };

  const applyStory = (story) => {
    setSelectedStoryId(story._id);
    const storyValue = story.story || '';
    const breakValue = story.breakName || '';
    setStoryText(storyValue);
    setBreakName(breakValue);
    setLastSaved(story.updatedAt ? new Date(story.updatedAt) : null);
    setSavedSnapshot({ story: storyValue, breakName: breakValue });
  };

  const clearStoryState = () => {
    setSelectedStoryId('');
    setStoryText('');
    setBreakName('');
    setLastSaved(null);
    setSavedSnapshot({ story: '', breakName: '' });
  };

  const loadStoriesForFile = async (fileId) => {
    if (!fileId) {
      setSavedStories([]);
      return [];
    }
    const stories = await fetchRollCallStories(fileId);
    setSavedStories(stories);
    return stories;
  };

  useEffect(() => {
    const loadPage = async () => {
      try {
        const [caps, files] = await Promise.all([
          fetchRollCallCapabilities(),
          fetchRollCallFiles(),
        ]);
        setCapabilities(caps);
        setSavedFiles(files);

        if (files.length > 0) {
          applyFile(files[0]);
          const stories = await loadStoriesForFile(files[0]._id);
          if (stories.length > 0) {
            applyStory(stories[0]);
          }
        }
      } catch (err) {
        console.error('Error loading roll call page:', err);
        setError(err.message || 'Failed to load roll call data');
      } finally {
        setIsLoading(false);
      }
    };

    loadPage();
  }, []);

  useEffect(() => {
    return registerGuard({ hasUnsavedChanges });
  }, [hasUnsavedChanges, registerGuard]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const selectFile = async (fileId) => {
    const file = savedFiles.find((entry) => entry._id === fileId);
    if (!file) return;

    setError('');
    applyFile(file);
    const stories = await loadStoriesForFile(fileId);
    if (stories.length > 0) {
      applyStory(stories[0]);
    } else {
      clearStoryState();
    }
  };

  const selectStory = (storyId) => {
    const story = savedStories.find((entry) => entry._id === storyId);
    if (!story) return;

    setError('');
    applyStory(story);
  };

  const completeLocalAction = async () => {
    const action = pendingLocalAction;
    setPendingLocalAction(null);
    if (!action) return;

    if (action.type === 'file') {
      await selectFile(action.fileId);
    } else if (action.type === 'story') {
      selectStory(action.storyId);
    }
  };

  const requestLocalAction = (action) => {
    if (hasUnsavedChanges) {
      setPendingLocalAction(action);
      return;
    }

    if (action.type === 'file') {
      selectFile(action.fileId);
    } else if (action.type === 'story') {
      selectStory(action.storyId);
    }
  };

  const saveCurrentStory = async () => {
    const saved = await updateRollCallStory(selectedStoryId, {
      story: storyText,
      breakName,
    });
    applyStory(saved);
    await loadStoriesForFile(selectedFileId);
    window.showToast?.('Script saved.', 'success');
    return saved;
  };

  const handleFileSelect = async (event) => {
    const fileId = event.target.value;
    if (!fileId || fileId === selectedFileId) return;

    requestLocalAction({ type: 'file', fileId });
  };

  const handleStorySelect = (event) => {
    const storyId = event.target.value;
    if (!storyId || storyId === selectedStoryId) return;

    requestLocalAction({ type: 'story', storyId });
  };

  const handleUnsavedCancel = () => {
    clearPendingNavigation();
    setPendingLocalAction(null);
  };

  const handleUnsavedDiscard = async () => {
    if (pendingNavigation) {
      completePendingNavigation();
    }
    if (pendingLocalAction) {
      await completeLocalAction();
    }
  };

  const handleUnsavedSave = async () => {
    try {
      setIsSavingScript(true);
      await saveCurrentStory();
      if (pendingNavigation) {
        completePendingNavigation();
      }
      if (pendingLocalAction) {
        await completeLocalAction();
      }
    } catch (err) {
      setError(err.message || 'Failed to save script');
      window.showToast?.('Failed to save story.', 'error');
    } finally {
      setIsSavingScript(false);
    }
  };

  const handleCsvUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setIsParsingCsv(true);
    try {
      const csv = await file.text();
      const names = parseRollCallCsv(csv);
      const savedFile = await createRollCallFile({
        fileName: file.name,
        csvText: csv,
        sourceNames: names,
      });
      const files = await fetchRollCallFiles();
      setSavedFiles(files);
      applyFile(savedFile);
      await loadStoriesForFile(savedFile._id);
      clearStoryState();
      window.showToast?.(`${names.length} names uploaded.`, 'success');
    } catch (err) {
      setCsvFileName('');
      setError(err.message || 'Failed to parse CSV');
    } finally {
      setIsParsingCsv(false);
    }
  };

  const handleChooseCsvClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleGenerateStoryRequest = () => {
    setError('');
    if (!capabilities.generateScript) {
      return;
    }
    if (!selectedFileId) {
      setError('Upload or select a name list first.');
      return;
    }
    if (csvNames.length === 0) {
      setError('Upload a CSV with names first.');
      return;
    }
    if (!capabilities.claudeStory) {
      setError('Story generation is not configured. Add ANTHROPIC_API_KEY to the server environment.');
      return;
    }

    setShowGenerateConfirm(true);
  };

  const handleGenerateStory = async () => {
    try {
      setIsGeneratingStory(true);
      const result = await generateRollCallStory(selectedFileId, { names: csvNames, csv: csvText });
      const stories = await loadStoriesForFile(selectedFileId);
      const newStory = stories.find((entry) => entry._id === result.storyId) || {
        _id: result.storyId,
        story: result.story,
        breakName: result.breakName || '',
        updatedAt: result.updatedAt,
        createdAt: result.createdAt,
      };
      applyStory(newStory);
      const files = await fetchRollCallFiles();
      setSavedFiles(files);
      window.showToast?.('Script generated.', 'success');
    } catch (err) {
      setError(err.message || 'Failed to generate script');
    } finally {
      setIsGeneratingStory(false);
      setShowGenerateConfirm(false);
    }
  };

  const handleSaveScript = async () => {
    setError('');
    if (!selectedStoryId) {
      setError('Generate or select a story before saving.');
      return;
    }
    if (!storyText.trim()) {
      setError('Add a story before saving.');
      return;
    }

    try {
      setIsSavingScript(true);
      await saveCurrentStory();
    } catch (err) {
      setError(err.message || 'Failed to save script');
      window.showToast?.('Failed to save story.', 'error');
    } finally {
      setIsSavingScript(false);
    }
  };

  const handleDownloadStory = () => {
    if (!storyText.trim()) {
      setError('Generate or edit a story before downloading.');
      return;
    }
    downloadStoryText(storyText);
  };

  const handleGenerateDeck = async () => {
    setError('');
    if (!storyText.trim()) {
      setError('Generate a story first.');
      return;
    }
    if (parsedNames.length === 0) {
      setError('The story must include names in (parentheses).');
      return;
    }
    if (!breakName) {
      setError('Select the break name.');
      return;
    }

    try {
      setIsGeneratingDeck(true);
      await generateRollCallPowerpoint({ text: storyText, breakName });
      window.showToast?.('PowerPoint downloaded.', 'success');
    } catch (err) {
      setError(err.message || 'Failed to generate PowerPoint');
    } finally {
      setIsGeneratingDeck(false);
    }
  };

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Roll Call</h1>
        </div>
        <div style={styles.loading}>Loading roll call...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Roll Call</h1>
        <p style={styles.description}>
          Upload delegate names, generate a script, pick the break name, then export a PowerPoint deck.
        </p>
      </div>

      {lastSaved && (
        <p style={styles.lastSaved}>
          Last saved: {lastSaved.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          })}
        </p>
      )}

      <div style={styles.stack}>
        {error && <p style={styles.error}>{error}</p>}

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>1. Upload Names (CSV)</h2>
          <p style={styles.cardText}>
            Use a CSV with <code style={styles.code}>first</code> and <code style={styles.code}>last</code> columns.
            A header row is optional.
          </p>
          <div style={styles.fileUpload}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleCsvUpload}
              style={styles.hiddenFileInput}
            />
            <button
              type="button"
              onClick={handleChooseCsvClick}
              disabled={isParsingCsv}
              style={{
                ...styles.uploadButton,
                ...(isParsingCsv ? styles.buttonDisabled : {}),
              }}
            >
              {isParsingCsv ? 'Parsing CSV...' : 'Choose CSV File'}
            </button>
            {(csvFileName || csvNames.length > 0) && (
              <div style={styles.fileInfo}>
                {csvFileName && (
                  <span style={styles.fileName}>{csvFileName}</span>
                )}
                {!isParsingCsv && csvNames.length > 0 && (
                  <span style={styles.fileCount}>
                    {csvNames.length} names loaded
                  </span>
                )}
              </div>
            )}
          </div>

          {savedFiles.length > 0 && (
            <div style={styles.selectorBlock}>
              <label style={styles.selectorLabel} htmlFor="roll-call-file-select">
                Saved name lists
              </label>
              <select
                id="roll-call-file-select"
                value={selectedFileId}
                onChange={handleFileSelect}
                style={styles.select}
              >
                {savedFiles.map((file) => (
                  <option key={file._id} value={file._id}>
                    {file.fileName} ({file.nameCount} names · {formatSavedAt(file.updatedAt)})
                  </option>
                ))}
              </select>
            </div>
          )}
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>2. Generate Script</h2>
          <p style={styles.cardText}>
            Claude writes a roll call script and wraps each name in parentheses, matching your format and including all delegates.
            Each generation saves a new story for the selected name list.
          </p>
          <button
            onClick={handleGenerateStoryRequest}
            disabled={!capabilities.generateScript || isGeneratingStory || !selectedFileId || csvNames.length === 0 || !capabilities.claudeStory}
            style={{
              ...styles.button,
              ...(!capabilities.generateScript || isGeneratingStory || !selectedFileId || csvNames.length === 0 || !capabilities.claudeStory ? styles.buttonDisabled : {}),
            }}
          >
            {isGeneratingStory ? 'Generating Script...' : '✨ Generate Script'}
          </button>
          {!capabilities.generateScript && (
            <p style={styles.warning}>Script generation is temporarily disabled.</p>
          )}
          {capabilities.generateScript && !capabilities.claudeStory && (
            <p style={styles.warning}>Set <code style={styles.code}>ANTHROPIC_API_KEY</code> on the server to enable story generation.</p>
          )}
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeaderRow}>
            <h2 style={styles.cardTitle}>3. Review Script</h2>
            <div style={styles.cardActions}>
              <button
                onClick={handleSaveScript}
                disabled={!selectedStoryId || !storyText.trim() || isSavingScript || !hasUnsavedChanges}
                style={{
                  ...styles.secondaryButton,
                  ...(!selectedStoryId || !storyText.trim() || isSavingScript || !hasUnsavedChanges
                    ? styles.saveButtonIdle
                    : {}),
                  ...(!selectedStoryId || !storyText.trim() || isSavingScript || !hasUnsavedChanges
                    ? styles.buttonDisabled
                    : {}),
                }}
              >
                {isSavingScript
                  ? 'Saving...'
                  : hasUnsavedChanges
                    ? 'Save Script'
                    : 'Script Saved'}
              </button>
              <button
                onClick={handleDownloadStory}
                disabled={!storyText.trim()}
                style={{
                  ...styles.secondaryButton,
                  ...(!storyText.trim() ? styles.buttonDisabled : {}),
                }}
              >
                Download rollcall.txt
              </button>
            </div>
          </div>

          {selectedFileId && savedStories.length > 0 && (
            <div style={styles.selectorBlock}>
              <label style={styles.selectorLabel} htmlFor="roll-call-story-select">
                Saved scripts for this name list
              </label>
              <select
                id="roll-call-story-select"
                value={selectedStoryId}
                onChange={handleStorySelect}
                style={styles.select}
              >
                {savedStories.map((story, index) => (
                  <option key={story._id} value={story._id}>
                    Story {savedStories.length - index} · {formatSavedAt(story.createdAt)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <textarea
            value={storyText}
            onChange={(e) => setStoryText(e.target.value)}
            style={styles.textarea}
            placeholder="Generated story will appear here. Every name should be wrapped like (First Last)."
            rows={12}
          />
          <NameChecklist csvNames={csvNames} parsedNames={parsedNames} />
          {storyText.trim() && csvNames.length === 0 && (
            <p style={styles.meta}>{parsedNames.length} parenthesis-wrapped names found</p>
          )}
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>4. Break Name</h2>
          <p style={styles.cardText}>
            Choose the name where the deck inserts the <strong>ROLL CALL</strong> slide ({' '}
            <code style={styles.code}>MT. BAKER 2026 - REACH</code>).
          </p>
          <BreakNameSelect names={parsedNames} value={breakName} onChange={setBreakName} />
          {breakWarnings.length > 0 && (
            <div style={styles.validationWarnings}>
              {breakWarnings.map((warning) => (
                <p
                  key={warning}
                  style={{
                    ...styles.validationWarning,
                    marginBottom: warning !== breakWarnings[breakWarnings.length - 1] ? '0.5rem' : 0,
                  }}
                >
                  {warning}
                </p>
              ))}
            </div>
          )}
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>5. Generate Deck</h2>
          <p style={styles.cardText}>
            3 columns × 16 rows per slide, uppercase names, title break slide, and ending welcome slide.
          </p>
          <p style={styles.note}>
            Appear-on-click animations are not included in the export. Add them in PowerPoint after opening the file if you want names to reveal one by one.
          </p>
          <button
            onClick={handleGenerateDeck}
            disabled={isGeneratingDeck || !breakName || parsedNames.length === 0}
            style={{
              ...styles.button,
              ...(isGeneratingDeck || !breakName || parsedNames.length === 0 ? styles.buttonDisabled : {}),
            }}
          >
            {isGeneratingDeck ? 'Generating...' : '📊 Download PowerPoint'}
          </button>
        </section>
      </div>
      {showGenerateConfirm && (
        <ConfirmPopup
          title="Generate Script?"
          message={
            <>
              <p style={{ margin: '0 0 0.75rem 0' }}>
                Generate a new roll call script with Claude? This will create a new saved script for this name list.
              </p>
              <p style={{ margin: 0, color: '#fd2808' }}>
                This will cost Holland $5–10 per run.
              </p>
            </>
          }
          confirmLabel="GENERATE"
          loadingLabel="GENERATING..."
          loading={isGeneratingStory}
          onCancel={() => {
            if (!isGeneratingStory) setShowGenerateConfirm(false);
          }}
          onConfirm={handleGenerateStory}
        />
      )}
      {(pendingNavigation || pendingLocalAction) && (
        <UnsavedChangesPopup
          title="Unsaved Story Changes"
          message="You have unsaved edits to this story. Save before leaving or switching?"
          saving={isSavingScript}
          saveLabel="SAVE"
          onCancel={handleUnsavedCancel}
          onDiscard={handleUnsavedDiscard}
          onSave={handleUnsavedSave}
        />
      )}
      <ToastContainer />
    </div>
  );
};

const styles = {
  container: {
    padding: '2rem',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  header: {
    textAlign: 'center',
    marginBottom: '2rem',
    padding: '1.5rem 0',
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: '800',
    color: '#0f172a',
    margin: '0 0 0.5rem 0',
    letterSpacing: '-0.025em',
    background: 'linear-gradient(135deg, #1e293b 0%, #3b82f6 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  description: {
    fontSize: '1.125rem',
    color: '#64748b',
    margin: '0',
    fontWeight: '400',
    lineHeight: '1.6',
  },
  lastSaved: {
    fontSize: '0.875rem',
    color: '#94a3b8',
    margin: '0 0 0.75rem 0',
    fontStyle: 'italic',
    textAlign: 'right',
  },
  loading: {
    padding: '3rem 0',
    textAlign: 'center',
    color: '#64748b',
    fontSize: '1rem',
  },
  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '1.5rem',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e2e8f0',
  },
  cardHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '0.75rem',
  },
  cardActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  cardTitle: {
    margin: '0 0 0.75rem 0',
    fontSize: '1.125rem',
    color: '#1e293b',
  },
  cardText: {
    margin: '0 0 1rem 0',
    color: '#64748b',
    lineHeight: 1.5,
  },
  fileUpload: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.75rem',
  },
  hiddenFileInput: {
    display: 'none',
  },
  uploadButton: {
    flexShrink: 0,
    padding: '0.75rem 1.25rem',
    backgroundColor: '#f8fafc',
    color: '#1e293b',
    border: '2px dashed #cbd5e1',
    borderRadius: '10px',
    fontSize: '0.95rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'border-color 0.15s ease, background-color 0.15s ease',
  },
  fileInfo: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.5rem 1rem',
    padding: '0.75rem 1rem',
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '8px',
    flex: '1 1 auto',
    minWidth: '200px',
  },
  fileName: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#166534',
    wordBreak: 'break-all',
  },
  fileCount: {
    fontSize: '0.875rem',
    color: '#15803d',
  },
  selectorBlock: {
    marginTop: '1rem',
  },
  selectorLabel: {
    display: 'block',
    marginBottom: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#475569',
  },
  select: {
    width: '100%',
    padding: '0.75rem 1rem',
    fontSize: '0.95rem',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    backgroundColor: 'white',
    color: '#1e293b',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    minHeight: '260px',
    padding: '1rem',
    fontSize: '0.95rem',
    lineHeight: 1.6,
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    resize: 'vertical',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  input: {
    width: '100%',
    padding: '0.75rem 1rem',
    fontSize: '0.95rem',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    boxSizing: 'border-box',
  },
  selectWrap: {
    position: 'relative',
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 0.25rem)',
    left: 0,
    right: 0,
    maxHeight: '240px',
    overflowY: 'auto',
    backgroundColor: 'white',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
    zIndex: 20,
  },
  dropdownItem: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '0.75rem 1rem',
    border: 'none',
    background: 'white',
    cursor: 'pointer',
    fontSize: '0.95rem',
    color: '#1e293b',
  },
  dropdownItemActive: {
    backgroundColor: '#eff6ff',
    color: '#1d4ed8',
    fontWeight: '600',
  },
  dropdownEmpty: {
    padding: '0.75rem 1rem',
    color: '#94a3b8',
    fontSize: '0.9rem',
  },
  buttonRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.75rem',
  },
  button: {
    padding: '0.875rem 1.25rem',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  secondaryButton: {
    padding: '0.875rem 1.25rem',
    backgroundColor: '#f8fafc',
    color: '#1e293b',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  saveButtonIdle: {
    backgroundColor: '#f1f5f9',
    color: '#94a3b8',
    borderColor: '#e2e8f0',
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  meta: {
    margin: '0.75rem 0 0',
    color: '#64748b',
    fontSize: '0.875rem',
  },
  checklist: {
    marginTop: '1rem',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  checklistBanner: {
    padding: '0.75rem 1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  checklistBannerSuccess: {
    backgroundColor: '#f0fdf4',
    borderBottom: '1px solid #bbf7d0',
  },
  checklistBannerWarning: {
    backgroundColor: '#fffbeb',
    borderBottom: '1px solid #fde68a',
  },
  checklistBannerTitle: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#1e293b',
  },
  checklistBannerMeta: {
    fontSize: '0.8rem',
    color: '#64748b',
  },
  checklistSection: {
    padding: '0.5rem 1rem',
    borderTop: '1px solid #f1f5f9',
  },
  checklistToggle: {
    background: 'none',
    border: 'none',
    padding: '0.25rem 0',
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#b45309',
    cursor: 'pointer',
  },
  checklistList: {
    margin: '0.5rem 0 0',
    paddingLeft: '1.25rem',
    color: '#64748b',
    fontSize: '0.85rem',
    lineHeight: 1.5,
  },
  validationWarnings: {
    marginTop: '1rem',
    padding: '0.75rem 1rem',
    backgroundColor: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: '8px',
  },
  validationWarning: {
    margin: 0,
    color: '#92400e',
    fontSize: '0.875rem',
    lineHeight: 1.5,
  },
  note: {
    margin: '0 0 1rem 0',
    color: '#64748b',
    fontSize: '0.875rem',
    lineHeight: 1.5,
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '0.75rem 1rem',
  },
  warning: {
    margin: '0.75rem 0 0',
    color: '#b45309',
    fontSize: '0.875rem',
  },
  code: {
    fontFamily: 'monospace',
    fontSize: '0.85em',
    backgroundColor: '#f1f5f9',
    padding: '0.1rem 0.35rem',
    borderRadius: '4px',
  },
  error: {
    margin: 0,
    color: '#dc2626',
    fontSize: '0.95rem',
    padding: '1rem',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
  },
};

export default RollCallPage;
