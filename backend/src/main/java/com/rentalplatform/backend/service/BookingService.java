package com.rentalplatform.backend.service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.rentalplatform.backend.entity.Booking;
import com.rentalplatform.backend.entity.Item;
import com.rentalplatform.backend.repository.BookingRepository;
import com.rentalplatform.backend.repository.ItemRepository;
import com.rentalplatform.backend.repository.ReturnRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor

public class BookingService {
    private final BookingRepository bookingRepository;
    private final ItemRepository itemRepository;
    private final ReturnRepository returnRepository;
    private final NotificationService notificationService;

    public Booking createBooking(Booking booking) {

        if (booking.getItemId() == null || booking.getRenterId() == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Item and renter are required");
        }

        if (booking.getStartTime() == null || booking.getEndTime() == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Start time and end time are required");
        }

        if (!booking.getEndTime().isAfter(booking.getStartTime())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "End time must be after start time");
        }

        Item item = itemRepository.findById(booking.getItemId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Item not found"));

        booking.setLenderId(item.getOwnerId());
        
        int maxQuantity = item.getQuantity() != null ? item.getQuantity() : 1;
        if (!Boolean.TRUE.equals(item.getAvailability()) || maxQuantity <= 0) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Item is currently unavailable");
        }

        long overlappingBookings = bookingRepository.countOverlappingBookings(
                booking.getItemId(),
                booking.getStartTime(),
                booking.getEndTime()
        );

        if (overlappingBookings >= maxQuantity) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Item is already fully booked for this period");
        }

        booking.setPrice(item.getRentalPrice());

        booking.setSecurityDeposit(item.getSecurityDeposit());

        booking.setStatus("REQUESTED");

        if ("DELIVERY_PARTNER".equals(booking.getDeliveryMethod())) {
            booking.setDeliveryPartner("Speedy Logistics Demo Agent");
        }

        return bookingRepository.save(booking);

    }

    public List<Booking> getByRenter(UUID renterId) {
        return bookingRepository.findByRenterIdOrderByBookingIdDesc(renterId);
    }

    public List<Booking> getByLender(UUID lenderId) {
        return bookingRepository.findByLenderIdOrderByCreatedAtDesc(lenderId);
    }

    public Booking updateStatus(Long bookingId, String status) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));

        booking.setStatus(status);
        Booking saved = bookingRepository.save(booking);

        String itemName = booking.getItemId() != null
                ? itemRepository.findById(booking.getItemId())
                        .map(Item::getItemName)
                        .orElse("this item")
                : "this item";

        // If lender accepts/approves a borrow request, automatically reject all other pending requests for the same item
        if ("APPROVED".equalsIgnoreCase(status) && booking.getItemId() != null) {
            List<Booking> otherPendingBookings = bookingRepository
                    .findByItemIdAndStatusAndBookingIdNot(booking.getItemId(), "REQUESTED", booking.getBookingId());

            String autoRejectReason = "Another renter's request for \"" + itemName
                    + "\" was approved, so this request was automatically declined because the item is now rented out.";

            for (Booking other : otherPendingBookings) {
                other.setStatus("REJECTED");
                other.setRejectionReason(autoRejectReason);
                bookingRepository.save(other);

                notificationService.create(
                        other.getRenterId(),
                        "REQUEST_REJECTED",
                        "Request Declined",
                        autoRejectReason,
                        other.getBookingId());
            }

            notificationService.create(
                    booking.getRenterId(),
                    "REQUEST_APPROVED",
                    "Request Approved!",
                    "Your request for \"" + itemName + "\" has been approved by the lender.",
                    booking.getBookingId());
        } else if ("REJECTED".equalsIgnoreCase(status)) {
            notificationService.create(
                    booking.getRenterId(),
                    "REQUEST_REJECTED",
                    "Request Declined",
                    "Your request for \"" + itemName + "\" was declined by the lender.",
                    booking.getBookingId());
        }

        return saved;
    }

    public Booking completeReturn(Long bookingId, boolean relistProduct) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));

        booking.setStatus("COMPLETED");
        bookingRepository.save(booking);

        // Update return record status if present
        returnRepository.findByBookingId(bookingId).ifPresent(rentalReturn -> {
            rentalReturn.setStatus("CONFIRMED_BY_LENDER");
            returnRepository.save(rentalReturn);
        });

        // Update item availability and quantity based on lender choice
        if (booking.getItemId() != null) {
            itemRepository.findById(booking.getItemId()).ifPresent(item -> {
                if (relistProduct) {
                    int currentQty = item.getQuantity() != null ? item.getQuantity() : 0;
                    item.setQuantity(Math.max(1, currentQty + 1));
                    item.setAvailability(true);
                } else {
                    item.setAvailability(false);
                }
                itemRepository.save(item);
            });
        }

        return booking;
    }

    public Map<String, Object> getCustomerHistory(UUID lenderId, UUID renterId) {
        long timesWithLender = bookingRepository.countByLenderIdAndRenterId(lenderId, renterId);
        long totalRentals = bookingRepository.countByRenterId(renterId);

        Map<String, Object> stats = new HashMap<>();
        stats.put("timesWithLender", timesWithLender);
        stats.put("totalRentals", totalRentals);
        stats.put("hasRentedBefore", timesWithLender > 0);
        return stats;
    }
}
