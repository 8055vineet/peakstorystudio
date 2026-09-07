import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StoryAlbum from '../components/StoryAlbum';
import NotFoundPage from './NotFoundPage';

// A single wedding at its own shareable, indexable URL (`/stories/:slug`,
// Phase 5 — the per-wedding half of PS-008). The story comes from the
// published-weddings list App already loads on every page, so there is no
// per-slug fetch here: `getWeddingBySlug` exists in src/lib/queries/weddings.js
// but a second round-trip for a row that is already in memory would only add
// a loading state. While that list is still loading, an unknown slug renders
// nothing rather than flashing NotFound at someone following a direct link.
export default function StoryPage({ stories, loading, onOpenLightbox, onOpenVideo }) {
  const { slug } = useParams();
  const story = stories.find((candidate) => candidate.slug === slug);

  if (!story) {
    return loading ? null : <NotFoundPage />;
  }

  return (
    <div data-testid="story-page">
      <PageHeader title={story.title} />
      <section className="py-6 border-t border-pitch-900/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            to="/stories"
            className="inline-flex items-center gap-2 mb-8 text-xs uppercase tracking-[0.2em] text-pitch-700 hover:text-pitch-900 underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-pitch-900"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Back to stories</span>
          </Link>
          <StoryAlbum story={story} onSelectImage={onOpenLightbox} onOpenVideo={onOpenVideo} />
        </div>
      </section>
    </div>
  );
}
