'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Album {
  name: string;
  path: string;
  metadata: {
    name: string;
    location: string;
    description: string;
    created: string;
  } | null;
}

export default function Albums() {
  const [years, setYears] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchYears();
  }, []);

  useEffect(() => {
    if (selectedYear) {
      fetchAlbums(selectedYear);
    }
  }, [selectedYear]);

  const fetchYears = async () => {
    try {
      const response = await fetch('/api/albums');
      const data = await response.json();
      setYears(data.years || []);
      if (data.years && data.years.length > 0) {
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
      const response = await fetch(`/api/albums?year=${year}`);
      const data = await response.json();
      setAlbums(data.albums || []);
    } catch (error) {
      console.error('Error fetching albums:', error);
    }
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
            onChange={(e) => setSelectedYear(e.target.value)}
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
            {albums.map((album) => (
              <Link
                key={album.path}
                href={`/albums/${selectedYear}/${album.name}`}
                className="block bg-slate-700 rounded-lg shadow-md overflow-hidden hover:shadow-lg hover:bg-slate-600 transition-all duration-300"
              >
                <div className="h-48 bg-slate-600 flex items-center justify-center">
                  <svg className="h-16 w-16 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-slate-100 mb-2">
                    {album.metadata?.name || album.name}
                  </h3>
                  {album.metadata?.location && (
                    <p className="text-sm text-slate-300 mb-1">
                      📍 {album.metadata.location}
                    </p>
                  )}
                  {album.metadata?.description && (
                    <p className="text-sm text-slate-300 mb-2">
                      {album.metadata.description}
                    </p>
                  )}
                  <p className="text-xs text-slate-400">
                    Created: {album.metadata?.created ? new Date(album.metadata.created).toLocaleDateString() : 'Unknown'}
                  </p>
                </div>
              </Link>
            ))}
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