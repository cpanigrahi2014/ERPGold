package com.nexus.admin.application.service;

import com.nexus.admin.application.support.AccountStatusException;
import com.nexus.admin.application.support.CurrentContext;
import com.nexus.admin.domain.model.AppUser;
import com.nexus.admin.domain.model.Roles;
import com.nexus.admin.domain.model.UserStatus;
import com.nexus.admin.domain.repository.AppUserRepository;
import com.nexus.admin.web.AuthController.LoginResponse;
import com.nexus.admin.web.AuthController.RegisterResponse;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.HashSet;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final AppUserRepository userRepo;
    private final PasswordEncoder passwordEncoder;
    private final CurrentContext ctx;

    @Value("${nexus.jwt.secret}") private String secret;
    @Value("${nexus.jwt.access-token-expiration:3600000}") private long expMs;

    @Transactional
    public LoginResponse login(String email, String rawPassword) {
        AppUser user = userRepo.findByEmail(normalise(email))
            .orElseThrow(() -> new IllegalArgumentException("Invalid credentials"));
        if (!passwordEncoder.matches(rawPassword, user.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid credentials");
        }
        switch (user.getStatus()) {
            case PENDING  -> throw new AccountStatusException("PENDING_APPROVAL",
                "Your account is awaiting administrator approval.");
            case REJECTED -> throw new AccountStatusException("REJECTED",
                "Your registration was rejected. Please contact an administrator.");
            case DISABLED -> throw new AccountStatusException("DISABLED",
                "Your account has been disabled. Please contact an administrator.");
            case APPROVED -> { /* fall through */ }
        }
        if (!user.isActive()) {
            throw new AccountStatusException("DISABLED",
                "Your account has been disabled. Please contact an administrator.");
        }
        SecretKey key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        Instant now = Instant.now();
        String token = Jwts.builder()
            .subject(user.getId().toString())
            .claim("tenant_id", user.getTenantId().toString())
            .claim("email", user.getEmail())
            .claim("roles", user.getRoles())
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plusMillis(expMs)))
            .signWith(key)
            .compact();
        return new LoginResponse(token, user.getEmail(), user.getFullName(), user.getRoles());
    }

    /**
     * Self-service registration. Creates a new user in {@link UserStatus#PENDING}
     * with an empty roles set; an admin must approve and assign roles before the
     * user can log in.
     */
    @Transactional
    public RegisterResponse register(String email, String fullName, String rawPassword,
                                     String requestedRole) {
        String normEmail = normalise(email);
        if (userRepo.existsByEmail(normEmail)) {
            throw new IllegalArgumentException("An account with this email already exists.");
        }
        if (rawPassword == null || rawPassword.length() < 8) {
            throw new IllegalArgumentException("Password must be at least 8 characters.");
        }
        if (requestedRole != null && !requestedRole.isBlank()
                && !Roles.SELF_SERVICE_REQUESTABLE.contains(requestedRole)) {
            throw new IllegalArgumentException("Requested role is not available for self-service registration.");
        }
        AppUser u = AppUser.builder()
            .email(normEmail)
            .passwordHash(passwordEncoder.encode(rawPassword))
            .fullName(fullName == null || fullName.isBlank() ? normEmail : fullName.trim())
            .roles(new HashSet<>())              // none until approved
            .active(true)
            .status(UserStatus.PENDING)
            .requestedRole(requestedRole)
            .build();
        u.setTenantId(ctx.defaultTenantId());
        u.setCreatedBy(ctx.systemUserId());
        u.setUpdatedBy(ctx.systemUserId());
        AppUser saved = userRepo.save(u);
        return new RegisterResponse(saved.getId().toString(), saved.getEmail(),
            saved.getStatus().name(),
            "Your registration has been received. An administrator will review your account shortly.");
    }

    private static String normalise(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }
}
