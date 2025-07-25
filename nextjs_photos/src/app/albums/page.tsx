'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { GroupMetadata, AlbumWithGroup } from '@/types';

interface Album {
  name: string;
  path: string;
  metadata: {
    name: string;
    location: string;
    description: string;
    created: string;
    photos: Array<{
      filename: string;
      title: string;
      uploadDate: string;
      description: string;
    }>;
    videos: Array<{
      url: string;
      title: string;
      addedDate: string;
    }>;
  } | null;
  firstPhoto: string | null;
  groupId?: string;
  isNested?: boolean;
}

function AlbumsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [years, setYears] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [albums, setAlbums] = useState<Album[]>([]);
  const [groups, setGroups] = useState<GroupMetadata[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchYears();
  }, []);

  useEffect(() => {
    if (selectedYear) {
      fetchAlbums(selectedYear);
      fetchGroups(selectedYear);
    }
  }, [selectedYear]);

  const fetchYears = async () => {
    try {
      const response = await fetch('/api/albums');
      const data = await response.json();
      setYears(data.years || []);
      
      // Set initial year from URL parameter or default to first available year
      const yearFromUrl = searchParams.get('year');
      if (yearFromUrl && data.years && data.years.includes(yearFromUrl)) {
        setSelectedYear(yearFromUrl);
      } else if (data.years && data.years.length > 0) {
        setSelectedYear(data.years[0]);
      }
    } catch (error) {
      console.error('Error fetching years:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlbums = async (year: string) => {
    try {
      console.log('Fetching albums for year:', year);
      const response = await fetch(`/api/albums?year=${year}`);
      console.log('Albums response status:', response.status);
      const data = await response.json();
      console.log('Albums data received:', data);
      setAlbums(data.albums || []);
    } catch (error) {
      console.error('Error fetching albums:', error);
    }
  };

  const fetchGroups = async (year: string) => {
    try {
      const response = await fetch(`/api/groups?year=${year}`);
      const data = await response.json();
      setGroups(data.groups || []);
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    // Update URL with year parameter
    const params = new URLSearchParams();
    if (year) {
      params.set('year', year);
    }
    router.replace(`/albums?${params.toString()}`);
  };

  // Organize albums and groups for display
  const organizeContent = () => {
    const groupedAlbums = albums.filter(album => album.groupId);
    const ungroupedAlbums = albums.filter(album => !album.groupId);
    
    // Create group entries for display
    const groupEntries = groups.map(group => {
      // Find first album in this group that has a photo
      const groupAlbumsWithPhotos = groupedAlbums.filter(album => 
        album.groupId === group.id && album.firstPhoto
      );
      const firstAlbumWithPhoto = groupAlbumsWithPhotos[0];
      
      return {
        type: 'group' as const,
        id: group.id,
        name: group.id,
        displayName: group.displayName,
        isGroup: true,
        metadata: null,
        firstPhoto: firstAlbumWithPhoto?.firstPhoto || null,
        firstAlbumPath: firstAlbumWithPhoto?.path || null,
        path: '',
        groupId: group.id,
      };
    });

    // Convert ungrouped albums to display format
    const albumEntries = ungroupedAlbums.map(album => ({
      type: 'album' as const,
      id: album.name,
      name: album.name,
      displayName: album.metadata?.name || album.name,
      isGroup: false,
      metadata: album.metadata,
      firstPhoto: album.firstPhoto,
      path: album.path,
      groupId: album.groupId,
      isNested: album.isNested,
    }));

    return [...groupEntries, ...albumEntries];
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading albums...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-800 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-100 mb-2">Photo Albums</h1>
          <div className="flex items-center text-sm text-emerald-400">
            <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Secure Access - Session Active
          </div>
        </div>

        <div className="mb-6">
          <label htmlFor="year-select" className="block text-sm font-medium text-slate-300 mb-2">
            Select Year
          </label>
          <select
            id="year-select"
            value={selectedYear}
            onChange={(e) => handleYearChange(e.target.value)}
            className="px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-700 text-slate-100"
          >
            <option value="">Select Year</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        {selectedYear && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {organizeContent().map((item) => {
              if (item.type === 'group') {
                return (
                  <Link
                    key={item.id}
                    href={`/albums/${selectedYear}/${item.name}`}
                    className="block bg-slate-700 rounded-lg shadow-md overflow-hidden hover:shadow-lg hover:bg-slate-600 transition-all duration-300 border-l-4 border-l-purple-500"
                  >
                    <div className="h-48 bg-slate-600 relative overflow-hidden flex items-center justify-center">
                      {/* Background image if available */}
                      {item.firstPhoto && item.firstAlbumPath ? (
                        <img
                          src={`/api/thumbnails/${item.firstAlbumPath.split('public/albums/')[1]}/${item.firstPhoto}`}
                          alt={`${item.displayName} preview`}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : null}
                      
                      {/* Overlay with group icon */}
                      <div className="relative z-10 text-center bg-black/50 p-4 rounded-lg">
                        <svg className="h-16 w-16 text-purple-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <span className="text-purple-300 font-medium">Group</span>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="text-lg font-semibold text-slate-100 mb-2">
                        {item.displayName}*
                      </h3>
                      <p className="text-sm text-slate-300 mb-2">
                        Album Group
                      </p>
                      <p className="text-xs text-slate-400">
                        Click to view albums in this group
                      </p>
                    </div>
                  </Link>
                );
              } else {
                return (
                  <Link
                    key={item.path}
                    href={`/albums/${selectedYear}/${item.name}`}
                    className={`block bg-slate-700 rounded-lg shadow-md overflow-hidden hover:shadow-lg hover:bg-slate-600 transition-all duration-300 ${item.isNested ? 'ml-8 border-l-4 border-l-blue-500' : ''}`}
                  >
                    <div className="h-48 bg-slate-600 relative overflow-hidden flex items-center justify-center">
                      {item.firstPhoto ? (
                        <img
                          src={`/api/thumbnails/${item.path.split('public/albums/')[1]}/${item.firstPhoto}`}
                          alt={`${item.displayName} preview`}
                          className="max-w-full max-h-full object-contain"
                        />
                      ) : (
                        <div className="h-full flex items-center justify-center bg-slate-600">
                          <svg className="h-16 w-16 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      
                      {/* Overlay for album info on hover - positioned to not interfere with image */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-2 opacity-0 hover:opacity-100 transition-opacity duration-300">
                        <p className="text-sm font-medium text-white truncate">
                          {item.metadata?.photos?.length || 0} photos
                        </p>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="text-lg font-semibold text-slate-100 mb-2">
                        {item.displayName}
                        {item.isNested && <span className="ml-2 text-blue-400 text-sm">(nested)</span>}
                      </h3>
                      {item.metadata?.location && (
                        <p className="text-sm text-slate-300 mb-1">
                          📍 {item.metadata.location}
                        </p>
                      )}
                      {item.metadata?.description && (
                        <p className="text-sm text-slate-300 mb-2">
                          {item.metadata.description}
                        </p>
                      )}
                      <p className="text-xs text-slate-400">
                        Created: {item.metadata?.created ? new Date(item.metadata.created).toLocaleDateString() : 'Unknown'}
                      </p>
                    </div>
                  </Link>
                );
              }
            })}
          </div>
        )}

        {selectedYear && albums.length === 0 && (
          <div className="text-center py-12">
            <div className="text-slate-400">No albums found for {selectedYear}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Albums() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading albums...</div>
      </div>
    }>
      <AlbumsContent />
    </Suspense>
  );
}