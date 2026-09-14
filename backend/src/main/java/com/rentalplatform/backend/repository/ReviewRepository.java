package com.rentalplatform.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.rentalplatform.backend.entity.Review;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ReviewRepository extends JpaRepository<Review, Long> {
    List<Review> findByRevieweeIdOrderByCreatedAtDesc(UUID revieweeId);
    List<Review> findByReviewerId(UUID reviewerId);
    Optional<Review> findByBookingIdAndReviewerId(Long bookingId, UUID reviewerId);
}
