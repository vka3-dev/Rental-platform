package com.rentalplatform.backend.service;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.rentalplatform.backend.entity.Booking;
import com.rentalplatform.backend.entity.Review;
import com.rentalplatform.backend.repository.BookingRepository;
import com.rentalplatform.backend.repository.ReviewRepository;

@Service
public class ReviewService {

    private static final Set<String> REVIEWABLE_STATUSES = Set.of("RETURNED", "COMPLETED");

    private final ReviewRepository reviewRepository;
    private final BookingRepository bookingRepository;

    public ReviewService(ReviewRepository reviewRepository, BookingRepository bookingRepository) {
        this.reviewRepository = reviewRepository;
        this.bookingRepository = bookingRepository;
    }

    public Review createReview(Review review) {
        if (review.getBookingId() == null || review.getReviewerId() == null || review.getRevieweeId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "bookingId, reviewerId and revieweeId are required");
        }

        if (review.getRating() == null
                || review.getRating().compareTo(BigDecimal.ONE) < 0
                || review.getRating().compareTo(BigDecimal.valueOf(5)) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Rating must be between 1 and 5");
        }

        Booking booking = bookingRepository.findById(review.getBookingId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));

        boolean renterReviewsLender = review.getReviewerId().equals(booking.getRenterId())
                && review.getRevieweeId().equals(booking.getLenderId());
        boolean lenderReviewsRenter = review.getReviewerId().equals(booking.getLenderId())
                && review.getRevieweeId().equals(booking.getRenterId());

        if (!renterReviewsLender && !lenderReviewsRenter) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Reviewer and reviewee do not match the participants of this booking");
        }

        if (!REVIEWABLE_STATUSES.contains(booking.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This booking cannot be reviewed until the rental has been returned or completed");
        }

        // One review per (booking, reviewer) — lets both sides of the same booking review each other
        // independently instead of overwriting one another.
        Optional<Review> existing = reviewRepository.findByBookingIdAndReviewerId(
                review.getBookingId(), review.getReviewerId());
        if (existing.isPresent()) {
            Review current = existing.get();
            current.setRating(review.getRating());
            current.setComment(review.getComment());
            return reviewRepository.save(current);
        }

        review.setCreatedAt(review.getCreatedAt() != null ? review.getCreatedAt() : OffsetDateTime.now());
        return reviewRepository.save(review);
    }

    public List<Review> getAllReviews() {
        return reviewRepository.findAll();
    }

    public Review getReviewById(Long id) {
        return reviewRepository.findById(id)
                .orElse(null);
    }

    public List<Review> getByReviewee(UUID revieweeId) {
        return reviewRepository.findByRevieweeIdOrderByCreatedAtDesc(revieweeId);
    }

    public List<Review> getByReviewer(UUID reviewerId) {
        return reviewRepository.findByReviewerId(reviewerId);
    }

    public void deleteReview(Long id) {
        reviewRepository.deleteById(id);
    }
}
