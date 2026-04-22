import React, { useState } from 'react';
import { STUDENT_IMAGES, GAME_IMAGES, TEACHER_IMAGES } from '@/lib/constants';
import { Play, Music, Gamepad2, BookOpen, Search, Filter, Clock, Star, Video, Volume2, Cross, Heart } from 'lucide-react';

type ContentType = 'all' | 'video' | 'audio' | 'game' | 'religious';
type LevelFilter = 'all' | 'preschool' | 'nursery' | 'primary';

const CONTENT_ITEMS = [
  { id: 1, title: 'ABC Alphabet Song', type: 'audio', category: 'Literacy', level: 'nursery', duration: '3:24', image: STUDENT_IMAGES[0], rating: 4.8, free: true },
  { id: 2, title: 'Counting 1-100 Fun', type: 'video', category: 'Mathematics', level: 'nursery', duration: '8:15', image: STUDENT_IMAGES[1], rating: 4.9, free: true },
  { id: 3, title: 'Shapes & Colors Match', type: 'game', category: 'Mathematics', level: 'preschool', duration: '15 min', image: GAME_IMAGES[0], rating: 4.7, free: true },
  { id: 4, title: 'Bible Stories for Kids', type: 'religious', category: 'Christian Education', level: 'nursery', duration: '12:30', image: TEACHER_IMAGES[0], rating: 4.9, free: true },
  { id: 5, title: 'Basic Science: Plants', type: 'video', category: 'Science', level: 'primary', duration: '10:45', image: STUDENT_IMAGES[2], rating: 4.6, free: true },
  { id: 6, title: 'French for Beginners', type: 'audio', category: 'French', level: 'primary', duration: '15:00', image: STUDENT_IMAGES[3], rating: 4.5, free: false },
  { id: 7, title: 'Word Puzzle Adventure', type: 'game', category: 'English', level: 'primary', duration: '20 min', image: GAME_IMAGES[1], rating: 4.8, free: true },
  { id: 8, title: 'The Creation Story', type: 'religious', category: 'Christian Education', level: 'preschool', duration: '7:20', image: TEACHER_IMAGES[1], rating: 5.0, free: true },
  { id: 9, title: 'Phonics: Letter Sounds', type: 'audio', category: 'Phonics', level: 'nursery', duration: '5:40', image: STUDENT_IMAGES[0], rating: 4.7, free: true },
  { id: 10, title: 'Times Tables Race', type: 'game', category: 'Mathematics', level: 'primary', duration: '10 min', image: GAME_IMAGES[2], rating: 4.6, free: true },
  { id: 11, title: 'African Geography', type: 'video', category: 'Social Studies', level: 'primary', duration: '14:22', image: STUDENT_IMAGES[1], rating: 4.4, free: false },
  { id: 12, title: 'Nursery Rhymes Collection', type: 'audio', category: 'Music', level: 'preschool', duration: '22:10', image: STUDENT_IMAGES[2], rating: 4.9, free: true },
  { id: 13, title: 'Noah\'s Ark Interactive', type: 'game', category: 'Christian Education', level: 'nursery', duration: '12 min', image: GAME_IMAGES[3], rating: 4.8, free: true },
  { id: 14, title: 'Health & Hygiene', type: 'video', category: 'Health Education', level: 'primary', duration: '9:55', image: TEACHER_IMAGES[2], rating: 4.5, free: true },
  { id: 15, title: 'Swahili Numbers Song', type: 'audio', category: 'Languages', level: 'nursery', duration: '4:15', image: STUDENT_IMAGES[3], rating: 4.7, free: true },
  { id: 16, title: 'Spelling Bee Challenge', type: 'game', category: 'English', level: 'primary', duration: '15 min', image: GAME_IMAGES[0], rating: 4.6, free: false },
];

const ContentLibrary: React.FC = () => {
  const [typeFilter, setTypeFilter] = useState<ContentType>('all');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<number[]>([]);
  const [playingId, setPlayingId] = useState<number | null>(null);

  const filtered = CONTENT_ITEMS.filter(item => {
    if (typeFilter !== 'all' && item.type !== typeFilter) return false;
    if (levelFilter !== 'all' && item.level !== levelFilter) return false;
    if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase()) && !item.category.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const toggleFavorite = (id: number) => {
    setFavorites(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case 'video': return <Video className="w-4 h-4" />;
      case 'audio': return <Volume2 className="w-4 h-4" />;
      case 'game': return <Gamepad2 className="w-4 h-4" />;
      case 'religious': return <Cross className="w-4 h-4" />;
      default: return <BookOpen className="w-4 h-4" />;
    }
  };

  const typeColor = (type: string) => {
    switch (type) {
      case 'video': return 'bg-purple-100 text-purple-600';
      case 'audio': return 'bg-orange-100 text-orange-600';
      case 'game': return 'bg-emerald-100 text-emerald-600';
      case 'religious': return 'bg-amber-100 text-amber-700';
      default: return 'bg-blue-100 text-blue-600';
    }
  };

  const levelColor = (level: string) => {
    switch (level) {
      case 'preschool': return 'bg-pink-50 text-pink-600';
      case 'nursery': return 'bg-sky-50 text-sky-600';
      case 'primary': return 'bg-indigo-50 text-indigo-600';
      default: return 'bg-gray-50 text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-700 to-indigo-900 text-white py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Play className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Content Library</h1>
              <p className="text-purple-200">Educational videos, audio, games & religious content</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 -mt-6">
        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                placeholder="Search content..."
              />
            </div>

            {/* Type filters */}
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { id: 'all' as ContentType, label: 'All', icon: Filter },
                { id: 'video' as ContentType, label: 'Videos', icon: Video },
                { id: 'audio' as ContentType, label: 'Audio', icon: Volume2 },
                { id: 'game' as ContentType, label: 'Games', icon: Gamepad2 },
                { id: 'religious' as ContentType, label: 'Religious', icon: Cross },
              ].map(f => (
                <button
                  key={f.id} onClick={() => setTypeFilter(f.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    typeFilter === f.id ? 'bg-purple-100 text-purple-700' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <f.icon className="w-4 h-4" /> {f.label}
                </button>
              ))}
            </div>

            {/* Level filter */}
            <select
              value={levelFilter} onChange={e => setLevelFilter(e.target.value as LevelFilter)}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-purple-500 outline-none"
            >
              <option value="all">All Levels</option>
              <option value="preschool">Pre-School</option>
              <option value="nursery">Nursery</option>
              <option value="primary">Primary</option>
            </select>
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">{filtered.length} resources found</p>
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 pb-12">
          {filtered.map(item => (
            <div
              key={item.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-all group cursor-pointer"
              onClick={() => setPlayingId(playingId === item.id ? null : item.id)}
            >
              {/* Thumbnail */}
              <div className="relative aspect-video overflow-hidden">
                <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-14 h-14 bg-white/90 rounded-full flex items-center justify-center">
                    <Play className="w-6 h-6 text-gray-800 ml-0.5" />
                  </div>
                </div>
                {/* Type badge */}
                <div className={`absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${typeColor(item.type)}`}>
                  {typeIcon(item.type)}
                  {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                </div>
                {/* Favorite */}
                <button
                  onClick={e => { e.stopPropagation(); toggleFavorite(item.id); }}
                  className="absolute top-3 right-3 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center hover:bg-white transition-all"
                >
                  <Heart className={`w-4 h-4 ${favorites.includes(item.id) ? 'fill-red-500 text-red-500' : 'text-gray-500'}`} />
                </button>
                {/* Duration */}
                <div className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-1 bg-black/70 rounded-lg text-white text-xs">
                  <Clock className="w-3 h-3" /> {item.duration}
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-1">{item.title}</h3>
                <p className="text-xs text-gray-500 mb-3">{item.category}</p>
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${levelColor(item.level)}`}>
                    {item.level.charAt(0).toUpperCase() + item.level.slice(1)}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-amber-500">
                    <Star className="w-3 h-3 fill-current" /> {item.rating}
                  </div>
                </div>
                {!item.free && (
                  <div className="mt-2 text-xs text-blue-600 font-medium bg-blue-50 rounded-lg px-2 py-1 text-center">
                    Premium Content
                  </div>
                )}
              </div>

              {/* Playing state */}
              {playingId === item.id && (
                <div className="px-4 pb-4">
                  <div className="bg-gray-100 rounded-xl p-3 text-center">
                    <div className="flex items-center justify-center gap-1 mb-2">
                      {[1,2,3,4,5].map(i => (
                        <div key={i} className="w-1 bg-purple-500 rounded-full animate-pulse" style={{ height: `${Math.random() * 16 + 8}px`, animationDelay: `${i * 0.1}s` }} />
                      ))}
                    </div>
                    <p className="text-xs text-gray-500">Now Playing</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No content found</h3>
            <p className="text-gray-500 text-sm">Try adjusting your filters or search query</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContentLibrary;
