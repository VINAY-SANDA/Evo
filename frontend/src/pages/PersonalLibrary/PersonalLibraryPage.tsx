import { useEffect, useState, type FormEvent } from 'react';
import type { DiaryEntry, MovieReview } from '../../types';
import { createDiaryEntry, createMovieReview, deleteDiaryEntry, deleteMovieReview, getDiaryEntries, getMovieReviews } from '../../services/api';
import './PersonalLibraryPage.css';

export default function PersonalLibraryPage({ mode }: { mode: 'diary' | 'movies' }) {
  const isDiary = mode === 'diary';
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [movieEntries, setMovieEntries] = useState<MovieReview[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [year, setYear] = useState('');
  const [rating, setRating] = useState(5);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    (isDiary ? getDiaryEntries() : getMovieReviews()).then(entries => {
      if (!active) return;
      if (!entries) setError(`Could not load ${isDiary ? 'diary entries' : 'movie reviews'}. Check your connection and retry.`);
      else if (isDiary) setDiaryEntries(entries as DiaryEntry[]);
      else setMovieEntries(entries as MovieReview[]);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isDiary]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle || saving) return;
    setSaving(true);
    setError('');
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const saved = isDiary
      ? await createDiaryEntry({ title: cleanTitle, body: body.trim(), date })
      : await createMovieReview({ title: cleanTitle, year: year ? Number(year) : null, rating, review: body.trim(), watchedAt: date });
    setSaving(false);
    if (!saved) {
      setError(`Could not save ${isDiary ? 'diary entry' : 'movie review'}. Your text is still here; try again.`);
      return;
    }
    if (isDiary) setDiaryEntries(current => [saved as DiaryEntry, ...current]);
    else setMovieEntries(current => [saved as MovieReview, ...current]);
    setTitle('');
    setBody('');
    setYear('');
    setRating(5);
  };

  const removeDiaryEntry = async (id: string) => {
    if (await deleteDiaryEntry(id)) setDiaryEntries(items => items.filter(item => item.id !== id));
    else setError('Could not delete diary entry. Please try again.');
  };

  const removeMovieReview = async (id: string) => {
    if (await deleteMovieReview(id)) setMovieEntries(items => items.filter(item => item.id !== id));
    else setError('Could not delete movie review. Please try again.');
  };

  return (
    <div className="personal-library-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{isDiary ? 'My Diary' : 'Movie Journal'}</h1>
          <p className="page-subtitle">{isDiary ? 'A private space for your thoughts and moments.' : 'Keep the movies you watch and what you thought of them.'}</p>
        </div>
      </header>

      {error && <div className="card library-error" role="alert">{error}</div>}
      <section className="card library-compose">
        <h2 className="card-title">{isDiary ? 'Write an entry' : 'Add a movie'}</h2>
        <form onSubmit={event => { void submit(event); }}>
          <div className="library-form-grid">
            <label className="form-group">
              <span className="form-label">{isDiary ? 'Title' : 'Movie title'}</span>
              <input className="form-input" value={title} onChange={event => setTitle(event.target.value)} maxLength={160} required placeholder={isDiary ? 'What is on your mind?' : 'What did you watch?'} />
            </label>
            {!isDiary && <>
              <label className="form-group"><span className="form-label">Release year</span><input className="form-input" type="number" min="1888" max="2100" value={year} onChange={event => setYear(event.target.value)} placeholder="Optional" /></label>
              <label className="form-group"><span className="form-label">Your rating</span><select className="form-input" value={rating} onChange={event => setRating(Number(event.target.value))}>{[5, 4, 3, 2, 1].map(value => <option value={value} key={value}>{'★'.repeat(value)}{'☆'.repeat(5 - value)} · {value}/5</option>)}</select></label>
            </>}
            <label className="form-group library-body-field">
              <span className="form-label">{isDiary ? 'Your entry' : 'Your review'}</span>
              <textarea className="form-input" rows={4} value={body} onChange={event => setBody(event.target.value)} placeholder={isDiary ? 'Write freely…' : 'What did you like, dislike, or remember?'} />
            </label>
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : isDiary ? 'Save entry' : 'Add to my movies'}</button>
        </form>
      </section>

      <section className="library-entry-list" aria-label={isDiary ? 'Diary entries' : 'Movie reviews'}>
        {loading && <div className="card library-empty" role="status">Loading…</div>}
        {!loading && !error && (isDiary ? diaryEntries.length === 0 : movieEntries.length === 0) && <div className="card library-empty"><p>{isDiary ? 'Your diary is ready. Add your first entry above.' : 'Your movie journal is empty. Add a movie you watched.'}</p></div>}
        {isDiary ? diaryEntries.map(entry => <article className="card library-entry" key={entry.id}>
          <div className="library-entry-heading"><h2>{entry.title}</h2><time dateTime={entry.date}>{new Date(`${entry.date}T12:00:00`).toLocaleDateString()}</time></div>
          {entry.body && <p className="library-entry-body">{entry.body}</p>}
          <button className="btn btn-ghost sm" onClick={() => { void removeDiaryEntry(entry.id); }} aria-label={`Delete diary entry ${entry.title}`}>Delete</button>
        </article>) : movieEntries.map(entry => <article className="card library-entry" key={entry.id}>
          <div className="library-entry-heading"><h2>{entry.title}{entry.year && <span className="library-year"> ({entry.year})</span>}</h2><time dateTime={entry.watchedAt}>{new Date(`${entry.watchedAt}T12:00:00`).toLocaleDateString()}</time></div>
          <div className="library-rating" aria-label={`${entry.rating} out of 5 stars`}>{'★'.repeat(entry.rating)}{'☆'.repeat(5 - entry.rating)}</div>
          {entry.review && <p className="library-entry-body">{entry.review}</p>}
          <button className="btn btn-ghost sm" onClick={() => { void removeMovieReview(entry.id); }} aria-label={`Delete movie review for ${entry.title}`}>Delete</button>
        </article>)}
      </section>
    </div>
  );
}
