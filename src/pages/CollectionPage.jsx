import React from 'react';
import { useParams } from 'react-router-dom';
import { Play } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import NotFoundPage from './NotFoundPage';

// An admin-created "More" page: Gallery-style sharp-cornered square grid.
// Photo items open the lightbox over this page's photos; video items show
// their poster (or a quiet dark block) and open the existing video modal.
// While the collections list is still loading, an unknown slug renders
// nothing rather than flashing NotFound at someone following a direct link.
export default function CollectionPage({ collections, loading, onOpenLightbox, onOpenVideo }) {
  const { slug } = useParams();
  const collection = collections.find((candidate) => candidate.slug === slug);

  if (!collection) {
    return loading ? null : <NotFoundPage />;
  }

  const photoItems = collection.items.filter((item) => !item.videoEmbedUrl);
  const photoList = photoItems.map((item) => ({
    id: item.id,
    url: item.url,
    title: item.caption || collection.title,
  }));

  return (
    <div data-testid="collection-page">
      <PageHeader title={collection.title} />
      <section className="py-6 border-t border-pitch-900/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {collection.description && (
            <p className="text-center text-sm text-charcoal-700 max-w-2xl mx-auto mb-10">{collection.description}</p>
          )}
          {collection.items.length === 0 && (
            <p className="text-center text-charcoal-500 py-16">This page is being curated.</p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {collection.items.map((item) => (
              item.videoEmbedUrl ? (
                <button
                  key={item.id}
                  onClick={() => onOpenVideo(item.videoEmbedUrl)}
                  aria-label={`Play video${item.caption ? `: ${item.caption}` : ''}`}
                  className="relative block overflow-hidden group aspect-square bg-pitch-900"
                >
                  {item.url && (
                    <img
                      src={item.url}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:scale-[1.03] transition-transform duration-700"
                    />
                  )}
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="w-12 h-12 rounded-full bg-offwhite-50/90 flex items-center justify-center">
                      <Play className="w-5 h-5 text-pitch-900 translate-x-[1px]" aria-hidden="true" />
                    </span>
                  </span>
                  {item.caption && (
                    <span className="absolute bottom-0 inset-x-0 bg-pitch-950/60 text-offwhite-50 text-[10px] uppercase tracking-widest py-1.5 px-2 text-left truncate">
                      {item.caption}
                    </span>
                  )}
                </button>
              ) : (
                <button
                  key={item.id}
                  onClick={() => onOpenLightbox(item.url, photoList.findIndex((p) => p.id === item.id), photoList)}
                  aria-label={item.caption ? `View photo: ${item.caption}` : 'View photo'}
                  className="block overflow-hidden group"
                >
                  <img
                    src={item.url}
                    alt={item.caption || ''}
                    loading="lazy"
                    className="aspect-square w-full object-cover group-hover:scale-[1.03] transition-transform duration-700"
                  />
                </button>
              )
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
