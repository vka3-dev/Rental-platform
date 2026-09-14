package com.rentalplatform.backend.entity;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "bookings")
@Data
@NoArgsConstructor
public class Booking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "booking_id")
    private Long bookingId;

    @Column(name = "item_id")
    private Long itemId;

    @Column(name = "renter_id")
    private UUID renterId;

    @Column(name = "lender_id")
    private UUID lenderId;

    @Column(name = "start_time")
    private Instant startTime;

    @Column(name = "end_time")
    private Instant endTime;

    @Column(name = "price")
    private BigDecimal price;

    @Column(name = "security_deposit")
    private BigDecimal securityDeposit;

    @Column(name = "status")
    private String status;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "delivery_method")
    private String deliveryMethod;

    @Column(name = "delivery_partner")
    private String deliveryPartner;

    @Column(name = "rejection_reason")
    private String rejectionReason;
}