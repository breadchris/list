import type { ContentItem, TMDbSearchResponse, TMDbMovie, TMDbTVShow } from './types.js';

export async function processTMDbSearchForContent(
  supabase: any,
  contentItem: ContentItem,
  searchType: 'movie' | 'tv' | 'multi',
  mode: 'search-only' | 'add-selected',
  selectedResults?: number[]
) {
  // Extract search query from content data (use the full text as query)
  const query = contentItem.data.trim();

  if (!query || query.length === 0) {
    return {
      content_id: contentItem.id,
      success: true,
      queries_found: 0,
      results_created: 0,
      tmdb_children: [],
      tmdb_results: []
    };
  }

  const tmdbChildren: ContentItem[] = [];
  const errors: string[] = [];

  try {
    // Get TMDb API key from environment
    const tmdbApiKey = process.env.TMDB_API_KEY;
    if (!tmdbApiKey) {
      throw new Error('TMDB_API_KEY environment variable not configured');
    }

    // Call TMDb search API
    const endpoint = searchType === 'multi'
      ? `https://api.themoviedb.org/3/search/multi`
      : `https://api.themoviedb.org/3/search/${searchType}`;

    const searchUrl = `${endpoint}?query=${encodeURIComponent(query)}&page=1`;

    const tmdbResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${tmdbApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!tmdbResponse.ok) {
      throw new Error(`TMDb API error: ${tmdbResponse.status}`);
    }

    const searchResults: TMDbSearchResponse = await tmdbResponse.json();

    if (!searchResults.results || searchResults.results.length === 0) {
      return {
        content_id: contentItem.id,
        success: true,
        queries_found: 1,
        results_created: 0,
        tmdb_children: [],
        tmdb_results: [],
        total_results: 0
      };
    }

    // For search-only mode, return results without creating content
    if (mode === 'search-only') {
      const formattedResults = searchResults.results.slice(0, 20).map(result => {
        const isMovie = 'title' in result || result.media_type === 'movie';
        const isTVShow = 'name' in result || result.media_type === 'tv';

        // Skip person results from multi search
        if (!isMovie && !isTVShow) {
          return null;
        }

        let title: string;
        let year: string;
        let overview: string;
        let mediaType: string;

        if (isMovie) {
          const movie = result as TMDbMovie;
          title = movie.title || movie.original_title;
          year = movie.release_date ? new Date(movie.release_date).getFullYear().toString() : '';
          overview = movie.overview || '';
          mediaType = 'movie';
        } else {
          const show = result as TMDbTVShow;
          title = show.name || show.original_name;
          year = show.first_air_date ? new Date(show.first_air_date).getFullYear().toString() : '';
          overview = show.overview || '';
          mediaType = 'tv';
        }

        const posterUrl = result.poster_path
          ? `https://image.tmdb.org/t/p/w500${result.poster_path}`
          : null;

        const backdropUrl = result.backdrop_path
          ? `https://image.tmdb.org/t/p/w1280${result.backdrop_path}`
          : null;

        return {
          tmdb_id: result.id,
          media_type: mediaType,
          title,
          year,
          overview,
          poster_url: posterUrl,
          backdrop_url: backdropUrl,
          vote_average: result.vote_average,
          vote_count: result.vote_count,
          popularity: result.popularity
        };
      }).filter(Boolean);

      return {
        content_id: contentItem.id,
        success: true,
        queries_found: 1,
        results_created: 0,
        tmdb_children: [],
        tmdb_results: formattedResults,
        total_results: searchResults.total_results
      };
    }

    // For add-selected mode, filter results by selectedResults IDs
    const resultsToCreate = searchResults.results.filter(result =>
      selectedResults && selectedResults.includes(result.id)
    );

    for (const result of resultsToCreate) {
      try {
        const isMovie = 'title' in result || result.media_type === 'movie';
        const isTVShow = 'name' in result || result.media_type === 'tv';

        // Skip person results from multi search
        if (!isMovie && !isTVShow) {
          continue;
        }

        let title: string;
        let year: string;
        let overview: string;
        let mediaType: string;

        if (isMovie) {
          const movie = result as TMDbMovie;
          title = movie.title || movie.original_title;
          year = movie.release_date ? new Date(movie.release_date).getFullYear().toString() : '';
          overview = movie.overview || '';
          mediaType = 'movie';
        } else {
          const show = result as TMDbTVShow;
          title = show.name || show.original_name;
          year = show.first_air_date ? new Date(show.first_air_date).getFullYear().toString() : '';
          overview = show.overview || '';
          mediaType = 'tv';
        }

        // Format data: "Title (Year)\nOverview"
        const displayText = year
          ? `${title} (${year})\n${overview}`
          : `${title}\n${overview}`;

        // Construct poster URL if available
        const posterUrl = result.poster_path
          ? `https://image.tmdb.org/t/p/w500${result.poster_path}`
          : null;

        const backdropUrl = result.backdrop_path
          ? `https://image.tmdb.org/t/p/w1280${result.backdrop_path}`
          : null;

        // Create content item
        const { data: newContent, error: createError } = await supabase
          .from('content')
          .insert({
            type: 'text',
            data: displayText,
            group_id: contentItem.group_id,
            user_id: contentItem.user_id,
            parent_content_id: contentItem.id,
            metadata: {
              tmdb_id: result.id,
              tmdb_media_type: mediaType,
              tmdb_title: title,
              tmdb_overview: overview,
              tmdb_poster_path: result.poster_path,
              tmdb_poster_url: posterUrl,
              tmdb_backdrop_path: result.backdrop_path,
              tmdb_backdrop_url: backdropUrl,
              tmdb_vote_average: result.vote_average,
              tmdb_vote_count: result.vote_count,
              tmdb_popularity: result.popularity,
              tmdb_genre_ids: result.genre_ids,
              tmdb_original_language: result.original_language,
              tmdb_release_date: isMovie ? (result as TMDbMovie).release_date : (result as TMDbTVShow).first_air_date,
              source_query: query,
              extracted_from_tmdb_search: true
            }
          })
          .select()
          .single();

        if (createError) {
          console.error(`Error creating TMDb content for ${title}:`, createError);
          errors.push(`Error creating content for ${title}: ${createError.message}`);
          continue;
        }

        if (newContent) {
          tmdbChildren.push(newContent as ContentItem);
        }

      } catch (error: any) {
        console.error(`Error processing TMDb result:`, error);
        errors.push(`Error processing result: ${error.message}`);
      }
    }

  } catch (error: any) {
    console.error(`Error searching TMDb for query "${query}":`, error);
    errors.push(`Error searching TMDb: ${error.message}`);
  }

  return {
    content_id: contentItem.id,
    success: errors.length === 0,
    queries_found: 1,
    results_created: tmdbChildren.length,
    tmdb_children: tmdbChildren,
    errors: errors.length > 0 ? errors : undefined
  };
}
