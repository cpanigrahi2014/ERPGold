package com.nexus.notifications.web;

import com.nexus.notifications.application.dto.NotificationsDtos.*;
import com.nexus.notifications.application.service.NotificationsService;
import com.nexus.notifications.domain.model.Notification;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
public class NotificationsController {
    private final NotificationsService svc;

    // ---- Templates ----
    @GetMapping("/templates")
    public List<TemplateResponse> templates() { return svc.listTemplates(); }

    @PostMapping("/templates")
    public ResponseEntity<TemplateResponse> upsertTemplate(@Valid @RequestBody TemplateRequest r) {
        return ResponseEntity.status(201).body(svc.upsertTemplate(r));
    }

    // ---- Send ----
    @PostMapping("/send")
    public ResponseEntity<NotificationResponse> send(@Valid @RequestBody SendRequest r) {
        return ResponseEntity.status(201).body(svc.send(r));
    }

    @GetMapping
    public List<NotificationResponse> list(@RequestParam(required = false) Notification.Status status) {
        return svc.list(status);
    }

    @GetMapping("/{id}")
    public NotificationResponse get(@PathVariable UUID id) { return svc.get(id); }

    @GetMapping("/{id}/attempts")
    public List<AttemptResponse> attempts(@PathVariable UUID id) { return svc.attemptsFor(id); }

    @PostMapping("/{id}/retry")
    public NotificationResponse retry(@PathVariable UUID id) { return svc.retry(id); }

    @PostMapping("/{id}/cancel")
    public NotificationResponse cancel(@PathVariable UUID id) { return svc.cancel(id); }
}
