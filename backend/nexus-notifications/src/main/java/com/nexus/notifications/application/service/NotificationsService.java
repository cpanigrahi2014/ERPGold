package com.nexus.notifications.application.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexus.notifications.application.dto.NotificationsDtos.*;
import com.nexus.notifications.application.support.CurrentContext;
import com.nexus.notifications.domain.model.*;
import com.nexus.notifications.domain.repository.*;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class NotificationsService {

    private final NotificationTemplateRepository templates;
    private final NotificationRepository notifications;
    private final DeliveryAttemptRepository attempts;
    private final ChannelDispatcher dispatcher;
    private final CurrentContext ctx;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${nexus.notifications.dispatch.simulate:true}") private boolean simulate;
    @Value("${nexus.notifications.dispatch.max-attempts:3}") private int maxAttempts;
    @Value("${nexus.notifications.dispatch.enabled:true}") private boolean dispatchEnabled;

    // ---------- Templates ----------
    @Transactional
    public TemplateResponse upsertTemplate(TemplateRequest r) {
        UUID t = ctx.tenantId();
        NotificationTemplate tpl = templates.findByTenantIdAndCode(t, r.code()).orElseGet(NotificationTemplate::new);
        tpl.setCode(r.code()); tpl.setName(r.name());
        tpl.setChannel(r.channel()); tpl.setSubjectTpl(r.subjectTpl());
        tpl.setBodyTpl(r.bodyTpl());
        tpl.setActive(r.active() == null ? Boolean.TRUE : r.active());
        tpl.setDescription(r.description());
        stamp(tpl);
        return toTemplate(templates.save(tpl));
    }

    public List<TemplateResponse> listTemplates() {
        return templates.findByTenantIdOrderByCodeAsc(ctx.tenantId()).stream().map(this::toTemplate).toList();
    }

    // ---------- Send ----------
    @Transactional
    public NotificationResponse send(SendRequest r) {
        UUID t = ctx.tenantId();
        Map<String,Object> context = ChannelDispatcher.safeContext(r.context());

        String subject = r.subject();
        String body    = r.body();
        NotificationTemplate.Channel channel = r.channel();
        UUID templateId = null;
        String templateCode = r.templateCode();

        if (templateCode != null && !templateCode.isBlank()) {
            NotificationTemplate tpl = templates.findByTenantIdAndCode(t, templateCode)
                .orElseThrow(() -> new EntityNotFoundException("Template not found: " + templateCode));
            if (!Boolean.TRUE.equals(tpl.getActive())) throw new IllegalStateException("Template inactive: " + templateCode);
            templateId = tpl.getId();
            if (channel == null) channel = tpl.getChannel();
            if (subject == null || subject.isBlank()) subject = ChannelDispatcher.render(tpl.getSubjectTpl(), context);
            if (body    == null || body.isBlank())    body    = ChannelDispatcher.render(tpl.getBodyTpl(), context);
        }
        if (channel == null) throw new IllegalArgumentException("channel is required when no template is supplied");
        if (body    == null || body.isBlank()) throw new IllegalArgumentException("body is required");

        String contextJson = null;
        try { contextJson = objectMapper.writeValueAsString(context); }
        catch (JsonProcessingException e) { /* ignore */ }

        Notification n = Notification.builder()
            .templateId(templateId).templateCode(templateCode)
            .channel(channel)
            .recipient(r.recipient()).recipientName(r.recipientName())
            .subject(subject).body(body)
            .contextJson(contextJson)
            .sourceModule(r.sourceModule()).sourceRef(r.sourceRef())
            .status(Notification.Status.PENDING).attempts(0)
            .build();
        stamp(n);
        n = notifications.save(n);
        // Attempt immediate dispatch
        attemptDeliver(n);
        return toNotification(n);
    }

    public List<NotificationResponse> list(Notification.Status status) {
        UUID t = ctx.tenantId();
        List<Notification> list = (status != null)
            ? notifications.findByTenantIdAndStatusOrderByCreatedAtDesc(t, status)
            : notifications.findTop200ByTenantIdOrderByCreatedAtDesc(t);
        return list.stream().map(this::toNotification).toList();
    }

    public NotificationResponse get(UUID id) {
        return toNotification(notifications.findById(id).orElseThrow(() -> new EntityNotFoundException("Notification not found")));
    }

    public List<AttemptResponse> attemptsFor(UUID notificationId) {
        return attempts.findByNotificationIdOrderByAttemptNoAsc(notificationId).stream().map(this::toAttempt).toList();
    }

    @Transactional
    public NotificationResponse retry(UUID id) {
        Notification n = notifications.findById(id).orElseThrow(() -> new EntityNotFoundException("Notification not found"));
        if (n.getStatus() == Notification.Status.SENT) throw new IllegalStateException("Already SENT");
        if (n.getStatus() == Notification.Status.CANCELLED) throw new IllegalStateException("Cancelled");
        attemptDeliver(n);
        return toNotification(n);
    }

    @Transactional
    public NotificationResponse cancel(UUID id) {
        Notification n = notifications.findById(id).orElseThrow(() -> new EntityNotFoundException("Notification not found"));
        if (n.getStatus() == Notification.Status.SENT) throw new IllegalStateException("Already SENT");
        n.setStatus(Notification.Status.CANCELLED);
        stamp(n);
        return toNotification(notifications.save(n));
    }

    // ---------- Background retry ----------
    @Scheduled(fixedDelayString = "${nexus.notifications.dispatch.poll-ms:15000}")
    @Transactional
    public void retryPending() {
        if (!dispatchEnabled) return;
        List<Notification> due = notifications.findTop50ByStatusAndAttemptsLessThanOrderByCreatedAtAsc(
            Notification.Status.PENDING, maxAttempts);
        for (Notification n : due) {
            try { attemptDeliver(n); } catch (Exception e) { log.warn("Retry failed for {}: {}", n.getId(), e.getMessage()); }
        }
    }

    private void attemptDeliver(Notification n) {
        if (n.getAttempts() != null && n.getAttempts() >= maxAttempts) {
            n.setStatus(Notification.Status.FAILED);
            stamp(n); notifications.save(n);
            return;
        }
        int attemptNo = (n.getAttempts() == null ? 0 : n.getAttempts()) + 1;
        ChannelDispatcher.DispatchResult res = dispatcher.dispatch(n.getChannel(), n.getRecipient(), n.getSubject(), n.getBody(), simulate);

        DeliveryAttempt da = DeliveryAttempt.builder()
            .notificationId(n.getId())
            .attemptNo(attemptNo)
            .attemptedAt(OffsetDateTime.now())
            .result(res.success() ? DeliveryAttempt.Result.SUCCESS : DeliveryAttempt.Result.FAILED)
            .provider(res.provider()).providerRef(res.providerRef())
            .responseMessage(res.message()).durationMs(res.durationMs())
            .build();
        stamp(da);
        attempts.save(da);

        n.setAttempts(attemptNo);
        n.setLastAttemptAt(OffsetDateTime.now());
        if (res.success()) {
            n.setStatus(Notification.Status.SENT);
            n.setSentAt(OffsetDateTime.now());
            n.setLastError(null);
        } else {
            n.setLastError(res.message());
            n.setStatus(attemptNo >= maxAttempts ? Notification.Status.FAILED : Notification.Status.PENDING);
        }
        stamp(n);
        notifications.save(n);
    }

    // ---------- helpers ----------
    private void stamp(com.nexus.common.domain.BaseEntity e) {
        UUID t = ctx.tenantId(); UUID u = ctx.userId();
        if (e.getTenantId() == null) e.setTenantId(t);
        if (e.getCreatedBy() == null) e.setCreatedBy(u);
        e.setUpdatedBy(u);
    }
    private TemplateResponse toTemplate(NotificationTemplate t) {
        return new TemplateResponse(t.getId(), t.getCode(), t.getName(), t.getChannel(),
            t.getSubjectTpl(), t.getBodyTpl(), t.getActive(), t.getDescription());
    }
    private NotificationResponse toNotification(Notification n) {
        return new NotificationResponse(n.getId(), n.getTemplateCode(), n.getChannel(),
            n.getRecipient(), n.getRecipientName(), n.getSubject(), n.getBody(),
            n.getSourceModule(), n.getSourceRef(),
            n.getStatus(), n.getAttempts(),
            n.getLastAttemptAt(), n.getSentAt(), n.getLastError(),
            n.getCreatedAt());
    }
    private AttemptResponse toAttempt(DeliveryAttempt a) {
        return new AttemptResponse(a.getId(), a.getNotificationId(), a.getAttemptNo(), a.getAttemptedAt(),
            a.getResult(), a.getProvider(), a.getProviderRef(), a.getResponseMessage(), a.getDurationMs());
    }
}
