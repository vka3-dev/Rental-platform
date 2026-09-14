package com.rentalplatform.backend.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.rentalplatform.backend.entity.Notification;
import com.rentalplatform.backend.service.NotificationService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {
    private final NotificationService notificationService;

    @GetMapping("/recipient/{recipientId}")
    public List<Notification> getByRecipient(@PathVariable UUID recipientId) {
        return notificationService.getByRecipient(recipientId);
    }

    @PutMapping("/{notificationId}/read")
    public Notification markRead(@PathVariable Long notificationId) {
        return notificationService.markRead(notificationId);
    }

    @PutMapping("/recipient/{recipientId}/read-all")
    public void markAllRead(@PathVariable UUID recipientId) {
        notificationService.markAllRead(recipientId);
    }
}
