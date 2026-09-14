package com.rentalplatform.backend.controller;

import java.util.List;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.rentalplatform.backend.entity.Review;
import com.rentalplatform.backend.service.ReviewService;

@RestController
@RequestMapping("/api/reviews")
public class ReviewController {

    private final ReviewService service;

    public ReviewController(ReviewService service) {
        this.service = service;
    }

    @PostMapping
    public Review create(@RequestBody Review review) {
        return service.createReview(review);
    }

    @GetMapping
    public List<Review> getAll() {
        return service.getAllReviews();
    }

    @GetMapping("/{id}")
    public Review getById(@PathVariable Long id) {
        return service.getReviewById(id);
    }

    @GetMapping("/reviewee/{revieweeId}")
    public List<Review> getByReviewee(@PathVariable java.util.UUID revieweeId) {
        return service.getByReviewee(revieweeId);
    }

    @GetMapping("/reviewer/{reviewerId}")
    public List<Review> getByReviewer(@PathVariable java.util.UUID reviewerId) {
        return service.getByReviewer(reviewerId);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        service.deleteReview(id);
    }
}