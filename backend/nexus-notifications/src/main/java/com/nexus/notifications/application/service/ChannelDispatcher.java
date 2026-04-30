package com.nexus.notifications.application.service;

import com.nexus.notifications.domain.model.NotificationTemplate;
import com.nexus.notifications.domain.model.NotificationTemplate.Channel;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;
import java.util.Random;
import java.util.UUID;

/**
 * Pluggable channel dispatchers. In simulate mode, always succeeds (or randomly
 * fails 5% of the time for SMS) and returns a synthetic provider reference.
 * Replace these methods with real SMTP / SMS gateway / HTTP webhook calls in production.
 */
@Component
public class ChannelDispatcher {

    private final Random rng = new Random();

    public DispatchResult dispatch(Channel ch, String recipient, String subject, String body, boolean simulate) {
        long start = System.currentTimeMillis();
        try {
            if (simulate) return simulateDispatch(ch, recipient, start);
            // ---- Real dispatch hooks (no-op stubs) ----
            switch (ch) {
                case EMAIL:   return success("smtp",     "msg-" + UUID.randomUUID(), "queued at SMTP", start);
                case SMS:     return success("sms-gw",   "sms-" + UUID.randomUUID(), "submitted to gateway", start);
                case WEBHOOK: return success("http",     "POST 200", "delivered to webhook", start);
                case IN_APP:  return success("in-app",   "feed-" + UUID.randomUUID(), "queued in user feed", start);
            }
        } catch (Exception e) {
            return failure("provider error: " + e.getMessage(), start);
        }
        return failure("unknown channel", start);
    }

    private DispatchResult simulateDispatch(Channel ch, String to, long start) {
        // Tiny synthetic delay so durations look realistic
        try { Thread.sleep(20 + rng.nextInt(40)); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
        // SMS occasionally fails to demonstrate retry behaviour
        if (ch == Channel.SMS && rng.nextInt(20) == 0)
            return failure("simulated SMS gateway timeout", start);
        return success(ch.name().toLowerCase() + "-sim", "sim-" + UUID.randomUUID(),
            "simulated delivery to " + to, start);
    }

    private DispatchResult success(String provider, String ref, String msg, long start) {
        return new DispatchResult(true, provider, ref, msg, System.currentTimeMillis() - start);
    }
    private DispatchResult failure(String msg, long start) {
        return new DispatchResult(false, "simulator", null, msg, System.currentTimeMillis() - start);
    }

    public record DispatchResult(boolean success, String provider, String providerRef, String message, long durationMs) {}

    /** Tiny mustache-style {{var}} renderer for templates. */
    public static String render(String template, Map<String, Object> ctx) {
        if (template == null) return null;
        if (ctx == null) return template;
        String out = template;
        for (Map.Entry<String,Object> e : ctx.entrySet()) {
            String val = e.getValue() == null ? "" : String.valueOf(e.getValue());
            out = out.replace("{{" + e.getKey() + "}}", val);
        }
        return out;
    }

    public static Map<String,Object> safeContext(Map<String,Object> in) {
        return in == null ? new HashMap<>() : new HashMap<>(in);
    }
}
