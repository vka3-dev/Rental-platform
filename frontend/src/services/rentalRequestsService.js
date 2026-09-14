import {
  getBookingsByLender,
  getProductById,
  getUserById,
  getReviewsByReviewee,
  getCustomerHistory,
} from "./api";

let cachedRequests = null;
let cachedLenderId = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 1000;

let inFlightFetch = null;

const itemCache = new Map();
const userCache = new Map();
const reviewsCache = new Map();
const customerHistoryCache = new Map();

export function getCachedRequests(lenderId) {
  if (
    cachedRequests &&
    cachedLenderId === lenderId &&
    Date.now() - lastFetchTime < CACHE_TTL_MS * 5
  ) {
    return cachedRequests;
  }
  return null;
}

export function invalidateRequestsCache() {
  cachedRequests = null;
  cachedLenderId = null;
  lastFetchTime = 0;
  inFlightFetch = null;
  itemCache.clear();
  userCache.clear();
  reviewsCache.clear();
  customerHistoryCache.clear();
}

export async function fetchRentalRequestsWithDetails(lenderId, { forceRefresh = false } = {}) {
  if (!lenderId) return [];

  if (
    !forceRefresh &&
    cachedRequests &&
    cachedLenderId === lenderId &&
    Date.now() - lastFetchTime < CACHE_TTL_MS
  ) {
    return cachedRequests;
  }

  if (inFlightFetch && cachedLenderId === lenderId && !forceRefresh) {
    return inFlightFetch;
  }

  inFlightFetch = (async () => {
    try {
      const lenderRequests = await getBookingsByLender(lenderId);
      if (!Array.isArray(lenderRequests) || lenderRequests.length === 0) {
        cachedRequests = [];
        cachedLenderId = lenderId;
        lastFetchTime = Date.now();
        return [];
      }

      const uniqueItemIds = Array.from(
        new Set(lenderRequests.map((r) => r.itemId).filter(Boolean))
      );
      const uniqueRenterIds = Array.from(
        new Set(lenderRequests.map((r) => r.renterId).filter(Boolean))
      );

      await Promise.all(
        uniqueItemIds.map(async (itemId) => {
          if (!itemCache.has(itemId)) {
            try {
              const item = await getProductById(itemId);
              itemCache.set(itemId, item);
            } catch {
              itemCache.set(itemId, null);
            }
          }
        })
      );

      await Promise.all(
        uniqueRenterIds.map(async (renterId) => {
          const fetchUser = !userCache.has(renterId)
            ? getUserById(renterId)
                .then((u) => userCache.set(renterId, u))
                .catch(() => userCache.set(renterId, null))
            : Promise.resolve();

          const fetchReviews = !reviewsCache.has(renterId)
            ? getReviewsByReviewee(renterId)
                .then((revs) => reviewsCache.set(renterId, revs || []))
                .catch(() => reviewsCache.set(renterId, []))
            : Promise.resolve();

          const historyKey = `${lenderId}_${renterId}`;
          const fetchHistory = !customerHistoryCache.has(historyKey)
            ? getCustomerHistory(lenderId, renterId)
                .then((hist) => customerHistoryCache.set(historyKey, hist))
                .catch(() => customerHistoryCache.set(historyKey, null))
            : Promise.resolve();

          await Promise.all([fetchUser, fetchReviews, fetchHistory]);
        })
      );

      const requestsWithDetails = lenderRequests.map((request) => {
        const item = itemCache.get(request.itemId) || null;
        const borrower = userCache.get(request.renterId) || null;
        const reviews = reviewsCache.get(request.renterId) || [];
        const customerHistory =
          customerHistoryCache.get(`${lenderId}_${request.renterId}`) || null;

        return {
          ...request,
          item,
          borrower,
          reviews,
          customerHistory,
        };
      });

      cachedRequests = requestsWithDetails;
      cachedLenderId = lenderId;
      lastFetchTime = Date.now();
      return requestsWithDetails;
    } finally {
      inFlightFetch = null;
    }
  })();

  return inFlightFetch;
}

export function preloadRentalRequests(lenderId) {
  if (!lenderId) return;
  fetchRentalRequestsWithDetails(lenderId).catch((err) => {
    console.warn("Background preload of rental requests failed:", err);
  });
}
