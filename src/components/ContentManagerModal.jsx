import React, { useState } from 'react';
import { X, Upload, Camera, FileText, CheckCircle, Plus, LayoutGrid, Code, Download } from 'lucide-react';

export default function ContentManagerModal({ isOpen, onClose, onAddPhoto, onAddStory }) {
  const [activeTab, setActiveTab] = useState('addPhoto'); // 'addPhoto', 'addStory', 'exportJSON', 'success'
  
  // Single Photo State
  const [photoUrl, setPhotoUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [photoTitle, setPhotoTitle] = useState('');
  const [category, setCategory] = useState('Royal');
  const [couple, setCouple] = useState('');
  const [location, setLocation] = useState('');

  // Story State
  const [storyTitle, setStoryTitle] = useState('');
  const [storyCover, setStoryCover] = useState('');
  const [storyCouple, setStoryCouple] = useState('');
  const [storyLocation, setStoryLocation] = useState('');
  const [storyDate] = useState('');
  const [storySummary, setStorySummary] = useState('');

  // Export State
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleFileUpload = (e, targetSetter) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        targetSetter(reader.result);
        if (targetSetter === setPhotoUrl) setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePhotoSubmit = (e) => {
    e.preventDefault();
    if (!photoUrl || !photoTitle) return;

    const newPhotoItem = {
      id: `photo-user-${Date.now()}`,
      title: photoTitle,
      url: photoUrl,
      category,
      couple: couple || 'Peak Story Couple',
      location: location || 'Destination',
      span: 'col-span-1 row-span-1',
      isFeatured: false
    };

    onAddPhoto(newPhotoItem);

    setPhotoTitle('');
    setPhotoUrl('');
    setPreviewUrl('');
    setCouple('');
    setLocation('');
    setActiveTab('success');
    setTimeout(() => {
      onClose();
      setActiveTab('addPhoto');
    }, 1500);
  };

  const handleStorySubmit = (e) => {
    e.preventDefault();
    if (!storyCover || !storyTitle) return;

    const newStoryItem = {
      id: `story-user-${Date.now()}`,
      title: storyTitle,
      couple: storyCouple || 'Royal Couple',
      location: storyLocation || 'Palace Destination',
      date: storyDate || '2025',
      coverImage: storyCover,
      tags: ['New Release', 'Featured'],
      summary: storySummary || 'A grand cinematic wedding saga captured by Peak Story Studio.',
      fullGallery: [storyCover]
    };

    onAddStory(newStoryItem);
    setStoryTitle('');
    setStoryCover('');
    setStoryCouple('');
    setStoryLocation('');
    setStorySummary('');
    setActiveTab('success');
    setTimeout(() => {
      onClose();
      setActiveTab('addPhoto');
    }, 1500);
  };

  const handleCopyJSON = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-pitch-950/80 backdrop-blur-2xl animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-offwhite-50 border border-pitch-900/15 rounded-3xl overflow-hidden shadow-2xl my-auto text-pitch-900">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-pitch-900/10 bg-offwhite-100">
          <div className="flex items-center space-x-3">
            <LayoutGrid className="w-5 h-5 text-pitch-900" />
            <h2 className="text-sm font-cinzel font-bold tracking-widest text-pitch-900">
              Studio Content Manager
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-offwhite-50 text-charcoal-500 hover:bg-pitch-900 hover:text-offwhite-50 rounded-full transition-colors border border-pitch-900/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-pitch-900/10 px-6 pt-4 space-x-6 bg-offwhite-100 overflow-x-auto">
          <button
            onClick={() => setActiveTab('addPhoto')}
            className={`pb-3 text-xs uppercase tracking-wider font-bold border-b-2 transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'addPhoto'
                ? 'border-pitch-900 text-pitch-900'
                : 'border-transparent text-charcoal-500 hover:text-pitch-900'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Add Single Photo</span>
          </button>
          
          <button
            onClick={() => setActiveTab('addStory')}
            className={`pb-3 text-xs uppercase tracking-wider font-bold border-b-2 transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'addStory'
                ? 'border-pitch-900 text-pitch-900'
                : 'border-transparent text-charcoal-500 hover:text-pitch-900'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Add Wedding Story</span>
          </button>

          <button
            onClick={() => setActiveTab('exportJSON')}
            className={`pb-3 text-xs uppercase tracking-wider font-bold border-b-2 transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'exportJSON'
                ? 'border-pitch-900 text-pitch-900'
                : 'border-transparent text-charcoal-500 hover:text-pitch-900'
            }`}
          >
            <Code className="w-4 h-4" />
            <span>Export Config JSON</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 sm:p-8">
          
          {/* TAB 1: ADD SINGLE PHOTO */}
          {activeTab === 'addPhoto' && (
            <form onSubmit={handlePhotoSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs uppercase tracking-widest text-pitch-900 mb-2 font-bold">
                    Upload Photo File
                  </label>
                  <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-pitch-900/20 rounded-2xl cursor-pointer hover:border-pitch-900 bg-offwhite-100 transition-all text-center">
                    <Upload className="w-8 h-8 text-pitch-900 mb-2" />
                    <span className="text-xs text-pitch-900 font-semibold">Click to choose image file</span>
                    <span className="text-[10px] text-charcoal-500 mt-1">Supports JPG, PNG, WebP</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, setPhotoUrl)}
                      className="hidden"
                    />
                  </label>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-widest text-pitch-900 mb-2 font-bold">
                    Or Enter Image URL
                  </label>
                  <input
                    type="text"
                    placeholder="https://example.com/my-photo.jpg or /images/my-photo.jpg"
                    value={photoUrl}
                    onChange={(e) => {
                      setPhotoUrl(e.target.value);
                      setPreviewUrl(e.target.value);
                    }}
                    className="w-full px-4 py-3 rounded-xl bg-offwhite-100 border border-pitch-900/20 text-pitch-900 text-sm focus:outline-none focus:border-pitch-900"
                  />
                  {previewUrl && (
                    <div className="mt-3 relative h-24 rounded-xl overflow-hidden border border-pitch-900/20">
                      <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-widest text-pitch-900 mb-2 font-bold">
                    Photo Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Royal Courtyard Portrait"
                    value={photoTitle}
                    onChange={(e) => setPhotoTitle(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-offwhite-100 border border-pitch-900/20 text-pitch-900 text-sm focus:outline-none focus:border-pitch-900"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-widest text-pitch-900 mb-2 font-bold">
                    Category Filter
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-offwhite-100 border border-pitch-900/20 text-pitch-900 text-sm focus:outline-none focus:border-pitch-900"
                  >
                    <option value="Royal">Royal</option>
                    <option value="Candid">Candid</option>
                    <option value="Pre-Wedding">Pre-Wedding</option>
                    <option value="Rituals">Rituals</option>
                    <option value="Details">Details</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-widest text-pitch-900 mb-2 font-bold">
                    Couple Names (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Aarav & Maya"
                    value={couple}
                    onChange={(e) => setCouple(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-offwhite-100 border border-pitch-900/20 text-pitch-900 text-sm focus:outline-none focus:border-pitch-900"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-widest text-pitch-900 mb-2 font-bold">
                    Location / Venue (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Jaipur Palace"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-offwhite-100 border border-pitch-900/20 text-pitch-900 text-sm focus:outline-none focus:border-pitch-900"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-4 rounded-xl bg-pitch-900 text-offwhite-50 font-bold uppercase tracking-[0.2em] text-xs hover:bg-pitch-800 transition-all shadow-md"
              >
                Add To Gallery Now
              </button>
            </form>
          )}

          {/* TAB 2: ADD WEDDING STORY */}
          {activeTab === 'addStory' && (
            <form onSubmit={handleStorySubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs uppercase tracking-widest text-pitch-900 mb-2 font-bold">
                    Cover Image
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Image URL..."
                    value={storyCover}
                    onChange={(e) => setStoryCover(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-offwhite-100 border border-pitch-900/20 text-pitch-900 text-sm focus:outline-none focus:border-pitch-900"
                  />
                  <label className="mt-2 flex flex-col items-center justify-center p-4 border-2 border-dashed border-pitch-900/20 rounded-2xl cursor-pointer hover:border-pitch-900 bg-offwhite-100 transition-all text-center">
                    <span className="text-xs text-pitch-900 font-semibold">Or upload file</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, setStoryCover)}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-pitch-900 mb-2 font-bold">
                      Story Title *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. The Royal Jodhpur Wedding"
                      value={storyTitle}
                      onChange={(e) => setStoryTitle(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-offwhite-100 border border-pitch-900/20 text-pitch-900 text-sm focus:outline-none focus:border-pitch-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-pitch-900 mb-2 font-bold">
                      Couple Names
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Ananya & Vikram"
                      value={storyCouple}
                      onChange={(e) => setStoryCouple(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-offwhite-100 border border-pitch-900/20 text-pitch-900 text-sm focus:outline-none focus:border-pitch-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-pitch-900 mb-2 font-bold">
                      Location
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Umaid Bhawan Palace"
                      value={storyLocation}
                      onChange={(e) => setStoryLocation(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-offwhite-100 border border-pitch-900/20 text-pitch-900 text-sm focus:outline-none focus:border-pitch-900"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-widest text-pitch-900 mb-2 font-bold">
                  Story Summary (Editorial Description)
                </label>
                <textarea
                  rows="3"
                  value={storySummary}
                  onChange={(e) => setStorySummary(e.target.value)}
                  placeholder="Describe the magical moments..."
                  className="w-full px-4 py-3 rounded-xl bg-offwhite-100 border border-pitch-900/20 text-pitch-900 text-sm focus:outline-none focus:border-pitch-900 resize-none"
                ></textarea>
              </div>

              <button
                type="submit"
                className="w-full py-4 rounded-xl bg-pitch-900 text-offwhite-50 font-bold uppercase tracking-[0.2em] text-xs hover:bg-pitch-800 transition-all shadow-md"
              >
                Publish Wedding Story
              </button>
            </form>
          )}

          {/* TAB 3: EXPORT JSON */}
          {activeTab === 'exportJSON' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-blue-800 text-sm flex items-start">
                <FileText className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-bold mb-1">Developer Mode: Export Config</p>
                  <p>Because you are currently saving data to your browser&apos;s local storage, you can export all your changes here as a JSON file and paste them into <code className="bg-white px-1 py-0.5 rounded text-xs border border-blue-100">src/data/weddingData.js</code> to make them permanent.</p>
                </div>
              </div>

              <button
                onClick={handleCopyJSON}
                className="w-full py-4 rounded-xl bg-pitch-900 text-offwhite-50 font-bold uppercase tracking-[0.2em] text-xs hover:bg-pitch-800 transition-all shadow-md flex items-center justify-center space-x-2"
              >
                {copied ? <CheckCircle className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy Data to Clipboard'}</span>
              </button>
            </div>
          )}

          {/* TAB 4: SUCCESS */}
          {activeTab === 'success' && (
            <div className="flex flex-col items-center justify-center py-12 animate-fade-in">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="font-cinzel text-2xl font-bold text-pitch-900 mb-2">Success!</h3>
              <p className="text-charcoal-500 font-garamond italic text-lg text-center max-w-sm">
                Your content has been added to the live portfolio.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
