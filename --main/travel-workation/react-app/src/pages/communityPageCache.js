let cachedTravelPosts = null;

export function readCommunityPageCache() {
  return cachedTravelPosts;
}

export function writeCommunityPageCache(data) {
  cachedTravelPosts = data;
}

export function clearCommunityPageCache() {
  cachedTravelPosts = null;
}
